const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createUpdateManager } = require('./updater/update-manager');
const forge = require('node-forge');
const siiDirect = require('./sii-direct');

let mainWindow = null;
let customerDisplayWindows = [];
let customerDisplayDesiredOpen = false;
let customerDisplayTargetId = '';
let customerDisplayResyncTimer = null;
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
let localAuditDir = '';
let printDebugDir = '';

function ensureSiiDataDir() {
    if (!siiDataDir) {
        siiDataDir = path.join(app.getPath('userData'), 'sii_data');
    }
    if (!fsSync.existsSync(siiDataDir)) {
        fsSync.mkdirSync(siiDataDir, { recursive: true });
    }
}

function ensureLocalAuditDir() {
    if (!localAuditDir) {
        localAuditDir = path.join(app.getPath('userData'), 'local_audit');
    }
    if (!fsSync.existsSync(localAuditDir)) {
        fsSync.mkdirSync(localAuditDir, { recursive: true });
    }
}

function ensurePrintDebugDir() {
    if (!printDebugDir) {
        printDebugDir = path.join(app.getPath('userData'), 'print-debug');
    }
    if (!fsSync.existsSync(printDebugDir)) {
        fsSync.mkdirSync(printDebugDir, { recursive: true });
    }
}

async function writePrintDebugFile(filename, data) {
    ensurePrintDebugDir();
    const targetPath = path.join(printDebugDir, filename);
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf8');
    return targetPath;
}

function getLocalAuditPath() {
    ensureLocalAuditDir();
    return path.join(localAuditDir, 'current-turn-sales-audit.json');
}

function buildDefaultLocalAudit() {
    return {
        turnId: null,
        openedAt: null,
        resetAt: new Date().toISOString(),
        updatedAt: null,
        openingCash: 0,
        salesCount: 0,
        totals: {
            cash: 0,
            card: 0,
            transfer: 0
        },
        entries: []
    };
}

async function readLocalAuditFile() {
    try {
        const filePath = getLocalAuditPath();
        if (!fsSync.existsSync(filePath)) {
            const initialData = buildDefaultLocalAudit();
            await fs.writeFile(filePath, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }

        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (error) {
        console.error('Local audit read error:', error);
        return buildDefaultLocalAudit();
    }
}

async function writeLocalAuditFile(payload) {
    const filePath = getLocalAuditPath();
    await fs.writeFile(filePath, JSON.stringify(payload || buildDefaultLocalAudit(), null, 2), 'utf8');
}

const invoiceFolders = ['facturas', 'boletas'];

function getSiiConfigPath() {
    ensureSiiDataDir();
    return path.join(siiDataDir, 'config.json');
}

function maskSecret(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }
    if (text.length <= 8) {
        return '*'.repeat(text.length);
    }
    return `${text.slice(0, 4)}${'*'.repeat(Math.max(0, text.length - 8))}${text.slice(-4)}`;
}

async function sha256File(filePath) {
    try {
        if (!fsSync.existsSync(filePath)) {
            return null;
        }

        const hash = crypto.createHash('sha256');
        const buffer = await fs.readFile(filePath);
        hash.update(buffer);
        return hash.digest('hex').toUpperCase();
    } catch (error) {
        console.error('SII hash error:', error);
        return null;
    }
}

function getFileDiagnostic(filePath) {
    try {
        if (!fsSync.existsSync(filePath)) {
            return {
                exists: false,
                path: filePath,
                filename: path.basename(filePath || ''),
                length: null,
                lastWriteTime: null,
                sha256: null
            };
        }

        const stats = fsSync.statSync(filePath);
        return {
            exists: true,
            path: filePath,
            filename: path.basename(filePath),
            length: stats.size,
            lastWriteTime: stats.mtime.toISOString(),
            sha256: null
        };
    } catch (error) {
        return {
            exists: false,
            path: filePath,
            filename: path.basename(filePath || ''),
            length: null,
            lastWriteTime: null,
            sha256: null,
            error: error?.message || 'file_diagnostic_failed'
        };
    }
}

async function getCertificateDiagnostic({ configPath, certPath }) {
    if (!fsSync.existsSync(configPath) || !fsSync.existsSync(certPath)) {
        return {
            ok: false,
            error: 'Falta config.json o certificado.pfx para validar el certificado.'
        };
    }

    const psScript = `
$ErrorActionPreference = "Stop"
$config = Get-Content -LiteralPath '${configPath.replace(/'/g, "''")}' -Raw | ConvertFrom-Json
$password = ConvertTo-SecureString ([string]$config.certPassword) -AsPlainText -Force
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
    '${certPath.replace(/'/g, "''")}',
    $password,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
)
[pscustomobject]@{
    ok = $true
    subject = $cert.Subject
    issuer = $cert.Issuer
    notBefore = $cert.NotBefore.ToString("o")
    notAfter = $cert.NotAfter.ToString("o")
    hasPrivateKey = $cert.HasPrivateKey
    thumbprint = $cert.Thumbprint
    serialNumber = $cert.SerialNumber
} | ConvertTo-Json -Compress
`;

    return await new Promise((resolve) => {
        const child = spawn('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            psScript
        ], {
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += String(chunk || '');
        });
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk || '');
        });
        child.on('error', (error) => {
            resolve({
                ok: false,
                error: error?.message || 'No se pudo abrir PowerShell para validar el certificado.'
            });
        });
        child.on('close', (code) => {
            if (code !== 0) {
                resolve({
                    ok: false,
                    error: stderr.trim() || stdout.trim() || `PowerShell termino con codigo ${code}.`
                });
                return;
            }

            try {
                resolve(JSON.parse(stdout.trim()));
            } catch (error) {
                resolve({
                    ok: false,
                    error: error?.message || 'No se pudo interpretar el diagnostico del certificado.'
                });
            }
        });
    });
}

