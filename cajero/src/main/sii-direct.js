const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

// Memory token cache to avoid requesting new seeds on every invoice (tokens are valid for ~10-12 hours)
const tokenCache = {
    // [ambiente]: { token: string, expiresAt: number }
};

/**
 * Escapes XML characters.
 */
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Decodes and parses a PFX digital certificate.
 */
function parsePfx(pfxPath, password) {
    const pfxBuffer = fs.readFileSync(pfxPath);
    const pfxDer = pfxBuffer.toString('binary');
    const asn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    
    let privateKeyPem = null;
    let certPem = null;
    let certBase64 = null;

    const pkcs8Bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBags = pfx.getBags({ bagType: forge.pki.oids.keyBag });
    
    let keyBag = null;
    if (pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag] && pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag].length > 0) {
        keyBag = pkcs8Bags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    } else if (keyBags[forge.pki.oids.keyBag] && keyBags[forge.pki.oids.keyBag].length > 0) {
        keyBag = keyBags[forge.pki.oids.keyBag][0];
    }

    if (keyBag && keyBag.key) {
        privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
    } else {
        throw new Error('No se pudo encontrar la clave privada en el certificado PFX.');
    }

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBagList = certBags[forge.pki.oids.certBag];
    if (certBagList && certBagList.length > 0) {
        const cert = certBagList[0].cert;
        certPem = forge.pki.certificateToPem(cert);
        const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        certBase64 = forge.util.encode64(certDer);
    } else {
        throw new Error('No se pudo encontrar el certificado X.509 en el archivo PFX.');
    }

    return { privateKeyPem, certPem, certBase64 };
}

/**
 * Gets a seed from the SII.
 */
async function getSemilla(ambiente = '2') {
    // REST path: api.sii.cl (prod) / apicert.sii.cl (cert)
    const restBase = ambiente === '1'
        ? 'https://api.sii.cl/recursos/v1'
        : 'https://apicert.sii.cl/recursos/v1';

    try {
        const res = await fetch(`${restBase}/boleta.electronica.semilla`, {
            headers: { 'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; Windows NT)' }
        });
        const text = await res.text();
        const match = text.match(/<SEMILLA>([^<]+)<\/SEMILLA>/);
        if (match) return match[1].trim();
    } catch (e) { /* fallback to SOAP */ }

    // Fallback: SOAP path
    const domain = ambiente === '1' ? 'palena.sii.cl' : 'maullin.sii.cl';
    const url = `https://${domain}/DTEWS/CrSeed.jws`;
    
    const soapEnvelope = 
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
          `<soap:Body>` +
            `<getSeed xmlns="http://DefaultNamespace"/>` +
          `</soap:Body>` +
        `</soap:Envelope>`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': ''
        },
        body: soapEnvelope
    });
    
    const text = await res.text();
    const match = text.match(/<[^:]*:?getSeedReturn[^>]*>([\s\S]*?)<\/[^:]*:?getSeedReturn>/);
    if (!match) {
        throw new Error('No se pudo encontrar el tag getSeedReturn en la respuesta del SII: ' + text);
    }
    
    const innerXml = match[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'");

    const semillaMatch = innerXml.match(/<SEMILLA>([^<]+)<\/SEMILLA>/);
    if (!semillaMatch) {
        throw new Error('No se pudo encontrar el tag SEMILLA en el XML de retorno: ' + innerXml);
    }
    
    return semillaMatch[1].trim();
}

/**
 * Signs the seed XML.
 */
function signGetToken(semilla, privateKeyPem, certBase64) {
    const xml = `<getToken><item><Semilla>${semilla}</Semilla></item></getToken>`;
    const cleanCert = certBase64.replace(/\r?\n|\r/g, '').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
        canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
        getKeyInfoContent: ({ prefix }) => {
            const p = prefix ? `${prefix}:` : "";
            return `<${p}X509Data><${p}X509Certificate>${cleanCert}</${p}X509Certificate></${p}X509Data>`;
        }
    });
    
    sig.addReference({
        xpath: "//*[local-name(.)='getToken']",
        transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
        isEmptyUri: true
    });
    
    sig.computeSignature(xml, { prefix: '' });
    return sig.getSignedXml();
}

/**
 * Fetches the session token from SII using the signed seed.
 */
