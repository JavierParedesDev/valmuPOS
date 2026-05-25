const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

function parsePfxBuffer(pfxBuffer, password) {
    const pfxDer = pfxBuffer.toString('binary');
    const asn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    
    let privateKeyPem = null;
    let certBase64 = null;
    let modulusBase64 = null;
    let exponentBase64 = null;

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
        const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        certBase64 = forge.util.encode64(certDer);

        // Modulus and exponent are needed for EnvioDTE
        const modulusStr = cert.publicKey.n.toString(16);
        const hexModulus = modulusStr.length % 2 === 0 ? modulusStr : '0' + modulusStr;
        modulusBase64 = Buffer.from(hexModulus, 'hex').toString('base64');
        
        const expStr = cert.publicKey.e.toString(16);
        const hexExp = expStr.length % 2 === 0 ? expStr : '0' + expStr;
        exponentBase64 = Buffer.from(hexExp, 'hex').toString('base64');
    } else {
        throw new Error('No se pudo encontrar el certificado en el archivo PFX.');
    }

    return { privateKeyPem, certBase64, modulusBase64, exponentBase64 };
}

function buildEnvioDTE(dtesXmlList, rutEmisor, rutEnvia, fechaResol, nroResol) {
    // Generate ISO 8601 timestamp up to seconds, e.g., 2026-05-24T20:17:50
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const tmstFirmaEnv = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    const setDteId = 'SetDoc';
    
    let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
    xml += `<EnvioDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioDTE_v10.xsd" version="1.0">\n`;
    xml += `<SetDTE ID="${setDteId}">\n`;
    xml += `<Caratula version="1.0">\n`;
    xml += `<RutEmisor>${rutEmisor}</RutEmisor>\n`;
    xml += `<RutEnvia>${rutEnvia}</RutEnvia>\n`;
    xml += `<RutReceptor>60803000-K</RutReceptor>\n`;
    xml += `<FchResol>${fechaResol}</FchResol>\n`;
    xml += `<NroResol>${nroResol}</NroResol>\n`;
    xml += `<TmstFirmaEnv>${tmstFirmaEnv}</TmstFirmaEnv>\n`;
    
    // Group DTEs by type
    const dtesByType = {};
    dtesXmlList.forEach(dteXml => {
        const dteStr = dteXml.toString('latin1');
        const tpoMatch = dteStr.match(/<TipoDTE>(\d+)<\/TipoDTE>/);
        if (tpoMatch) {
            const tpo = tpoMatch[1];
            dtesByType[tpo] = (dtesByType[tpo] || 0) + 1;
        }
    });

    for (const [tpo, count] of Object.entries(dtesByType)) {
        xml += `<SubTotDTE>\n`;
        xml += `<TpoDTE>${tpo}</TpoDTE>\n`;
        xml += `<NroDTE>${count}</NroDTE>\n`;
        xml += `</SubTotDTE>\n`;
    }

    xml += `</Caratula>\n`;
    
    dtesXmlList.forEach(dteXml => {
        // Remove <?xml ... ?> if exists to embed cleanly
        let dteClean = dteXml.toString('latin1').replace(/^<\?xml[^>]*\?>\s*/i, '');
        // Trim trailing newlines and whitespace
        dteClean = dteClean.trimRight();
        xml += dteClean + '\n';
    });

    xml += `</SetDTE>\n`;
    xml += `</EnvioDTE>`;
    
    return { xml, setDteId };
}

function signEnvioDTE(xmlContent, setDteId, privateKeyPem, certBase64, modulusBase64, exponentBase64) {
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
    
    // We return a latin1 buffer
    return Buffer.from(sig.getSignedXml(), 'latin1');
}

module.exports = {
    parsePfxBuffer,
    buildEnvioDTE,
    signEnvioDTE
};