async function buildSiiDiagnostic() {
    ensureSiiDataDir();

    const configPath = getSiiConfigPath();
    let config = {};
    if (fsSync.existsSync(configPath)) {
        try {
            config = JSON.parse(await fs.readFile(configPath, 'utf8'));
        } catch (error) {
            config = {};
        }
    }

    const certFilename = String(config.certFilename || 'certificado.pfx').trim();
    const caf39Filename = String(config.caf_39_filename || 'CAF_39.xml').trim();
    const caf33Filename = String(config.caf_33_filename || 'CAF_33.xml').trim();

    const files = {
        config: getFileDiagnostic(configPath),
        certificado: getFileDiagnostic(path.join(siiDataDir, certFilename)),
        caf39: getFileDiagnostic(path.join(siiDataDir, caf39Filename)),
        caf33: getFileDiagnostic(path.join(siiDataDir, caf33Filename))
    };

    await Promise.all(Object.values(files).map(async (fileInfo) => {
        if (fileInfo.exists) {
            fileInfo.sha256 = await sha256File(fileInfo.path);
        }
    }));

    const certificate = await getCertificateDiagnostic({
        configPath,
        certPath: files.certificado.path
    });

    return {
        generatedAt: new Date().toISOString(),
        userDataPath: app.getPath('userData'),
        siiDataDir,
        config: {
            rutEmisor: String(config.rutEmisor || ''),
            rutEnvia: String(config.rutEnvia || ''),
            siiAmbiente: String(config.siiAmbiente || ''),
            certFilename,
            caf39Filename,
            caf33Filename,
            apiKeyMasked: maskSecret(config.apiKey),
            certPasswordMasked: maskSecret(config.certPassword)
        },
        files,
        certificate
    };
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
    const debugStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bridgePayload = {
        ...payload,
        logoPath: getReceiptLogoPath()
    };

    await fs.writeFile(tempPath, JSON.stringify(bridgePayload), 'utf8');
    await writePrintDebugFile('latest-payload.json', bridgePayload).catch(() => { });
    await writePrintDebugFile(`payload-${debugStamp}.json`, bridgePayload).catch(() => { });

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
                async (error, stdout, stderr) => {
                    const rawResult = {
                        at: new Date().toISOString(),
                        scriptPath,
                        command,
                        args,
                        error: error ? {
                            message: error.message,
                            code: error.code,
                            signal: error.signal
                        } : null,
                        stdout: String(stdout || ''),
                        stderr: String(stderr || '')
                    };
                    await writePrintDebugFile('latest-result.json', rawResult).catch(() => { });
                    await writePrintDebugFile(`result-${debugStamp}.json`, rawResult).catch(() => { });

                    if (error) {
                        resolve({
                            ok: false,
                            error: stderr?.trim() || stdout?.trim() || error.message,
                            debugDir: printDebugDir
                        });
                        return;
                    }

                    try {
                        const parsed = JSON.parse(String(stdout || '').trim() || '{}');
                        resolve(parsed?.ok === false ? { ...parsed, debugDir: printDebugDir } : parsed);
                    } catch (_parseError) {
                        resolve({
                            ok: false,
                            error: stderr?.trim() || 'Python no devolvio una respuesta valida.',
                            debugDir: printDebugDir
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
        autoHideMenuBar: true,
        frame: false,
        title: 'Valmu Cajero',
        icon: getReceiptLogoPath(),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
            backgroundThrottling: true,
            devTools: true
        },
        show: false,
        fullscreen: true
    });

    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const key = String(input.key || '').toLowerCase();
        const shouldToggleDevTools = key === 'f12' || ((input.control || input.meta) && input.shift && key === 'i');
        if (!shouldToggleDevTools) {
            return;
        }

        event.preventDefault();
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.setAlwaysOnTop(false);
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.moveTop();
    });

    mainWindow.on('focus', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.moveTop();
    });

    mainWindow.on('closed', () => {
        closeCustomerDisplayWindow();
        mainWindow = null;
        if (!app.isQuiting) {
            app.quit();
        }
    });

    mainWindow.on('enter-full-screen', () => {
        mainWindow?.webContents?.send('window:fullscreen', true);
    });
    
    mainWindow.on('leave-full-screen', () => {
        mainWindow?.webContents?.send('window:fullscreen', false);
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

function getCustomerDisplayTargets() {
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay()?.id;
    const externalDisplays = displays.filter((display) => display.id !== primaryId);
    const selectedDisplay = customerDisplayTargetId
        ? displays.find((display) => String(display?.id) === String(customerDisplayTargetId))
        : null;

    if (customerDisplayTargetId === 'all-external') {
        return externalDisplays;
    }

    if (selectedDisplay && selectedDisplay.id !== primaryId) {
        return [selectedDisplay];
    }

    if (externalDisplays.length > 0) {
        // Por defecto elegimos la ÚLTIMA pantalla externa (la 3ra en un setup de 3)
        // ya que suele ser la que mira el cliente.
        return [externalDisplays[externalDisplays.length - 1]];
    }

    return [];
}

function listCustomerDisplayTargets() {
    const primaryId = screen.getPrimaryDisplay()?.id;
    const externalDisplays = screen.getAllDisplays().filter((display) => display.id !== primaryId);
    const suggestedDisplayId = externalDisplays.length > 0
        ? String(externalDisplays[externalDisplays.length - 1].id)
        : '';

    return externalDisplays
        .map((display, index) => ({
            id: String(display.id),
            label: `Pantalla cliente ${index + 1} (${display.bounds.width}x${display.bounds.height})`,
            isSuggested: String(display.id) === suggestedDisplayId,
            isPrimary: false,
            isInternal: display?.internal === true,
            bounds: display.bounds
        }));
}

function getDisplayKey(display) {
    return String(display?.id || `${display?.bounds?.x || 0}:${display?.bounds?.y || 0}`);
}

function getWindowDisplayKey(win) {
    if (!win || win.isDestroyed()) {
        return '';
    }

    return String(win.__customerDisplayKey || '');
}

function hardenCustomerDisplayWindow(win, display) {
    if (!win || win.isDestroyed()) {
        return;
    }

    const bounds = display?.bounds || screen.getPrimaryDisplay().bounds;
    const currentBounds = win.getBounds();
    win.__customerDisplayKey = getDisplayKey(display);

    win.setMenuBarVisibility(false);
    win.setAutoHideMenuBar(true);
    win.setAlwaysOnTop(true, 'floating');
    win.setFullScreenable(true);
    win.setKiosk(true);

    if (
        currentBounds.x !== bounds.x
        || currentBounds.y !== bounds.y
        || currentBounds.width !== bounds.width
        || currentBounds.height !== bounds.height
    ) {
        win.setBounds(bounds);
    }

    if (!win.isFullScreen()) {
        win.setFullScreen(true);
    }

    if (!win.isVisible()) {
        win.showInactive();
    }
}

function attachCustomerDisplayGuards(win) {
    if (!win || win.isDestroyed() || win.__customerDisplayGuardsAttached) {
        return;
    }

    win.__customerDisplayGuardsAttached = true;

    const reapplyWindowMode = () => {
        if (!customerDisplayDesiredOpen || !win || win.isDestroyed()) {
            return;
        }

        const targetDisplay = screen.getAllDisplays().find((display) => getDisplayKey(display) === getWindowDisplayKey(win))
            || screen.getDisplayMatching(win.getBounds())
            || screen.getPrimaryDisplay();
        hardenCustomerDisplayWindow(win, targetDisplay);
    };

    win.on('leave-full-screen', reapplyWindowMode);
    win.on('minimize', () => {
        if (!customerDisplayDesiredOpen || win.isDestroyed()) {
            return;
        }

        win.restore();
        reapplyWindowMode();
    });
    win.on('restore', reapplyWindowMode);
    win.on('closed', () => {
        customerDisplayWindows = customerDisplayWindows.filter((w) => w !== win);

        if (customerDisplayDesiredOpen) {
            setTimeout(() => {
                reconcileCustomerDisplayWindows();
                sendCustomerDisplayState(lastCustomerDisplayPayload);
            }, 250);
        }
    });
}

function createSingleCustomerDisplayWindow(display, index) {
    const bounds = display.bounds;
    const win = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#241710',
        autoHideMenuBar: true,
        title: `Valmu Cliente ${index + 1}`,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: false,
            backgroundThrottling: true,
            devTools: true
        },
        show: false,
        fullscreen: true,
        kiosk: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        x: bounds.x,
        y: bounds.y
    });

    win.loadFile(getCustomerDisplayFilePath());
    attachCustomerDisplayGuards(win);

    win.once('ready-to-show', () => {
        hardenCustomerDisplayWindow(win, display);
    });

    win.webContents.on('did-finish-load', () => {
        hardenCustomerDisplayWindow(win, display);
        win.webContents.send('display:customer-update', lastCustomerDisplayPayload);
    });

    customerDisplayWindows.push(win);
    return win;
}

