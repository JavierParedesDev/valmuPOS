const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

let mainWindow = null;
let customerDisplayWindow = null;
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

function getReceiptPrinterScriptPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'scripts', 'receipt_printer.py');
    }

    return path.join(__dirname, '../../scripts/receipt_printer.py');
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
            execFile(
                'python',
                [scriptPath, tempPath],
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
        await fs.unlink(tempPath).catch(() => {});
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
        title: 'Valmu Cajero',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
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
    return displays.find((display) => display.id !== primaryDisplay.id) || null;
}

function sendCustomerDisplayState(payload) {
    lastCustomerDisplayPayload = {
        ...lastCustomerDisplayPayload,
        ...(payload || {})
    };

    if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) {
        return;
    }

    customerDisplayWindow.webContents.send('display:customer-update', lastCustomerDisplayPayload);
}

function createCustomerDisplayWindow() {
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
        customerDisplayWindow.focus();
        sendCustomerDisplayState(lastCustomerDisplayPayload);
        return customerDisplayWindow;
    }

    const externalDisplay = getCustomerDisplayBounds();
    const baseOptions = {
        width: 1024,
        height: 768,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#241710',
        autoHideMenuBar: true,
        title: 'Valmu Cliente',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false
    };

    if (externalDisplay?.bounds) {
        baseOptions.x = externalDisplay.bounds.x;
        baseOptions.y = externalDisplay.bounds.y;
        baseOptions.width = Math.max(externalDisplay.bounds.width, 800);
        baseOptions.height = Math.max(externalDisplay.bounds.height, 600);
    }

    customerDisplayWindow = new BrowserWindow(baseOptions);
    customerDisplayWindow.loadFile(getCustomerDisplayFilePath());
    customerDisplayWindow.once('ready-to-show', () => {
        customerDisplayWindow?.show();
    });
    customerDisplayWindow.webContents.on('did-finish-load', () => {
        sendCustomerDisplayState(lastCustomerDisplayPayload);
    });
    customerDisplayWindow.on('closed', () => {
        customerDisplayWindow = null;
    });

    return customerDisplayWindow;
}

function closeCustomerDisplayWindow() {
    if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) {
        customerDisplayWindow = null;
        return false;
    }

    customerDisplayWindow.close();
    customerDisplayWindow = null;
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

    ipcMain.handle('settings:check-github-release', async (_event, repo) => {
        const normalizedRepo = normalizeGithubRepo(repo);
        if (!normalizedRepo || !normalizedRepo.includes('/')) {
            return {
                ok: false,
                error: 'Repositorio invalido. Usa el formato usuario/repositorio.'
            };
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${normalizedRepo}/releases/latest`, {
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'Valmu-Cajero'
                }
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                return {
                    ok: false,
                    error: payload?.message || 'No se pudo consultar la ultima release.'
                };
            }

            const latestVersion = payload?.tag_name || payload?.name || null;
            const currentVersion = app.getVersion();
            const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;

            return {
                ok: true,
                repo: normalizedRepo,
                currentVersion,
                latestVersion,
                hasUpdate,
                releaseName: payload?.name || latestVersion,
                publishedAt: payload?.published_at || null,
                url: payload?.html_url || null
            };
        } catch (error) {
            return {
                ok: false,
                error: error?.message || 'No se pudo consultar GitHub Releases.'
            };
        }
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
            isOpen: Boolean(customerDisplayWindow && !customerDisplayWindow.isDestroyed())
        };
    });

    ipcMain.handle('display:get-customer-state', async () => ({
        ok: true,
        isOpen: Boolean(customerDisplayWindow && !customerDisplayWindow.isDestroyed()),
        payload: lastCustomerDisplayPayload
    }));
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createMainWindow();
    registerIpcHandlers();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