async function getToken(signedXml, ambiente = '2') {
    const domain = ambiente === '1' ? 'palena.sii.cl' : 'maullin.sii.cl';
    const url = `https://${domain}/DTEWS/GetTokenFromSeed.jws`;
    
    const escapedXml = signedXml
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const soapEnvelope = 
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
          `<soap:Body>` +
            `<getToken xmlns="http://DefaultNamespace">` +
              `<pszXml>${escapedXml}</pszXml>` +
            `</getToken>` +
          `</soap:Body>` +
        `</soap:Envelope>`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': ''
        },
        body: soapEnvelope
    });
    
    const text = await res.text();
    const returnMatch = text.match(/<[^:]*:?getTokenReturn[^>]*>([\s\S]*?)<\/[^:]*:?getTokenReturn>/);
    if (!returnMatch) {
        throw new Error('No se pudo encontrar el tag getTokenReturn en la respuesta del SII: ' + text);
    }
    
    const responseXmlStr = returnMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
        
    const tokenMatch = responseXmlStr.match(/<TOKEN>([^<]+)<\/TOKEN>/);
    if (!tokenMatch) {
        const glosaMatch = responseXmlStr.match(/<GLOSA>([^<]+)<\/GLOSA>/);
        const estadoMatch = responseXmlStr.match(/<ESTADO>([^<]+)<\/ESTADO>/);
        const errorMsg = glosaMatch ? glosaMatch[1] : 'Respuesta de error del SII';
        const estado = estadoMatch ? estadoMatch[1] : 'Desconocido';
        throw new Error(`Error obteniendo token SII (Estado ${estado}): ${errorMsg}`);
    }
    
    return tokenMatch[1].trim();
}

/**
 * Gets a session token using the REST API (api.sii.cl for prod, apicert.sii.cl for cert).
 * Returns the token string or throws on failure.
 */
async function getTokenRest(semilla, certData, ambiente = '2') {
    const restBase = ambiente === '1'
        ? 'https://api.sii.cl/recursos/v1'
        : 'https://apicert.sii.cl/recursos/v1';

    const signedXml = signGetToken(semilla, certData.privateKeyPem, certData.certBase64);
    const payload = `<?xml version="1.0" encoding="UTF-8"?>\n${signedXml}`;

    const res = await fetch(`${restBase}/boleta.electronica.token`, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; Windows NT)',
            'Content-Type': 'application/xml',
            'Accept': 'application/xml'
        },
        body: payload
    });

    const text = await res.text();
    const tokenMatch = text.match(/<TOKEN>([^<]+)<\/TOKEN>/);
    if (!tokenMatch) {
        throw new Error('REST getToken failed: ' + text);
    }
    return tokenMatch[1].trim();
}

/**
 * Retrieves the session token, checking cache or authenticating if expired/forced.
 * Prefers REST API; falls back to SOAP if REST fails.
 */
async function getOrFetchSessionToken(certPath, password, ambiente = '2', forceRefresh = false) {
    const cached = tokenCache[ambiente];
    const now = Date.now();
    
    // Tokens are valid for 10-12 hours, cache for 8 hours (28800000 ms)
    if (!forceRefresh && cached && cached.token && (now - cached.timestamp < 28800000)) {
        return cached.token;
    }

    const certData = parsePfx(certPath, password);
    let token;

    try {
        // Try REST first (production-grade)
        const semilla = await getSemilla(ambiente);
        token = await getTokenRest(semilla, certData, ambiente);
    } catch (restErr) {
        // Fallback to legacy SOAP
        const semilla = await getSemilla(ambiente);
        const signedSemillaXml = signGetToken(semilla, certData.privateKeyPem, certData.certBase64);
        token = await getToken(signedSemillaXml, ambiente);
    }
    
    tokenCache[ambiente] = { token, timestamp: now };
    return token;
}

/**
 * Generates the Timbre Electrónico DTE (TED) XML block.
 */
function generateTed({
    emisorRut,
    tipoDte,
    folio,
    fechaEmis,
    receptorRut,
    receptorRznSoc,
    montoTotal,
    primerItemNombre,
    cafXmlContent
}) {
    const cafMatch = cafXmlContent.match(/<CAF[\s\S]*?<\/CAF>/);
    if (!cafMatch) {
        throw new Error('No se encontró el tag <CAF> en el archivo CAF XML.');
    }
    
    const cafClean = cafMatch[0]
        .replace(/\r?\n|\r/g, '')
        .replace(/>\s+</g, '><')
        .trim();

    const keyMatch = cafXmlContent.match(/<RSASK>([\s\S]*?)<\/RSASK>/);
    if (!keyMatch) {
        throw new Error('No se encontró el tag <RSASK> en el archivo CAF XML.');
    }
    const cafPrivateKeyPem = keyMatch[1].trim();
    const tsted = new Date().toISOString().replace(/\.\d+Z$/, '').substring(0, 19);

    const ddXml = `<DD>` +
        `<RE>${emisorRut}</RE>` +
        `<TD>${tipoDte}</TD>` +
        `<F>${folio}</F>` +
        `<FE>${fechaEmis}</FE>` +
        `<RR>${receptorRut}</RR>` +
        `<RSR>${escapeXml(receptorRznSoc).substring(0, 40)}</RSR>` +
        `<MNT>${montoTotal}</MNT>` +
        `<IT1>${escapeXml(primerItemNombre).substring(0, 40)}</IT1>` +
        cafClean +
        `<TSTED>${tsted}</TSTED>` +
        `</DD>`;

    const signer = crypto.createSign('RSA-SHA1');
    signer.update(ddXml);
    const signature = signer.sign(cafPrivateKeyPem, 'base64');

    const tedXml = `<TED version="1.0">${ddXml}<FRMT algoritmo="SHA1withRSA">${signature}</FRMT></TED>`;
    return { tedXml, ddXml, signature };
}

