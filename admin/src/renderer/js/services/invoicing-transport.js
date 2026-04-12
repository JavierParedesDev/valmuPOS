window.ValmuInvoicingTransport = {
    async testConnection({ button, toast } = {}) {
        const config = JSON.parse(localStorage.getItem('sii_config') || '{}');
        const { apiKey } = config;

        if (!apiKey) {
            return toast?.show?.('Falta API Key', 'error');
        }

        const originalContent = button?.innerHTML || '';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
        }

        try {
            const authHeader = 'Basic ' + btoa('api:' + apiKey);
            const response = await fetch('https://api.simpleapi.cl/api/v1/empresa', {
                method: 'GET',
                headers: {
                    Authorization: authHeader
                }
            });

            const text = await response.text();
            console.log('Connection Test Response:', text);

            if (response.ok) {
                toast?.show?.('Conexión Exitosa con SimpleAPI', 'success');
                alert(
                    'CONEXIÓN ESTABLECIDA\n\n' +
                    'La API Key es válida.\n\n' +
                    'IMPORTANTE: Si al EMITIR te dice "RUT Incorrecto", es porque esta llave fue creada para un RUT distinto.\n\n' +
                    'Solución definitiva: crea una nueva API Key con el usuario correcto.'
                );
                return true;
            }

            if (response.status === 401) {
                alert('ERROR 401: No autorizado.\nEsta API Key no existe o está vencida.');
            } else {
                alert(`Respuesta inesperada (${response.status}):\n${text}`);
            }

            return false;
        } catch (error) {
            console.error('Connection Test Error:', error);
            toast?.show?.('Modo Frontend: No hay conexión real', 'info');
            return false;
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
        }
    },

    async getBearerToken() {
        try {
            const config = JSON.parse(localStorage.getItem('sii_config') || '{}');
            const apiKey = config.apiKey;

            if (!apiKey) {
                console.error('No API Key found in config for Token generation');
                return null;
            }

            const authRes = await fetch('https://api.simpleapi.cl/api/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apikey: apiKey })
            });

            if (!authRes.ok) {
                throw new Error('Fallo al obtener Token: ' + authRes.status);
            }

            return await authRes.text();
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    async probeFolio(tipo, folio, token) {
        const config = JSON.parse(localStorage.getItem('sii_config') || '{}');
        const emisorRut = config.rutEmisor || '';
        const rutWithDash = emisorRut.replace(/\./g, '');
        const rutNoDash = rutWithDash.replace('-', '');
        const trials = [
            `https://api.simpleapi.cl/api/v1/documentos/consultar/${rutWithDash}/${tipo}/${folio}/0`,
            `https://api.simpleapi.cl/api/v1/documentos/consultar/${rutNoDash}/${tipo}/${folio}/0`,
            `https://api.simpleapi.cl/api/v1/dte/${tipo}/${folio}/0`,
            `https://api.simpleapi.cl/api/v1/documento/consultar/${rutWithDash}/${tipo}/${folio}/0`,
            `https://api.simpleapi.cl/api/v1/documento/consultar/${rutNoDash}/${tipo}/${folio}/0`
        ];

        for (const url of trials) {
            try {
                const response = await fetch(url, {
                    headers: { Authorization: 'Bearer ' + token }
                });

                if (response.ok) {
                    console.log(`Folio ${folio} (Tipo ${tipo}) está OCUPADO. Detectado en: ${url}`);
                    return true;
                }
            } catch (error) {
                console.warn(`Error probando ${url}:`, error);
            }
        }

        return false;
    },

    async sendDTE({ dteXmlContent, config, tipoDTE, token, certBlob, toast } = {}) {
        console.log('--- INICIANDO CICLO DE ENVIO ADMIN: GENERAR SOBRE -> ENVIAR ---');
        toast?.show?.('Empaquetando y Enviando al SII...', 'info');

        try {
            const nroRes = (config.nroResolucion && parseInt(config.nroResolucion, 10) > 0)
                ? parseInt(config.nroResolucion, 10)
                : 80;
            const fchRes = config.fechaResolucion || '2014-08-22';
            const rutEmisor = config.rut || config.rutEmisor || '13625745-5';
            const rutEnvia = config.rutEnvia || config.rutFirmante || rutEmisor;

            const wrapPayload = {
                Certificado: {
                    Rut: rutEnvia,
                    Password: config.passwordCert || config.certPassword || 'distribuidoraAlmi2020'
                },
                Caratula: {
                    RutEnvia: rutEnvia,
                    RutEmisor: rutEmisor,
                    RutReceptor: '60803000-K',
                    NumeroResolucion: nroRes,
                    FechaResolucion: fchRes
                }
            };

            const wrapFormData = new FormData();
            wrapFormData.append('input', JSON.stringify(wrapPayload));
            wrapFormData.append('files', certBlob, 'certificado.pfx');

            const dteBlobFinal = dteXmlContent instanceof Blob
                ? dteXmlContent
                : new Blob([dteXmlContent], { type: 'text/xml' });
            wrapFormData.append('files', dteBlobFinal, 'dte.xml');

            const headers = { Authorization: 'Bearer ' + token };
            const wrapRes = await fetch('https://api.simpleapi.cl/api/v1/envio/generar', {
                method: 'POST',
                headers,
                body: wrapFormData
            });

            if (!wrapRes.ok) {
                throw new Error('Fallo Generar Sobre: ' + await wrapRes.text());
            }

            const envelopeXml = await wrapRes.text();
            console.log('-> Sobre Generado.');

            const sendPayload = {
                Tipo: tipoDTE == 39 || tipoDTE == 41 ? 2 : 1,
                Ambiente: 1,
                Certificado: {
                    Rut: rutEnvia,
                    Password: config.passwordCert || config.certPassword || 'distribuidoraAlmi2020'
                }
            };

            const sendFormData = new FormData();
            sendFormData.append('input', JSON.stringify(sendPayload));
            sendFormData.append('files', certBlob, 'certificado.pfx');
            sendFormData.append('files', new Blob([envelopeXml], { type: 'text/xml' }), 'envio.xml');

            const sendRes = await fetch('https://api.simpleapi.cl/api/v1/envio/enviar', {
                method: 'POST',
                headers,
                body: sendFormData
            });

            const sendTxt = await sendRes.text();
            console.log('-> Respuesta Envio SII:', sendTxt);

            if (!sendRes.ok) {
                throw new Error(sendTxt);
            }

            let parsedResponse = null;
            try {
                parsedResponse = JSON.parse(sendTxt);
            } catch (error) {
                console.warn('No se pudo parsear la respuesta de envío:', error);
            }

            if (parsedResponse?.TrackId) {
                alert(`ENVIADO AL SII EXITOSAMENTE\n\nTrackID: ${parsedResponse.TrackId}`);
            } else {
                toast?.show?.('Enviado al SII', 'success');
            }

            return parsedResponse;
        } catch (error) {
            console.error('Manual Send Error:', error);
            toast?.show?.('Error enviando a SII (pero XML generado): ' + error.message, 'warning');
            throw error;
        }
    }
};
