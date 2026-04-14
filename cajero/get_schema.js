const https = require('https');
const fs = require('fs');

const options = {
    hostname: 'www.sii.cl',
    path: '/SiiDte/EnvioBOLETA_v11.xsd',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
};

https.get(options, (res) => {
    let xml = '';
    res.on('data', d => xml += d);
    res.on('end', () => fs.writeFileSync('EnvioBOLETA_v11.xsd', xml));
});