/**
 * Generates the unsigned XML string of a Boleta Electrónica (DTE 39).
 */
function generateBoletaXml({
    documentId,
    folio,
    fechaEmis,
    emisor,
    receptor,
    detalles,
    tedXml,
    indicadorServicio = 3
}) {
    const mntTotal = detalles.reduce((sum, item) => sum + Number(item.montoItem), 0);
    const mntNeto = Math.round(mntTotal / 1.19);
    const iva = mntTotal - mntNeto;

    let xml = `<?xml version="1.0" encoding="iso-8859-1"?>\n`;
    xml += `<DTE version="1.0">\n`;
    xml += `<Documento ID="${documentId}">\n`;
    xml += `<Encabezado>\n`;
    xml += `<IdDoc>\n`;
    xml += `<TipoDTE>39</TipoDTE>\n`;
    xml += `<Folio>${folio}</Folio>\n`;
    xml += `<FchEmis>${fechaEmis}</FchEmis>\n`;
    xml += `<IndServicio>${indicadorServicio}</IndServicio>\n`;
    xml += `</IdDoc>\n`;
    xml += `<Emisor>\n`;
    xml += `<RUTEmisor>${emisor.rut}</RUTEmisor>\n`;
    xml += `<RznSocEmisor>${escapeXml(emisor.razonSocial).substring(0, 100)}</RznSocEmisor>\n`;
    xml += `<GiroEmisor>${escapeXml(emisor.giro).substring(0, 80)}</GiroEmisor>\n`;
    xml += `<DirOrigen>${escapeXml(emisor.direccion).substring(0, 70)}</DirOrigen>\n`;
    xml += `<CmnaOrigen>${escapeXml(emisor.comuna).substring(0, 20)}</CmnaOrigen>\n`;
    xml += `<CiudadOrigen>${escapeXml(emisor.ciudad || emisor.comuna).substring(0, 20)}</CiudadOrigen>\n`;
    xml += `</Emisor>\n`;
    xml += `<Receptor>\n`;
    xml += `<RUTRecep>${receptor.rut}</RUTRecep>\n`;
    xml += `<RznSocRecep>${escapeXml(receptor.razonSocial).substring(0, 40)}</RznSocRecep>\n`;
    xml += `<DirRecep>${escapeXml(receptor.direccion).substring(0, 70)}</DirRecep>\n`;
    xml += `<CmnaRecep>${escapeXml(receptor.comuna).substring(0, 20)}</CmnaRecep>\n`;
    xml += `<CiudadRecep>${escapeXml(receptor.ciudad || receptor.comuna).substring(0, 20)}</CiudadRecep>\n`;
    xml += `</Receptor>\n`;
    xml += `<Totales>\n`;
    xml += `<MntNeto>${mntNeto}</MntNeto>\n`;
    xml += `<TasaIVA>19</TasaIVA>\n`;
    xml += `<IVA>${iva}</IVA>\n`;
    xml += `<MntTotal>${mntTotal}</MntTotal>\n`;
    xml += `</Totales>\n`;
    xml += `</Encabezado>\n`;
    
    detalles.forEach((det, idx) => {
        xml += `<Detalle>\n`;
        xml += `<NroLinDet>${idx + 1}</NroLinDet>\n`;
        xml += `<NmbItem>${escapeXml(det.nombre).substring(0, 80)}</NmbItem>\n`;
        if (det.descripcion) {
            xml += `<DscItem>${escapeXml(det.descripcion).substring(0, 80)}</DscItem>\n`;
        }
        xml += `<QtyItem>${det.quantity}</QtyItem>\n`;
        xml += `<UnmdItem>${escapeXml(det.unidadMedida || 'un').substring(0, 4)}</UnmdItem>\n`;
        xml += `<PrcItem>${det.precio}</PrcItem>\n`;
        xml += `<MontoItem>${det.montoItem}</MontoItem>\n`;
        xml += `</Detalle>\n`;
    });

    xml += tedXml + `\n`;
    
    const tmstFirma = new Date().toISOString().replace(/\.\d+Z$/, '').substring(0, 19);
    xml += `<TmstFirma>${tmstFirma}</TmstFirma>\n`;
    xml += `</Documento>\n`;
    xml += `</DTE>\n`;
    
    return xml;
}

