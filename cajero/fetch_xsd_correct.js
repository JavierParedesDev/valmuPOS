const https = require('https');
const fs = require('fs');

https.get('https://raw.githubusercontent.com/LibreDTE/sii-documentos-xml/master/schemas/EnvioBOLETA_v1.1.xsd', (res) => {
    let xml = '';
    res.on('data', d => xml += d);
    res.on('end', () => {
        fs.writeFileSync('EnvioBOLETA.xsd', xml);
        console.log('Done!');
    });
});
