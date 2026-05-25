async function resolveFreshSiiConfig(config = {}) {
    const mergedConfig = { ...(config || {}) };

    try {
        if (typeof window.electronAPI?.getSiiConfig === 'function') {
            const diskConfig = await window.electronAPI.getSiiConfig();
            Object.assign(mergedConfig, diskConfig || {});
            localStorage.setItem('sii_config', JSON.stringify(mergedConfig));
        }
    } catch (error) {
        console.warn('No se pudo refrescar sii_data/config.json antes de enviar:', error);
    }

    return mergedConfig;
}

function getSiiTrackId(response) {
    const rawTrackId = response?.TrackId ?? response?.trackId ?? response?.TRACKID ?? null;
    const trackId = Number(rawTrackId);
    return Number.isFinite(trackId) ? trackId : null;
}

function isSuccessfulSiiSend(response) {
    const estado = String(response?.estado || response?.Estado || '').trim().toUpperCase();
    const trackId = getSiiTrackId(response);
    return trackId !== null && trackId > 0 && estado !== 'ERROR';
}

function resolveSiiResolution(config = {}) {
    const numero = Number(config.resolucionNumero || config.numeroResolucion || config.nroResolucion || 80);
    return {
        numero: Number.isFinite(numero) && numero > 0 ? numero : 80,
        fecha: config.resolucionFecha || config.fechaResolucion || '2014-08-22'
    };
}

function resolveSiiAmbiente(config = {}) {
    const ambiente = String(config.siiAmbiente || config.ambiente || '2').trim();
    return ambiente === '2' || ambiente === 'produccion' || ambiente === 'PRODUCCION' ? 1 : 0;
}

function cleanSiiErrorMessage(error) {
    if (error?.userMessage) {
        return error.userMessage;
    }

    const rawMessage = String(error?.message || error || '').trim();

    if (!rawMessage) {
        return 'No se pudo enviar el documento al SII. Intenta nuevamente en unos minutos.';
    }

    let payload = null;
    try {
        payload = JSON.parse(rawMessage);
    } catch (_error) {
        payload = null;
    }

    const technicalText = String(payload?.responseXml || payload?.glosa || rawMessage);
    if (/response ended prematurely|sending the request|webexception|httprequestexception/i.test(technicalText)) {
        return 'El SII o SimpleAPI cortaron la conexion durante el envio. No se desconto el folio ni se guardo el XML. Intenta reenviar en unos minutos.';
    }

    if (/rutenvia|null|rutempresa|null|file|null/i.test(rawMessage)) {
        return 'SimpleAPI no recibio correctamente los datos del envio. No se desconto el folio ni se guardo el XML.';
    }

    if (/solo se admiten dos archivos|archivos recibidos/i.test(rawMessage)) {
        return 'SimpleAPI rechazo el envio por formato de archivos. No se desconto el folio ni se guardo el XML.';
    }

    if (payload?.glosa) {
        return `El SII rechazo el envio: ${payload.glosa}`;
    }

    if (rawMessage.length > 220) {
        return 'No se pudo enviar el documento al SII. No se desconto el folio ni se guardo el XML. Revisa la conexion e intenta nuevamente.';
    }

    return rawMessage;
}

function showSiiSuccessDialog(trackId) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            customClass: {
                popup: 'sii-result-popup',
                htmlContainer: 'sii-result-html',
                confirmButton: 'sii-result-confirm'
            },
            buttonsStyling: false,
            showCloseButton: true,
            confirmButtonText: 'Aceptar',
            html: `
                <div class="sii-result-shell">
                    <div class="sii-result-icon" aria-hidden="true">
                        <i class="bi bi-check2"></i>
                    </div>
                    <div class="sii-result-copy">
                        <span class="sii-result-overline">Envio confirmado</span>
                        <h3>Documento enviado al SII</h3>
                        <p>El documento fue recibido correctamente por el SII.</p>
                    </div>
                    <div class="sii-result-track">
                        <span>TrackID</span>
                        <strong>${trackId}</strong>
                    </div>
                </div>
            `
        });
        return;
    }

    console.log(`ENVIADO AL SII EXITOSAMENTE - TrackID: ${trackId}`);
}

