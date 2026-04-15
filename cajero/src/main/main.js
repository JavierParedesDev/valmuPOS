const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { createUpdateManager } = require('./updater/update-manager');

let mainWindow = null;
let customerDisplayWindows = [];
let updateManager = null;
let lastCustomerDisplayPayload = {
    mode: 'idle',
    branchName: 'Sucursal',
    cashierName: 'Cajero',
    documentType: 'Boleta',
    customerLabel: 'Cliente general',
    itemsCount: 0,
    totalLabel: '$0',
    statusLabel: 'Pantalla cliente lista',
    cart: []
};

function buildAppMenu() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { role: 'reload', label: 'Recargar' },
                { role: 'forceReload', label: 'Forzar recarga' },
                { type: 'separator' },
                { role: 'quit', label: 'Salir' }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { role: 'undo', label: 'Deshacer' },
                { role: 'redo', label: 'Rehacer' },
                { type: 'separator' },
                { role: 'cut', label: 'Cortar' },
                { role: 'copy', label: 'Copiar' },
                { role: 'paste', label: 'Pegar' },
                { role: 'selectAll', label: 'Seleccionar todo' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'togglefullscreen', label: 'Pantalla completa' },
                { role: 'toggleDevTools', label: 'Herramientas de desarrollador' }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { role: 'minimize', label: 'Minimizar' },
                { role: 'close', label: 'Cerrar' }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let siiDataDir = '';

function ensureSiiDataDir() {
    if (!siiDataDir) {
        siiDataDir = path.join(app.getPath('userData'), 'sii_data');
    }
    if (!fsSync.existsSync(siiDataDir)) {
        fsSync.mkdirSync(siiDataDir, { recursive: true });
    }
}

const invoiceFolders = ['facturas', 'boletas'];

function getSiiConfigPath() {
    ensureSiiDataDir();
    return path.join(siiDataDir, 'config.json');
}

function ensureInvoiceFolder(folder = '') {
    ensureSiiDataDir();
    const safeFolder = invoiceFolders.includes(String(folder || '').trim()) ? String(folder || '').trim() : 'facturas';
    const fullPath = path.join(siiDataDir, safeFolder);
    if (!fsSync.existsSync(fullPath)) {
        fsSync.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
}

function bufferFromBase64Payload(base64Data) {
    const rawBase64 = String(base64Data || '').replace(/^data:.*?;base64,/, '');
    return Buffer.from(rawBase64, 'base64');
}

function getReceiptPrinterScriptPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'scripts', 'receipt_printer.exe');
    }

    const pythonPath = path.join(__dirname, '../../scripts/receipt_printer.py');
    if (fsSync.existsSync(pythonPath)) {
        return pythonPath;
    }

    return path.join(__dirname, '../../scripts/receipt_printer.exe');
}

function getReceiptLogoPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets', 'logo.png');
    }

    return path.join(__dirname, '../renderer/assets/logo.png');
}

async function runPythonReceiptPrint(payload) {
    const scriptPath = getReceiptPrinterScriptPath();
    const tempPath = path.join(os.tmpdir(), `valmu-receipt-${Date.now()}.json`);
    const bridgePayload = {
        ...payload,
        logoPath: getReceiptLogoPath()
    };

    await fs.writeFile(tempPath, JSON.stringify(bridgePayload), 'utf8');

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
        await fs.unlink(tempPath).catch(() => { });
    }
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1180,
        minHeight: 760,
        backgroundColor: '#1c1410',
        autoHideMenuBar: false,
        title: 'Valmu Cajero',
        icon: getReceiptLogoPath(),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false,
        fullscreen: true
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

function sendToMainWindow(channel, payload) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send(channel, payload);
}

function getCustomerDisplayFilePath() {
    return path.join(__dirname, '../renderer/customer-display.html');
}

