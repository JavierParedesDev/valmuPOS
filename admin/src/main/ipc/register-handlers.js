const path = require('path');
const { app, ipcMain, shell } = require('electron');
const { execFile } = require('child_process');
const os = require('os');
const fsPromises = require('fs/promises');
const { API_BASE_URL } = require('../config');
const { IPC_CHANNELS } = require('./channels');
const { loginUser } = require('../services/auth-service');
const { requestJson } = require('../services/http-client');
const fs = require('fs');

let activeWindow = null;
let isRegistered = false;
let updaterController = null;
const invoiceFolders = ['facturas', 'notas_de_credito', 'notas_de_debito'];

let siiDataDir = null;

function getSiiDataDir() {
    if (!siiDataDir) {
        siiDataDir = path.join(app.getPath('userData'), 'sii_data');
    }

    return siiDataDir;
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getLegacySiiDataCandidates() {
    const candidates = [
        path.join(process.cwd(), 'sii_data'),
        path.join(__dirname, '../../../sii_data')
    ];

    try {
        candidates.push(path.join(path.dirname(app.getPath('exe')), 'sii_data'));
    } catch (_error) {
        // Electron may not expose the executable path in every runtime.
    }

    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'sii_data'));
    }

    return Array.from(new Set(candidates.map((candidate) => path.resolve(candidate))));
}

function copyMissingFiles(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir) || path.resolve(sourceDir) === path.resolve(targetDir)) {
        return;
    }

    ensureDir(targetDir);

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyMissingFiles(sourcePath, targetPath);
            continue;
        }

        if (entry.isFile() && !fs.existsSync(targetPath)) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function readJsonFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.warn(`No se pudo leer JSON ${filePath}:`, error);
    }

    return null;
}

function migrateSiiDataIfNeeded() {
    const persistentSiiDataDir = getSiiDataDir();
    ensureDir(persistentSiiDataDir);

    const legacySiiDataCandidates = getLegacySiiDataCandidates();

    for (const candidate of legacySiiDataCandidates) {
        copyMissingFiles(candidate, persistentSiiDataDir);
    }

    const targetConfigPath = path.join(persistentSiiDataDir, 'config.json');
    const targetConfig = readJsonFile(targetConfigPath) || {};
    let mergedConfig = { ...targetConfig };

    for (const candidate of legacySiiDataCandidates) {
        const legacyConfig = readJsonFile(path.join(candidate, 'config.json'));
        if (legacyConfig) {
            mergedConfig = { ...legacyConfig, ...mergedConfig };
        }
    }

    if (Object.keys(mergedConfig).length > 0) {
        fs.writeFileSync(targetConfigPath, JSON.stringify(mergedConfig, null, 2), 'utf8');
    }
}

function getInvoiceFolderPath(folder = '') {
    const safeFolder = String(folder || '').trim();
    return path.join(getSiiDataDir(), safeFolder);
}

function bufferFromPayload(data) {
    if (data == null) {
        return Buffer.from('');
    }

    if (Buffer.isBuffer(data)) {
        return data;
    }

    if (data instanceof Uint8Array) {
        return Buffer.from(data);
    }

    if (Array.isArray(data)) {
        return Buffer.from(data);
    }

    if (typeof data === 'string') {
        return Buffer.from(data, 'utf8');
    }

    if (data?.type === 'Buffer' && Array.isArray(data.data)) {
        return Buffer.from(data.data);
    }

    return Buffer.from(String(data), 'utf8');
}

function getReceiptPrinterScriptPath() {
    if (app.isPackaged) {
        const exePath = path.join(process.resourcesPath, 'scripts', 'receipt_printer.exe');
        if (fs.existsSync(exePath)) return exePath;

        const pyPath = path.join(process.resourcesPath, 'scripts', 'receipt_printer.py');
        if (fs.existsSync(pyPath)) return pyPath;

        return exePath; // Fallback
    }

    const pythonPath = path.join(__dirname, '../../../scripts/receipt_printer.py');
    if (fs.existsSync(pythonPath)) {
        return pythonPath;
    }

    return path.join(__dirname, '../../../scripts/receipt_printer.exe');
}

function getReceiptLogoPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'src', 'renderer', 'assets', 'logo.png');
    }

    return path.join(__dirname, '../../renderer/assets/logo.png');
}

async function runPythonReceiptPrint(payload) {
    const scriptPath = getReceiptPrinterScriptPath();
    const tempPath = path.join(os.tmpdir(), `valmu-receipt-${Date.now()}.json`);
    const bridgePayload = {
        ...payload,
        logoPath: getReceiptLogoPath()
    };

    await fsPromises.writeFile(tempPath, JSON.stringify(bridgePayload), 'utf8');

    try {
        return await new Promise((resolve) => {
            const isExe = scriptPath.endsWith('.exe');
            const command = isExe ? scriptPath : 'python';
            const args = isExe ? [tempPath] : [scriptPath, tempPath];

            execFile(
                command,
                args,
                {
                    windowsHide: true
                },
                (error, stdout, stderr) => {
                    if (error) {
                        resolve({
                            ok: false,
                            error: stderr?.trim() || stdout?.trim() || error.message
                        });
                        return;
                    }

                    try {
                        const parsed = JSON.parse(String(stdout || '').trim() || '{}');
                        resolve(parsed);
                    } catch (_parseError) {
                        resolve({
                            ok: false,
                            error: stderr?.trim() || 'Python no devolvio una respuesta valida.'
                        });
                    }
                }
            );
        });
    } finally {
        await fsPromises.unlink(tempPath).catch(() => { });
    }
}