function showSiiLoadingDialog(message) {
    if (typeof Swal === 'undefined') {
        return;
    }

    Swal.fire({
        title: 'Enviando al SII',
        html: `
            <div class="sii-loading-shell">
                <p data-sii-loading-message>${message}</p>
            </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: {
            popup: 'sii-loading-popup',
            htmlContainer: 'sii-loading-html'
        },
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function updateSiiLoadingDialog(message) {
    const messageElement = document.querySelector('[data-sii-loading-message]');
    if (messageElement) {
        messageElement.textContent = message;
        return;
    }

    showSiiLoadingDialog(message);
}

function closeSiiLoadingDialog() {
    if (typeof Swal === 'undefined') {
        return;
    }

    if (document.querySelector('.sii-loading-popup')) {
        Swal.close();
    }
}

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
            const freshConfig = await resolveFreshSiiConfig(config);
            const normalizeRut = (rut) => String(rut || '').replace(/\./g, '').trim().toUpperCase();
            
            const resolucion = resolveSiiResolution(freshConfig);
            const ambienteSii = resolveSiiAmbiente(freshConfig);
            const nroRes = resolucion.numero;
            const fchRes = resolucion.fecha;
            const rutEmisor = normalizeRut(freshConfig.rut || freshConfig.rutEmisor || '');
            const configuredRutEnvia = normalizeRut(freshConfig.rutEnvia || freshConfig.rutFirmante || freshConfig.siiAuthRut || '');
            const rutEnvia = configuredRutEnvia || rutEmisor;
            const certPassword = freshConfig.certPassword || freshConfig.passwordCert || '';

            console.log('[SII] Datos de envio admin:', {
                rutEmisor,
                rutEnvia,
                tipoDTE,
                ambiente: ambienteSii === 1 ? 'produccion' : 'certificacion',
                numeroResolucion: nroRes,
                fechaResolucion: fchRes
            });

            const wrapPayload = {
                Certificado: {
                    Rut: rutEnvia,
                    Password: certPassword
                },
                Caratula: {
                    RutEnvia: rutEnvia,
                    RutEmisor: rutEmisor,
                    RutReceptor: '60803000-K',
                    NumeroResolucion: nroRes,
                    FechaResolucion: fchRes
                }
            };


            const dteBlobFinal = dteXmlContent instanceof Blob
                ? dteXmlContent
                : window.ValmuInvoicingUtils.iso88591ToBlob(dteXmlContent, 'text/xml');
                
            const dteBufferForIpc = await dteBlobFinal.arrayBuffer();
            const certBufferForIpc = await certBlob.arrayBuffer();
            
            // Convert ArrayBuffer to Base64 in the browser safely
            let binary = '';
            const bytes = new Uint8Array(certBufferForIpc);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const certBase64 = window.btoa(binary);

            showSiiLoadingDialog('Generando el sobre firmado localmente. Espera un momento...');
            
            const apiKey = String(freshConfig.apiKey || '').trim();
            const headers = apiKey ? { Authorization: apiKey } : {};

            const wrapRes = await window.electronAPI.signEnvioDTE({
                dteXmls: [dteBufferForIpc], // IPC handles ArrayBuffer directly
                rutEmisor,
                rutEnvia,
                fechaResol: fchRes,
                nroResol: nroRes,
                certBase64Data: certBase64,
                certPassword
            });

            if (!wrapRes || !wrapRes.success) {
                throw new Error('Fallo Generar Sobre Local: ' + wrapRes?.error);
            }

            const envelopeBuffer = wrapRes.envelopeBuffer;
            console.log('-> Sobre Generado Localmente.');

            const sendPayload = {
                Tipo: tipoDTE == 39 || tipoDTE == 41 ? 2 : 1,
                Ambiente: ambienteSii,
                RutEmisor: rutEmisor,
                RutEnvia: rutEnvia,
                rutCompany: rutEmisor,
                rutEmpresa: rutEmisor,
                rutEmisor: rutEmisor,
                rutEnvia: rutEnvia,
                Certificado: {
                    Rut: rutEnvia,
                    Password: certPassword
                },
                Caratula: {
                    RutEnvia: rutEnvia,
                    RutEmisor: rutEmisor
                }
            };

            const sendFormData = new FormData();
            sendFormData.append('input', JSON.stringify(sendPayload));
            sendFormData.append('files', certBlob, 'certificado.pfx');

            const envelopeBlob = new Blob([envelopeBuffer], { type: 'text/xml' });
            sendFormData.append('files2', envelopeBlob, 'envio.xml');

            updateSiiLoadingDialog('Subiendo el sobre firmado al SII. Esto puede tardar unos segundos...');
            const sendRes = await fetch('https://api.simpleapi.cl/api/v1/envio/enviar', {
                method: 'POST',
                headers,
                body: sendFormData
            });

            const sendTxt = await sendRes.text();
            console.log('-> Respuesta Envio SII:', sendTxt);
            closeSiiLoadingDialog();

            if (!sendRes.ok) {
                throw new Error(sendTxt);
            }

            let parsedResponse = null;
            try {
                parsedResponse = JSON.parse(sendTxt);
            } catch (error) {
                console.warn('No se pudo parsear la respuesta de envío:', error);
            }

            if (parsedResponse && !isSuccessfulSiiSend(parsedResponse)) {
                throw new Error(sendTxt);
            }

            const trackId = getSiiTrackId(parsedResponse);
            if (trackId) {
                showSiiSuccessDialog(trackId);
            } else {
                toast?.show?.('Enviado al SII', 'success');
            }

            return parsedResponse;
        } catch (error) {
            closeSiiLoadingDialog();
            console.error('Manual Send Error:', error);
            error.userMessage = cleanSiiErrorMessage(error);
            throw error;
        }
    },

    getSiiTrackId,
    isSuccessfulSiiSend,
    cleanSiiErrorMessage
};
