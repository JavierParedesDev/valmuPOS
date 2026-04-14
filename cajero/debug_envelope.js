
const fs = require('fs');

async function getSimpleApiToken(apiKey) {
    const authRes = await fetch('https://api.simpleapi.cl/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: apiKey })
    });
    if (!authRes.ok) throw new Error('Auth failed: ' + authRes.status);
    return await authRes.text();
}

async function test() {
    const configPath = 'C:/Users/javie/OneDrive/Desktop/Nueva carpeta/valmu/admin/sii_data/config.json';
    const dtePath = 'C:/Users/javie/OneDrive/Desktop/Nueva carpeta/valmu/cajero/sii_data/boletas/DTE_39_Folio_76051.xml';
    const certPath = 'C:/Users/javie/OneDrive/Desktop/Nueva carpeta/valmu/cajero/sii_data/certificado.pfx';

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const xmlContent = fs.readFileSync(dtePath, 'utf8');
    const certBuffer = fs.readFileSync(certPath);

    try {
        const token = await getSimpleApiToken(config.apiKey);
        console.log('Token obtained.');

        const rutEnvia = config.rutEnvia || config.rutEmisor;

        const wrapPayload = {
            Certificado: {
                Rut: rutEnvia,
                Password: config.certPassword
            },
            Caratula: {
                RutEnvia: rutEnvia,
                RutEmisor: config.rutEmisor,
                // RutReceptor: '60803000-K', // REMOVED
                NumeroResolucion: 80,
                FechaResolucion: '2014-08-22'
            }
        };

        const formData = new FormData();
        formData.append('input', JSON.stringify(wrapPayload));
        formData.append('files', new Blob([certBuffer]), 'certificado.pfx');
        formData.append('files', new Blob([xmlContent], { type: 'text/xml' }), 'dte.xml');

        console.log('Generating envelope WITHOUT RutReceptor...');
        const response = await fetch('https://api.simpleapi.cl/api/v1/envio/generar', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        const text = await response.text();
        console.log('Response status:', response.status);
        if (response.ok) {
            fs.writeFileSync('C:/Users/javie/OneDrive/Desktop/Nueva carpeta/valmu/cajero/temp_envelope_no_rx.xml', text);
            console.log('Envelope saved to temp_envelope_no_rx.xml');
        } else {
            console.log('Error:', text);
        }
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

test();