function getCustomerDisplayBounds() {
    const displays = screen.getAllDisplays();
    if (displays.length < 2) {
        return null;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    return displays.filter((display) => display.id !== primaryDisplay.id);
}

function sendCustomerDisplayState(payload) {
    lastCustomerDisplayPayload = {
        ...lastCustomerDisplayPayload,
        ...(payload || {})
    };

    if (!Array.isArray(customerDisplayWindows) || customerDisplayWindows.length === 0) {
        return;
    }

    customerDisplayWindows.forEach((win) => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('display:customer-update', lastCustomerDisplayPayload);
        }
    });
}

function createCustomerDisplayWindow() {
    const externalDisplays = getCustomerDisplayBounds();

    // Si ya hay ventanas abiertas, las enfocamos y actualizamos
    if (customerDisplayWindows.length > 0) {
        customerDisplayWindows.forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.focus();
            }
        });
        sendCustomerDisplayState(lastCustomerDisplayPayload);
        return;
    }

    const displaysToUse = (externalDisplays && externalDisplays.length > 0)
        ? externalDisplays
        : [screen.getPrimaryDisplay()]; // Fallback a la principal si no hay externas

    displaysToUse.forEach((display, index) => {
        const baseOptions = {
            width: 1024,
            height: 768,
            minWidth: 800,
            minHeight: 600,
            backgroundColor: '#241710',
            autoHideMenuBar: false,
            title: `Valmu Cliente ${index + 1}`,
            webPreferences: {
                preload: path.join(__dirname, '../preload/preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            },
            show: false,
            fullscreen: true,
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height
        };

        const win = new BrowserWindow(baseOptions);
        win.loadFile(getCustomerDisplayFilePath());

        win.once('ready-to-show', () => {
            win.show();
        });

        win.webContents.on('did-finish-load', () => {
            win.webContents.send('display:customer-update', lastCustomerDisplayPayload);
        });

        win.on('closed', () => {
            customerDisplayWindows = customerDisplayWindows.filter((w) => w !== win);
        });

        customerDisplayWindows.push(win);
    });
}

function closeCustomerDisplayWindow() {
    if (customerDisplayWindows.length === 0) {
        return false;
    }

    const windowsToClose = [...customerDisplayWindows];
    windowsToClose.forEach((win) => {
        if (win && !win.isDestroyed()) {
            win.close();
        }
    });

    customerDisplayWindows = [];
    return true;
}

function normalizeGithubRepo(rawRepo) {
    return String(rawRepo || '')
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\/+$/, '');
}

function parseVersionParts(version) {
    return String(version || '')
        .trim()
        .replace(/^v/i, '')
        .split('.')
        .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
    const leftParts = parseVersionParts(left);
    const rightParts = parseVersionParts(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftValue = leftParts[index] || 0;
        const rightValue = rightParts[index] || 0;

        if (leftValue > rightValue) return 1;
        if (leftValue < rightValue) return -1;
    }

    return 0;
}

