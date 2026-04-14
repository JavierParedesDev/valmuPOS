const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

async function testEnvelope() {
    try {
        const dteXml = fs.readFileSync('sii_data/boletas/DTE_39_Folio_76051.xml');
        const certBytes = fs.readFileSync('certificados/certificado.pfx');

        // Use the exact parameters from Valmu Admin's working implementation
        const wrapPayload = {
            Certificado: {
                Rut: '17445030-7',
                Password: 'distribuidoraAlmi2020'
            },
            Caratula: {
                RutEnvia: '17445030-7',
                RutEmisor: '77292701-0',
                RutReceptor: '66666666-6',
                NumeroResolucion: 80,
                FechaResolucion: '2014-08-22'
            }
        };

        const wrapFormData = new FormData();
        wrapFormData.append('input', JSON.stringify(wrapPayload));
        wrapFormData.append('files', certBytes, { filename: 'certificado.pfx' });
        wrapFormData.append('files', dteXml, { filename: 'dte.xml', contentType: 'text/xml' });

        const res = await fetch('https://api.simpleapi.cl/api/v1/envio/generar', {
            method: 'POST',
            // Need token. Wait, I will just grab the token using the API key
            headers: {
                Authorization: await getToken()
            },
            body: wrapFormData
        });

        const envelope = await res.text();
        fs.writeFileSync('test_envelope_output.xml', envelope);
        console.log("Success! File written to test_envelope_output.xml");

    } catch (e) {
        console.error("Error:", e);
    }
}

async function getToken() {
    // Read API key from config
    const db = require('./db');
    const apiRes = await fetch('https://api.simpleapi.cl/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: 'd2ca78bc-3b1a-46c5-84cb-42b74052ca5a' }) // Using known key
    });
    return 'Bearer ' + await apiRes.text();
}

testEnvelope();