/**
 * Signs the DTE XML with XMLDSIG.
 */
function signDte(xmlContent, documentId, privateKeyPem, certBase64, modulusBase64, exponentBase64) {
    const cleanCert = certBase64.replace(/\r?\n|\r/g, '').trim();
    const cleanModulus = modulusBase64.replace(/\r?\n|\r/g, '').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
        canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
        getKeyInfoContent: ({ prefix }) => {
            const p = prefix ? `${prefix}:` : "";
            return `<${p}KeyValue><${p}RSAKeyValue><${p}Modulus>${cleanModulus}</${p}Modulus><${p}Exponent>${exponentBase64}</${p}Exponent></${p}RSAKeyValue></${p}KeyValue>` +
                   `<${p}X509Data><${p}X509Certificate>${cleanCert}</${p}X509Certificate></${p}X509Data>`;
        }
    });
    
    sig.addReference({
        xpath: `//*[local-name(.)='Documento' and @ID='${documentId}']`,
        transforms: ["http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });
    
    sig.computeSignature(xmlContent, {
        prefix: '',
        location: { reference: "//*[local-name(.)='Documento']", action: "after" }
    });
    
    return sig.getSignedXml();
}

/**
 * Generates the unsigned XML string of an EnvioBOLETA envelope.
 */
function generateEnvelopeXml({
    setDteId,
    rutEmisor,
    rutEnvia,
    fechaResol,
    nroResol,
    dtesXmlList
}) {
    const tmstFirmaEnv = new Date().toISOString().replace(/\.\d+Z$/, '').substring(0, 19);

    let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
    xml += `<EnvioBOLETA xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioBOLETA_v11.xsd" version="1.0" xmlns="http://www.sii.cl/SiiDte">\n`;
    xml += `<SetDTE ID="${setDteId}">\n`;
    xml += `<Caratula version="1.0">\n`;
    xml += `<RutEmisor>${rutEmisor}</RutEmisor>\n`;
    xml += `<RutEnvia>${rutEnvia}</RutEnvia>\n`;
    xml += `<RutReceptor>60803000-K</RutReceptor>\n`;
    xml += `<FchResol>${fechaResol}</FchResol>\n`;
    xml += `<NroResol>${nroResol}</NroResol>\n`;
    xml += `<TmstFirmaEnv>${tmstFirmaEnv}</TmstFirmaEnv>\n`;
    xml += `<SubTotDTE>\n`;
    xml += `<TpoDTE>39</TpoDTE>\n`;
    xml += `<NroDTE>${dtesXmlList.length}</NroDTE>\n`;
    xml += `</SubTotDTE>\n`;
    xml += `</Caratula>\n`;
    
    dtesXmlList.forEach(dteXml => {
        const dteClean = dteXml.replace(/^<\?xml[^>]*\?>\s*/i, '');
        xml += dteClean + '\n';
    });

    xml += `</SetDTE>\n`;
    xml += `</EnvioBOLETA>`;
    
    return xml;
}

/**
 * Signs the EnvioBOLETA envelope XML.
 */
function signEnvelope(xmlContent, setDteId, privateKeyPem, certBase64, modulusBase64, exponentBase64) {
    const cleanCert = certBase64.replace(/\r?\n|\r/g, '').trim();
    const cleanModulus = modulusBase64.replace(/\r?\n|\r/g, '').trim();

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
        canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
        getKeyInfoContent: ({ prefix }) => {
            const p = prefix ? `${prefix}:` : "";
            return `<${p}KeyValue><${p}RSAKeyValue><${p}Modulus>${cleanModulus}</${p}Modulus><${p}Exponent>${exponentBase64}</${p}Exponent></${p}RSAKeyValue></${p}KeyValue>` +
                   `<${p}X509Data><${p}X509Certificate>${cleanCert}</${p}X509Certificate></${p}X509Data>`;
        }
    });
    
    sig.addReference({
        xpath: `//*[local-name(.)='SetDTE' and @ID='${setDteId}']`,
        transforms: ["http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });
    
    sig.computeSignature(xmlContent, {
        prefix: '',
        location: { reference: "//*[local-name(.)='SetDTE']", action: "after" }
    });
    
    return sig.getSignedXml();
}

/**
 * Parses a Chilean RUT into number and verification digit (DV).
 */
function parseRut(rutStr) {
    const cleaned = String(rutStr || '').replace(/\./g, '').replace(/-/g, '').trim();
    const dv = cleaned.slice(-1);
    const num = cleaned.slice(0, -1);
    return { num, dv };
}

/**
 * Builds a manual multipart/form-data body buffer to avoid class/library dependencies.
 */
function buildMultipartBody(boundary, fields, fileName, fileBuffer) {
    const parts = [];
    
    for (const [name, value] of Object.entries(fields)) {
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
        parts.push(Buffer.from(`${value}\r\n`));
    }
    
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="archivo"; filename="${fileName}"\r\n`));
    parts.push(Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n`));
    
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    
    return Buffer.concat(parts);
}

/**
 * Uploads a signed XML DTE envelope to the SII via REST (primary) or SOAP/CGI (fallback).
 */
async function uploadEnvelope({
    xmlContent,
    token,
    rutSender,
    rutCompany,
    ambiente = '2'
}) {
    const sender = parseRut(rutSender);
    const company = parseRut(rutCompany);
    const boundary = '----ValmuPOSBoundary' + Math.random().toString(16).substring(2);

    const fields = {
        rutSender: sender.num,
        dvSender: sender.dv,
        rutCompany: company.num,
        dvCompany: company.dv
    };

    const fileBuffer = Buffer.from(xmlContent, 'latin1');
    const multipartBody = buildMultipartBody(boundary, fields, 'EnvioBOLETA.xml', fileBuffer);

    // Primary: REST API (rahue.sii.cl for prod, pangal.sii.cl for cert)
    const restUploadUrl = ambiente === '1'
        ? 'https://rahue.sii.cl/recursos/v1/boleta.electronica.envio'
        : 'https://pangal.sii.cl/recursos/v1/boleta.electronica.envio';

    let lastError = null;
    try {
        const res = await fetch(restUploadUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; Windows NT)',
                'Cookie': `TOKEN=${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': String(multipartBody.length)
            },
            body: multipartBody
        });

        const text = await res.text();

        if (res.status === 200) {
            // REST returns JSON: { rut_emisor, rut_envia, trackid, fecha_recepcion, estado, file }
            let parsed;
            try { parsed = JSON.parse(text); } catch (e) { throw new Error('Invalid JSON from REST: ' + text); }
            if (parsed.trackid && parsed.estado) {
                return { trackId: String(parsed.trackid), status: parsed.estado, responseText: text };
            }
            throw new Error('Unexpected REST response: ' + text);
        }

        // 405 = "Ya existe" (duplicate envelope ID) — treat as transient
        if (res.status === 405) {
            // Extract track ID from x-location header if available
            const loc = res.headers.get('x-location') || '';
            const locMatch = loc.match(/\/(\d+)$/);
            if (locMatch) {
                return { trackId: locMatch[1], status: 'REC', responseText: text };
            }
            throw new Error('REST 405 — duplicate envelope without track ID: ' + text);
        }

        lastError = new Error(`REST upload failed (HTTP ${res.status}): ${text}`);
    } catch (err) {
        lastError = err;
    }

    // Fallback: Legacy CGI SOAP path
    const domain = ambiente === '1' ? 'palena.sii.cl' : 'maullin.sii.cl';
    const fallbackUrl = `https://${domain}/cgi_dte/BOL/BOLUpload`;

    const res2 = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/4.0 (compatible; PROG 1.0; Windows NT)',
            'Cookie': `TOKEN=${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(multipartBody.length)
        },
        body: multipartBody
    });

    const text2 = await res2.text();
    const statusMatch = text2.match(/<STATUS>([^<]+)<\/STATUS>/);
    const trackIdMatch = text2.match(/<TRACKID>([^<]+)<\/TRACKID>/);

    const status = statusMatch ? statusMatch[1].trim() : 'UNKNOWN';
    const trackId = trackIdMatch ? trackIdMatch[1].trim() : null;

    if (status !== '0' || !trackId) {
        throw new Error(`Error en subida al SII (Status ${status}): ${text2}`);
    }

    return { trackId, status, responseText: text2 };
}

module.exports = {
    parsePfx,
    getSemilla,
    getOrFetchSessionToken,
    generateTed,
    generateBoletaXml,
    signDte,
    generateEnvelopeXml,
    signEnvelope,
    uploadEnvelope
};