function registerIpcHandlers() {
    ensureSiiDataDir();

    ipcMain.handle('app:get-version', async () => app.getVersion());
    ipcMain.handle('update:get-state', async () => updateManager?.getUpdateState?.() || null);
    ipcMain.handle('update:check', async () => updateManager?.checkForUpdates?.(true) || null);
    ipcMain.handle('update:download', async () => updateManager?.downloadUpdate?.() || null);
    ipcMain.handle('update:install', async () => updateManager?.installUpdate?.() || null);

    ipcMain.handle('settings:get-printers', async () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return [];
        }

        const printers = await mainWindow.webContents.getPrintersAsync();
        return printers.map((printer) => ({
            name: printer.name,
            displayName: printer.displayName || printer.name,
            description: printer.description || '',
            status: printer.status || 0,
            isDefault: Boolean(printer.isDefault)
        }));
    });

    ipcMain.handle('printer:print-receipt', async (_event, payload) => {
        try {
            return await runPythonReceiptPrint(payload || {});
        } catch (error) {
            return {
                ok: false,
                error: error?.message || 'No se pudo imprimir el comprobante.'
            };
        }
    });

    ipcMain.handle('display:open-customer', async () => {
        createCustomerDisplayWindow();
        return {
            ok: true,
            isOpen: true
        };
    });

    ipcMain.handle('display:close-customer', async () => ({
        ok: true,
        isOpen: !closeCustomerDisplayWindow()
    }));

    ipcMain.handle('display:update-customer', async (_event, payload) => {
        sendCustomerDisplayState(payload || {});
        return {
            ok: true,
            isOpen: customerDisplayWindows.length > 0
        };
    });

    ipcMain.handle('display:get-customer-state', async () => ({
        ok: true,
        isOpen: customerDisplayWindows.length > 0,
        payload: lastCustomerDisplayPayload
    }));

    ipcMain.handle('app:toggle-fullscreen', async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return false;
        const isFullScreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullScreen);
        return !isFullScreen;
    });

    ipcMain.handle('sii:get-config', async () => {
        try {
            const configPath = getSiiConfigPath();
            if (!fsSync.existsSync(configPath)) {
                return {};
            }

            return JSON.parse(await fs.readFile(configPath, 'utf8'));
        } catch (error) {
            console.error('SII config read error:', error);
            return {};
        }
    });

    ipcMain.handle('sii:save-config', async (_event, config) => {
        try {
            const configPath = getSiiConfigPath();
            await fs.writeFile(configPath, JSON.stringify(config || {}, null, 2), 'utf8');
            return { success: true };
        } catch (error) {
            console.error('SII config save error:', error);
            return { success: false, error: error?.message || 'sii_config_save_failed' };
        }
    });

    ipcMain.handle('sii:upload-file', async (_event, { filename, base64Data }) => {
        try {
            ensureSiiDataDir();
            const targetPath = path.join(siiDataDir, String(filename || '').trim());
            await fs.writeFile(targetPath, bufferFromBase64Payload(base64Data));
            return { success: true, path: targetPath, filename: path.basename(targetPath) };
        } catch (error) {
            console.error('SII file upload error:', error);
            return { success: false, error: error?.message || 'sii_file_upload_failed' };
        }
    });

    ipcMain.handle('sii:read-local-cert', async (_event, filename) => {
        try {
            ensureSiiDataDir();
            const targetPath = path.join(siiDataDir, String(filename || '').trim());
            if (!fsSync.existsSync(targetPath)) {
                return null;
            }

            const buffer = await fs.readFile(targetPath);
            return buffer.toString('base64');
        } catch (error) {
            console.error('SII read cert error:', error);
            return null;
        }
    });

    ipcMain.handle('sii:read-local-text', async (_event, filename) => {
        try {
            ensureSiiDataDir();
            const targetPath = path.join(siiDataDir, String(filename || '').trim());
            if (!fsSync.existsSync(targetPath)) {
                return null;
            }

            return await fs.readFile(targetPath, 'utf8');
        } catch (error) {
            console.error('SII read text error:', error);
            return null;
        }
    });

    ipcMain.handle('sii:save-xml', async (_event, { filename, data, folder }) => {
        try {
            const folderPath = ensureInvoiceFolder(folder);
            const targetPath = path.join(folderPath, String(filename || '').trim());
            await fs.writeFile(targetPath, typeof data === 'string' ? data : String(data || ''), 'utf8');
            return { success: true, path: targetPath, filename: path.basename(targetPath) };
        } catch (error) {
            console.error('SII save xml error:', error);
            return { success: false, error: error?.message || 'sii_save_xml_failed' };
        }
    });
}

app.whenReady().then(() => {
    updateManager = createUpdateManager({
        app,
        getMainWindow: () => mainWindow,
        sendToWindow: sendToMainWindow
    });

    buildAppMenu();
    createMainWindow();
    registerIpcHandlers();
    updateManager.initialize();
    mainWindow?.once('ready-to-show', () => {
        updateManager?.sendStateToWindow?.();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            mainWindow?.once('ready-to-show', () => {
                updateManager?.sendStateToWindow?.();
            });
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
