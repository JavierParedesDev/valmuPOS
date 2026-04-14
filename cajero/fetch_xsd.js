const fs = require('fs');

async function getXsd() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/sii-cl/schemas/master/EnvioBOLETA_v1.1.xsd');
        if (!response.ok) {
            const altResponse = await fetch('https://raw.githubusercontent.com/sii-cl/schemas/master/EnvioBOLETA_v11.xsd');
            const data = await altResponse.text();
            fs.writeFileSync('EnvioBOLETA.xsd', data);
            console.log("Written alt!");
            return;
        }
        const data = await response.text();
        fs.writeFileSync('EnvioBOLETA.xsd', data);
        console.log("Written!");
    } catch (e) {
        console.log("failed", e);
    }
}
getXsd();
