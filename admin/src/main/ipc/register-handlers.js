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

// Ensure a local directory exists for SII files, as requested by the user to avoid Windows strictness issues.
const siiDataDir = path.join(process.cwd(), 'sii_data');
if (!fs.existsSync(siiDataDir)) {
    fs.mkdirSync(siiDataDir, { recursive: true });
}

let activeWindow = null;
let isRegistered = false;
let updaterController = null;
const invoiceFolders = ['facturas', 'notas_de_credito', 'notas_de_debito'];

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getInvoiceFolderPath(folder = '') {
    const safeFolder = String(folder || '').trim();
    return path.join(siiDataDir, safeFolder);
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
        const configPath = path.join(siiDataDir, 'config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return {};
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_SII_CONFIG, (_event, config) => {
        const configPath = path.join(siiDataDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.UPLOAD_SII_FILE, (_event, { type, filename, base64Data }) => {
        try {
            const rawBase64 = base64Data.replace(/^data:.*?;base64,/, "");
            const buffer = Buffer.from(rawBase64, 'base64');
            const destPath = path.join(siiDataDir, filename);
            fs.writeFileSync(destPath, buffer);
            return { success: true, path: destPath, filename };
        } catch (err) {
            console.error("Error saving SII file:", err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle(IPC_CHANNELS.READ_LOCAL_CERT, async (_event, filePath) => {
        try {
            const fullPath = path.join(siiDataDir, filePath);
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
            const fullPath = path.join(siiDataDir, filePath);
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

    isRegistered = true;
}

module.exports = {
    registerIpcHandlers
};