function registerIpcHandlers(mainWindow, updaterApi = null) {
    activeWindow = mainWindow;
    updaterController = updaterApi;
    migrateSiiDataIfNeeded();

    if (isRegistered) {
        return;
    }

    ipcMain.on(IPC_CHANNELS.NAVIGATE_TO_INDEX, () => {
        activeWindow?.loadFile(path.join(__dirname, '../../renderer/index.html'));
    });

    ipcMain.handle(IPC_CHANNELS.LOGIN, async (_event, credentials) => loginUser(credentials));
    ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => app.getVersion());
    ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => ({ apiBaseUrl: API_BASE_URL }));
    ipcMain.handle(IPC_CHANNELS.GET_UPDATE_STATE, () => updaterController?.getUpdateState?.() || null);
    ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, () => updaterController?.checkForUpdates?.(true) || null);
    ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, () => updaterController?.installUpdate?.() || null);
    ipcMain.handle(IPC_CHANNELS.TOGGLE_FULLSCREEN, () => updaterController?.toggleFullscreen?.() || { isFullScreen: false });
    ipcMain.handle(IPC_CHANNELS.GET_WINDOW_STATE, () => updaterController?.getWindowState?.() || { isFullScreen: false });
    ipcMain.handle(IPC_CHANNELS.API_REQUEST, async (_event, options) => requestJson(options));

    ipcMain.handle(IPC_CHANNELS.UPLOAD_PUBLICIDAD, async (_event, { titulo, base64, mime, token }) => {
        try {
            const { buildApiUrl } = require('../services/http-client');
            const url = buildApiUrl('/publicidad');

            // Reconstruct Buffer from base64
            const buffer = Buffer.from(base64, 'base64');

            // Build Multipart Body manually or use FormData if node-fetch/form-data is present.
            // Since we are in Electron 31, global fetch/FormData should work.
            const formData = new FormData();
            formData.append('titulo', titulo || 'Sin titulo');

            // FormData file blob reconstruction
            const blob = new Blob([buffer], { type: mime });
            formData.append('imagen', blob, 'upload.jpg');

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const text = await response.text();
            try {
                return { ok: response.ok, status: response.status, data: JSON.parse(text) };
            } catch {
                return { ok: response.ok, status: response.status, data: text };
            }
        } catch (error) {
            console.error('Error in UPLOAD_PUBLICIDAD handler:', error);
            return { ok: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.GET_SII_CONFIG, () => {
        const configPath = path.join(getSiiDataDir(), 'config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return {};
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_SII_CONFIG, (_event, config) => {
        const configPath = path.join(getSiiDataDir(), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.UPLOAD_SII_FILE, (_event, { type, filename, base64Data }) => {
        try {
            const rawBase64 = base64Data.replace(/^data:.*?;base64,/, "");
            const buffer = Buffer.from(rawBase64, 'base64');
            const destPath = path.join(getSiiDataDir(), filename);
            fs.writeFileSync(destPath, buffer);
            return { success: true, path: destPath, filename };
        } catch (err) {
            console.error("Error saving SII file:", err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('SIGN_ENVIO_DTE', async (_event, { dteXmls, rutEmisor, rutEnvia, fechaResol, nroResol, certBase64Data, certPassword }) => {
        try {
            const { parsePfxBuffer, buildEnvioDTE, signEnvioDTE } = require('../services/sii-envelope');
            
            const certBuffer = Buffer.from(certBase64Data, 'base64');
            const { privateKeyPem, certBase64, modulusBase64, exponentBase64 } = parsePfxBuffer(certBuffer, certPassword);
            
            const dteBuffers = dteXmls.map(dte => {
                if (dte?.type === 'Buffer' && Array.isArray(dte.data)) return Buffer.from(dte.data);
                if (dte instanceof Uint8Array || dte instanceof ArrayBuffer) return Buffer.from(dte);
                return Buffer.from(dte);
            });

            const { xml: unsignedEnvelope, setDteId } = buildEnvioDTE(dteBuffers, rutEmisor, rutEnvia, fechaResol, nroResol);
            const signedBuffer = signEnvioDTE(unsignedEnvelope, setDteId, privateKeyPem, certBase64, modulusBase64, exponentBase64);
            
            return { success: true, envelopeBuffer: signedBuffer };
        } catch (error) {
            console.error("Error signing EnvioDTE:", error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.READ_LOCAL_CERT, async (_event, filePath) => {
        try {
            const fullPath = path.join(getSiiDataDir(), filePath);
            if (!fs.existsSync(fullPath)) return null;
            const buffer = fs.readFileSync(fullPath);
            return buffer.toString('base64');
        } catch (e) {
            console.error("Error reading certificate:", e);
            return null;
        }
    });

    ipcMain.handle(IPC_CHANNELS.READ_LOCAL_TEXT, async (_event, filePath) => {
        try {
            const fullPath = path.join(getSiiDataDir(), filePath);
            if (!fs.existsSync(fullPath)) return null;
            return fs.readFileSync(fullPath, 'utf8');
        } catch (e) {
            console.error("Error reading text file:", e);
            return null;
        }
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_XML, async (_event, { filename, data, folder }) => {
        try {
            const folderPath = getInvoiceFolderPath(folder);
            ensureDir(folderPath);

            const fullPath = path.join(folderPath, filename);
            fs.writeFileSync(fullPath, bufferFromPayload(data));

            return { success: true, path: fullPath, filename };
        } catch (error) {
            console.error('Error saving invoice file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.LIST_INVOICES, async (_event, folder) => {
        try {
            const folderPath = getInvoiceFolderPath(folder);
            ensureDir(folderPath);

            const entries = fs.readdirSync(folderPath, { withFileTypes: true });
            return entries
                .filter((entry) => entry.isFile())
                .map((entry) => {
                    const fullPath = path.join(folderPath, entry.name);
                    const stats = fs.statSync(fullPath);
                    return {
                        name: entry.name,
                        ext: path.extname(entry.name).toLowerCase(),
                        folder,
                        path: fullPath,
                        size: stats.size,
                        modifiedAt: stats.mtime.toISOString()
                    };
                });
        } catch (error) {
            console.error('Error listing invoice files:', error);
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async (_event, filePath) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, error: 'Archivo no encontrado' };
            }

            const result = await shell.openPath(filePath);
            if (result) {
                return { success: false, error: result };
            }

            return { success: true };
        } catch (error) {
            console.error('Error opening file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_INVOICE_FILES, async (_event, filename) => {
        try {
            if (!filename) {
                return { success: false, error: 'Nombre de archivo requerido' };
            }

            const deleted = [];
            const xmlCandidate = filename.toLowerCase().endsWith('.xml') ? filename : `${filename}.xml`;
            const pdfCandidate = xmlCandidate.replace(/\.xml$/i, '.pdf');

            for (const folder of invoiceFolders) {
                const folderPath = getInvoiceFolderPath(folder);
                if (!fs.existsSync(folderPath)) {
                    continue;
                }

                for (const candidate of [xmlCandidate, pdfCandidate]) {
                    const targetPath = path.join(folderPath, candidate);
                    if (fs.existsSync(targetPath)) {
                        fs.unlinkSync(targetPath);
                        deleted.push(targetPath);
                    }
                }
            }

            return { success: true, deleted };
        } catch (error) {
            console.error('Error deleting local invoice files:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.GET_PRINTERS, async () => {
        if (!activeWindow || activeWindow.isDestroyed()) {
            return [];
        }

        const printers = await activeWindow.webContents.getPrintersAsync();
        return printers.map((printer) => ({
            name: printer.name,
            displayName: printer.displayName || printer.name,
            description: printer.description || '',
            status: printer.status || 0,
            isDefault: Boolean(printer.isDefault)
        }));
    });

    ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_event, payload) => {
        try {
            return await runPythonReceiptPrint(payload || {});
        } catch (error) {
            return {
                ok: false,
                error: error?.message || 'No se pudo imprimir el comprobante.'
            };
        }
    });

    ipcMain.handle(IPC_CHANNELS.QUERY_SII_STATUS, async (_event, { rutEmpresa, rutFirma, trackId, token }) => {
        try {
            if (!trackId || !token || !rutEmpresa || !rutFirma) {
                return { success: false, error: 'Faltan parámetros requeridos para la consulta SII' };
            }

            const parseRut = (rutStr) => {
                const clean = String(rutStr).replace(/[^0-9kK]/g, '').toUpperCase();
                return { rut: clean.slice(0, -1) || '0', dv: clean.slice(-1) || '0' };
            };

            const emp = parseRut(rutEmpresa);
            const frm = parseRut(rutFirma);

            const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:def="http://DefaultNamespace">
   <soapenv:Header/>
   <soapenv:Body>
      <def:getEstUp soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
         <RutCompania xsi:type="xsd:string">${emp.rut}</RutCompania>
         <DvCompania xsi:type="xsd:string">${emp.dv}</DvCompania>
         <RutFirma xsi:type="xsd:string">${frm.rut}</RutFirma>
         <DvFirma xsi:type="xsd:string">${frm.dv}</DvFirma>
         <TrackId xsi:type="xsd:string">${trackId}</TrackId>
         <Token xsi:type="xsd:string">${token}</Token>
      </def:getEstUp>
   </soapenv:Body>
</soapenv:Envelope>`;

            const response = await fetch('https://palena.sii.cl/DTEWS/QueryEstUp.jws', {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
                body: soapBody
            });

            const text = await response.text();
            
            const match = text.match(/<getEstUpReturn[^>]*>([\s\S]*?)<\/getEstUpReturn>/i);
            if (!match) return { success: false, error: 'El SII no devolvió un formato válido', raw: text };
            
            const decoded = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            return { success: true, result: decoded };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.QUERY_SII_DTE_STATUS, async (_event, { rutEmpresa, rutFirma, token, tipoDte, folio, rutReceptor, monto, fecha }) => {
        try {
            if (!tipoDte || !folio || !monto || !fecha) {
                return { success: false, error: 'Faltan parámetros del documento para la consulta por Folio' };
            }

            const parseRut = (rutStr) => {
                const clean = String(rutStr).replace(/[^0-9kK]/g, '').toUpperCase();
                return { rut: clean.slice(0, -1) || '0', dv: clean.slice(-1) || '0' };
            };

            const emp = parseRut(rutEmpresa);
            const frm = parseRut(rutFirma);
            const rec = parseRut(rutReceptor || '66666666-6');

            // Fecha formato DD-MM-YYYY
            const d = new Date(fecha);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

            const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:def="http://DefaultNamespace">
   <soapenv:Header/>
   <soapenv:Body>
      <def:getEstDte soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
         <RutConsultante xsi:type="xsd:string">${frm.rut}</RutConsultante>
         <DvConsultante xsi:type="xsd:string">${frm.dv}</DvConsultante>
         <RutCompania xsi:type="xsd:string">${emp.rut}</RutCompania>
         <DvCompania xsi:type="xsd:string">${emp.dv}</DvCompania>
         <RutReceptor xsi:type="xsd:string">${rec.rut}</RutReceptor>
         <DvReceptor xsi:type="xsd:string">${rec.dv}</DvReceptor>
         <TipoDte xsi:type="xsd:string">${tipoDte}</TipoDte>
         <FolioDte xsi:type="xsd:string">${folio}</FolioDte>
         <FechaEmisionDte xsi:type="xsd:string">${dateStr}</FechaEmisionDte>
         <MontoDte xsi:type="xsd:string">${Math.round(monto)}</MontoDte>
         <Token xsi:type="xsd:string">${token}</Token>
      </def:getEstDte>
   </soapenv:Body>
</soapenv:Envelope>`;

            const response = await fetch('https://palena.sii.cl/DTEWS/QueryEstDte.jws', {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
                body: soapBody
            });

            const text = await response.text();
            
            const match = text.match(/<getEstDteReturn[^>]*>([\s\S]*?)<\/getEstDteReturn>/i);
            if (!match) return { success: false, error: 'El SII no devolvió un formato válido', raw: text };
            
            const decoded = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            return { success: true, result: decoded };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.QUERY_SII_BOLETA_STATUS, async (_event, { rutEmpresa, trackId, token }) => {
        try {
            if (!trackId || !token || !rutEmpresa) {
                return { success: false, error: 'Faltan parámetros requeridos' };
            }
            const cleanRut = String(rutEmpresa).replace(/[^0-9kK]/gi, '');
            const rut = cleanRut.slice(0, -1);
            const dv = cleanRut.slice(-1).toUpperCase();

            const response = await fetch(`https://api.sii.cl/recursos/v1/boleta.electronica.envio/${rut}-${dv}-${trackId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errTxt = await response.text();
                return { success: false, error: `Error HTTP ${response.status}`, raw: errTxt };
            }

            const json = await response.json();
            return { success: true, result: JSON.stringify(json, null, 2), json };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.QUERY_SII_BOLETA_DTE_STATUS, async (_event, { rutEmpresa, rutReceptor, tipoDte, folio, token, monto, fecha }) => {
        try {
            if (!tipoDte || !folio || !token || !rutEmpresa) {
                return { success: false, error: 'Faltan parámetros requeridos' };
            }
            const cleanRut = String(rutEmpresa).replace(/[^0-9kK]/gi, '');
            const rut = cleanRut.slice(0, -1);
            const dv = cleanRut.slice(-1).toUpperCase();

            const recClean = String(rutReceptor || '66666666-6').replace(/[^0-9kK]/gi, '');
            const rutRec = recClean.slice(0, -1);
            const dvRec = recClean.slice(-1).toUpperCase();

            // Format date for REST API (DD-MM-YYYY)
            const d = new Date(fecha);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

            const response = await fetch(`https://api.sii.cl/recursos/v1/boleta.electronica/${rut}-${dv}-${tipoDte}-${folio}?rutReceptor=${rutRec}&dvReceptor=${dvRec}&fechaEmision=${dateStr}&montoTotal=${Math.round(monto)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errTxt = await response.text();
                return { success: false, error: `Error HTTP ${response.status}`, raw: errTxt };
            }

            const json = await response.json();
            return { success: true, result: JSON.stringify(json, null, 2), json };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    isRegistered = true;
}

module.exports = {
    registerIpcHandlers
};
