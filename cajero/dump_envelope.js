const fs = require('fs');
const http = require('http');

async function run() {
    try {
        const certBase64 = fs.readFileSync('../almipos/cajero/certificados/certificado.pfx').toString('base64');
        const certBlob = new Blob([Buffer.from(certBase64, 'base64')], { type: 'application/x-pkcs12' });
        // ...
        const cafBlob = new Blob([fs.readFileSync('../almipos/cajero/caf/CAF_39.xml')], { type: 'text/xml' });

        // Get Token
        const dbOptions = {
            hostname: 'api.simpleapi.cl',
            port: 443,
            path: '/api/auth/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const tokenRes = await fetch('https://api.simpleapi.cl/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apikey: 'd2ca78bc-3b1a-46c5-84cb-42b74052ca5a' }) // Used test key if needed
        });
        const token = await tokenRes.text();

        // payload
        const inputPayload = {
            Documento: {
                Encabezado: {
                    IdentificacionDTE: {
                        TipoDTE: 39,
                        Folio: 76052,
                        FechaEmision: new Date().toISOString().slice(0, 10),
                        IndicadorServicio: 3
                    },
                    Emisor: {
                        Rut: '77292701-0',
                        RazonSocial: 'DISTRIBUIDORA Y COMERCIAL',
                        Giro: 'DISTRIBUIDORA',
                        DireccionOrigen: 'Direccion 123',
                        ComunaOrigen: 'CORONEL',
                        CiudadOrigen: 'CORONEL'
                    },
                    Receptor: {
                        Rut: '66666666-6',
                        RazonSocial: 'CLIENTE',
                        Direccion: 'DIR',
                        Comuna: 'CORONEL',
                        Ciudad: 'CORONEL'
                    },
                    Totales: {
                        MontoNeto: 840,
                        TasaIVA: 19,
                        IVA: 160,
                        MontoTotal: 1000
                    }
                },
                Detalles: [{
                    IndicadorExento: 0,
                    Nombre: 'Item',
                    Descripcion: 'Item',
                    Cantidad: 1,
                    UnidadMedida: 'un',
                    Precio: 1000,
                    Descuento: 0,
                    Recargo: 0,
                    MontoItem: 1000
                }],
                Referencias: [],
                DescuentosRecargos: []
            },
            Certificado: {
                Rut: '17445030-7',
                Password: 'distribuidoraAlmi2020'
            },
            Ambiente: 1,
            Tipo: 1
        };

        // using the one from the top

        const fd = new FormData();
        fd.append('input', JSON.stringify(inputPayload));
        fd.append('file', certBlob, 'certificado.pfx');
        fd.append('password', 'distribuidoraAlmi2020');
        fd.append('caf', cafBlob, 'CAF_39.xml');

        const genRes = await fetch('https://api.simpleapi.cl/api/v1/dte/generar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd
        });

        const dteXml = await genRes.text();
        fs.writeFileSync('TEST_DTE_RAW.xml', dteXml);

        // Wrap
        const wrapPayload = {
            Certificado: {
                Rut: '17445030-7',
                Password: 'distribuidoraAlmi2020'
            },
            Caratula: {
                RutEnvia: '17445030-7',
                RutEmisor: '77292701-0',
                RutReceptor: '60803000-K',
                NumeroResolucion: 80,
                FechaResolucion: '2014-08-22'
            }
        };

        const wrapFd = new FormData();
        wrapFd.append('input', JSON.stringify(wrapPayload));
        wrapFd.append('files', certBlob, 'certificado.pfx');
        wrapFd.append('files', new Blob([dteXml], { type: 'text/xml' }), 'dte.xml');

        const wrapRes = await fetch('https://api.simpleapi.cl/api/v1/envio/generar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: wrapFd
        });

        const envXml = await wrapRes.text();
        fs.writeFileSync('TEST_ENVELOPE_RAW.xml', envXml);
        console.log("FILES WRITTEN!");

    } catch (e) {
        console.log(e);
    }
}
run();
