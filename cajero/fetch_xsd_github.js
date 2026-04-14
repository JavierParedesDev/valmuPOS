const https = require('https');
const fs = require('fs');

const urls = [
    'https://raw.githubusercontent.com/LibreDTE/sii-documentos-xml/master/schemas/EnvioBOLETA_v1.1.xsd',
    'https://raw.githubusercontent.com/sii-cl/schemas/master/schemas/EnvioBOLETA_v1.1.xsd',
    'https://raw.githubusercontent.com/sii-cl/schemas/master/EnvioBOLETA_v1.1.xsd'
];

async function tryFetch() {
    for (const url of urls) {
        try {
            console.log("Trying", url);
            const res = await fetch(url);
            if (res.ok) {
                fs.writeFileSync('EnvioBOLETA.xsd', await res.text());
                console.log("Success with", url);
                return;
            }
        } catch (e) {
            console.log(e.message);
        }
    }
    console.log("All failed");
}
tryFetch();
