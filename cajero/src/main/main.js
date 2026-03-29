const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

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