function reconcileCustomerDisplayWindows() {
    if (!customerDisplayDesiredOpen) {
        return;
    }

    const targetDisplays = getCustomerDisplayTargets();
    const targetDisplayKeys = new Set(targetDisplays.map((display) => getDisplayKey(display)));

    customerDisplayWindows = customerDisplayWindows.filter((win) => win && !win.isDestroyed());

    customerDisplayWindows
        .filter((win) => !targetDisplayKeys.has(getWindowDisplayKey(win)))
        .forEach((win) => {
            if (!win.isDestroyed()) {
                win.close();
            }
        });

    customerDisplayWindows = customerDisplayWindows.filter((win) => {
        const key = getWindowDisplayKey(win);
        return key && targetDisplayKeys.has(key) && !win.isDestroyed();
    });

    targetDisplays.forEach((display, index) => {
        const displayKey = getDisplayKey(display);
        const existingWindow = customerDisplayWindows.find((win) => getWindowDisplayKey(win) === displayKey);

        if (existingWindow) {
            hardenCustomerDisplayWindow(existingWindow, display);
            return;
        }

        createSingleCustomerDisplayWindow(display, index);
    });
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

function createCustomerDisplayWindow(targetDisplayId = '') {
    customerDisplayDesiredOpen = true;
    customerDisplayTargetId = String(targetDisplayId || '').trim();
    reconcileCustomerDisplayWindows();
    sendCustomerDisplayState(lastCustomerDisplayPayload);
    return customerDisplayWindows.length > 0;
}

function closeCustomerDisplayWindow() {
    customerDisplayDesiredOpen = false;

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

    ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
    ipcMain.handle('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow?.unmaximize() : mainWindow?.maximize(); });
    ipcMain.handle('window:close', () => { mainWindow?.close(); });

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

    ipcMain.handle('display:open-customer', async (_event, payload) => {
        const isOpen = createCustomerDisplayWindow(payload?.targetDisplayId);
        return {
            ok: true,
            isOpen,
            reason: isOpen ? null : 'no-external-display'
        };
    });

    ipcMain.handle('display:list-targets', async () => {
        const displays = listCustomerDisplayTargets();
        return {
            ok: true,
            externalCount: displays.length,
            displays
        };
    });

    ipcMain.handle('display:close-customer', async () => {
        closeCustomerDisplayWindow();
        return {
            ok: true,
            isOpen: false
        };
    });

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

    ipcMain.handle('local-audit:get', async () => {
        try {
            return {
                success: true,
                path: getLocalAuditPath(),
                data: await readLocalAuditFile()
            };
        } catch (error) {
            return { success: false, error: error?.message || 'local_audit_get_failed' };
        }
    });

    ipcMain.handle('local-audit:reset', async (_event, payload) => {
        try {
            const openingCash = Number(payload?.openingCash || 0);
            const nextData = {
                ...buildDefaultLocalAudit(),
                turnId: payload?.turnId || null,
                openedAt: payload?.openedAt || null,
                resetAt: new Date().toISOString(),
                openingCash,
                totals: {
                    cash: openingCash,
                    card: 0,
                    transfer: 0
                }
            };
            await writeLocalAuditFile(nextData);
            return {
                success: true,
                path: getLocalAuditPath(),
                data: nextData
            };
        } catch (error) {
            console.error('Local audit reset error:', error);
            return { success: false, error: error?.message || 'local_audit_reset_failed' };
        }
    });

    ipcMain.handle('local-audit:append-sale', async (_event, payload) => {
        try {
            const currentData = await readLocalAuditFile();
            const paymentMethod = String(payload?.paymentMethod || '').toUpperCase();
            const cash = Number(payload?.cash || 0);
            const card = Number(payload?.card || 0);
            const transfer = Number(payload?.transfer || 0);
            const total = Number(payload?.total || 0);
            const entry = {
                id: String(payload?.saleId || `local-${Date.now()}`),
                createdAt: new Date().toISOString(),
                paymentMethod,
                total,
                cash,
                card,
                transfer,
                documentType: String(payload?.documentType || 'Venta'),
                origin: String(payload?.origin || 'CAJA').toUpperCase()
            };

            currentData.salesCount = Number(currentData.salesCount || 0) + 1;
            currentData.totals = {
                cash: Number(currentData?.totals?.cash || 0) + cash,
                card: Number(currentData?.totals?.card || 0) + card,
                transfer: Number(currentData?.totals?.transfer || 0) + transfer
            };
            currentData.entries = [entry, ...(Array.isArray(currentData.entries) ? currentData.entries : [])].slice(0, 500);
            currentData.updatedAt = new Date().toISOString();

            await writeLocalAuditFile(currentData);
            return {
                success: true,
                path: getLocalAuditPath(),
                data: currentData
            };
        } catch (error) {
            console.error('Local audit append error:', error);
            return { success: false, error: error?.message || 'local_audit_append_failed' };
        }
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

    ipcMain.handle('sii:get-diagnostics', async () => {
        try {
            return {
                success: true,
                diagnostic: await buildSiiDiagnostic()
            };
        } catch (error) {
            console.error('SII diagnostics error:', error);
            return {
                success: false,
                error: error?.message || 'sii_diagnostics_failed'
            };
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

    ipcMain.handle('sii:direct-generate-boleta-xml', async (_event, { emisor, receptor, detalles, folio, fechaEmis, config }) => {
        try {
            ensureSiiDataDir();
            const certPath = path.join(siiDataDir, config.certFilename || 'certificado.pfx');
            const cafPath = path.join(siiDataDir, 'CAF_39.xml');

            if (!fsSync.existsSync(certPath)) {
                throw new Error(`No se encontró el certificado digital en la ruta: ${certPath}`);
            }
            if (!fsSync.existsSync(cafPath)) {
                throw new Error(`No se encontró el archivo CAF_39.xml en la ruta: ${cafPath}`);
            }

            const certData = siiDirect.parsePfx(certPath, config.certPassword);
            const cafXmlContent = await fs.readFile(cafPath, 'utf8');

            const certAsn1 = forge.asn1.fromDer(forge.util.decode64(certData.certBase64));
            const forgeCert = forge.pki.certificateFromAsn1(certAsn1);
            const publicKey = forgeCert.publicKey;
            const modulusBase64 = Buffer.from(publicKey.n.toString(16), 'hex').toString('base64');
            let exponentHex = publicKey.e.toString(16);
            if (exponentHex.length % 2 !== 0) exponentHex = '0' + exponentHex;
            const exponentBase64 = Buffer.from(exponentHex, 'hex').toString('base64');

            const mntTotal = detalles.reduce((sum, item) => sum + Number(item.montoItem), 0);
            const primerItemNombre = detalles[0]?.nombre || 'ITEM';

            // Generate TED
            const { tedXml } = siiDirect.generateTed({
                emisorRut: emisor.rut,
                tipoDte: 39,
                folio: Number(folio),
                fechaEmis,
                receptorRut: receptor.rut,
                receptorRznSoc: receptor.razonSocial,
                montoTotal: mntTotal,
                primerItemNombre,
                cafXmlContent
            });

            // Generate Boleta XML
            const documentId = `DTE_39_F${folio}`;
            const unsignedXml = siiDirect.generateBoletaXml({
                documentId,
                folio: Number(folio),
                fechaEmis,
                emisor,
                receptor,
                detalles,
                tedXml,
                indicadorServicio: Number(config.indicadorServicio || 3)
            });

            // Sign DTE
            const signedXml = siiDirect.signDte(
                unsignedXml,
                documentId,
                certData.privateKeyPem,
                certData.certBase64,
                modulusBase64,
                exponentBase64
            );

            // Save signed XML locally
            const folderPath = ensureInvoiceFolder('boletas');
            const targetPath = path.join(folderPath, `DTE_39_Folio_${folio}.xml`);
            await fs.writeFile(targetPath, signedXml, 'utf8');

            return { success: true, xml: signedXml, path: targetPath };
        } catch (error) {
            console.error('sii:direct-generate-boleta-xml error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('sii:direct-send-boleta-envelope', async (_event, { dtes, config }) => {
        try {
            ensureSiiDataDir();
            const certPath = path.join(siiDataDir, config.certFilename || 'certificado.pfx');

            if (!fsSync.existsSync(certPath)) {
                throw new Error(`No se encontró el certificado digital en la ruta: ${certPath}`);
            }

            const certData = siiDirect.parsePfx(certPath, config.certPassword);
            const certAsn1 = forge.asn1.fromDer(forge.util.decode64(certData.certBase64));
            const forgeCert = forge.pki.certificateFromAsn1(certAsn1);
            const publicKey = forgeCert.publicKey;
            const modulusBase64 = Buffer.from(publicKey.n.toString(16), 'hex').toString('base64');
            let exponentHex = publicKey.e.toString(16);
            if (exponentHex.length % 2 !== 0) exponentHex = '0' + exponentHex;
            const exponentBase64 = Buffer.from(exponentHex, 'hex').toString('base64');

            const nowStr = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
            const setDteId = `ENVIOBOLETA_${nowStr}`;
            
            const dtesXmlList = dtes.map(d => d.xmlContent);

            const unsignedEnvelope = siiDirect.generateEnvelopeXml({
                setDteId,
                rutEmisor: config.rutEmisor,
                rutEnvia: config.rutEnvia || config.rutEmisor,
                fechaResol: config.resolucionFecha || config.fechaResolucion || '2014-08-22',
                nroResol: Number(config.resolucionNumero || config.numeroResolucion || 80),
                dtesXmlList
            });

            const signedEnvelope = siiDirect.signEnvelope(
                unsignedEnvelope,
                setDteId,
                certData.privateKeyPem,
                certData.certBase64,
                modulusBase64,
                exponentBase64
            );

            // Save signed envelope XML locally
            const folderPath = ensureInvoiceFolder('boletas');
            const targetPath = path.join(folderPath, `ENVIO_BOLETAS_${Date.now()}.xml`);
            await fs.writeFile(targetPath, signedEnvelope, 'utf8');

            const ambiente = config.siiAmbiente || '2';
            
            let token;
            let uploadResult;
            try {
                token = await siiDirect.getOrFetchSessionToken(certPath, config.certPassword, ambiente, false);
                uploadResult = await siiDirect.uploadEnvelope({
                    xmlContent: signedEnvelope,
                    token,
                    rutSender: config.rutEnvia || config.rutEmisor,
                    rutCompany: config.rutEmisor,
                    ambiente
                });
            } catch (firstError) {
                console.warn('First upload attempt failed, retrying with fresh token...', firstError.message);
                token = await siiDirect.getOrFetchSessionToken(certPath, config.certPassword, ambiente, true);
                uploadResult = await siiDirect.uploadEnvelope({
                    xmlContent: signedEnvelope,
                    token,
                    rutSender: config.rutEnvia || config.rutEmisor,
                    rutCompany: config.rutEmisor,
                    ambiente
                });
            }

            return {
                success: true,
                trackId: uploadResult.trackId,
                status: uploadResult.status,
                responseText: uploadResult.responseText,
                envelopePath: targetPath
            };
        } catch (error) {
            console.error('sii:direct-send-boleta-envelope error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('sii:check-connection', async (_event, { config }) => {
        try {
            const ambiente = config.siiAmbiente || '2';
            const semilla = await siiDirect.getSemilla(ambiente);
            return { success: true, semilla };
        } catch (error) {
            console.error('sii:check-connection error:', error);
            return { success: false, error: error.message };
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

    const resyncCustomerDisplays = () => {
        if (!customerDisplayDesiredOpen) {
            return;
        }

        if (customerDisplayResyncTimer) {
            clearTimeout(customerDisplayResyncTimer);
        }

        customerDisplayResyncTimer = setTimeout(() => {
            customerDisplayResyncTimer = null;
            reconcileCustomerDisplayWindows();
            sendCustomerDisplayState(lastCustomerDisplayPayload);
        }, 300);
    };

    screen.on('display-added', resyncCustomerDisplays);
    screen.on('display-removed', resyncCustomerDisplays);
    screen.on('display-metrics-changed', resyncCustomerDisplays);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            mainWindow?.once('ready-to-show', () => {
                updateManager?.sendStateToWindow?.();
            });
        }

        resyncCustomerDisplays();
    });
});

app.on('before-quit', () => {
    app.isQuiting = true;
    closeCustomerDisplayWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
