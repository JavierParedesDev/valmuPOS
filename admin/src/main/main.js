const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { registerIpcHandlers } = require('./ipc/register-handlers');

let mainWindow = null;
let manualUpdateCheck = false;
const updateState = {
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseNotes: '',
    status: 'idle',
    statusMessage: 'Aun no se ha comprobado si hay actualizaciones.',
    errorMessage: '',
    downloadReady: false,
    checkedAt: null
};

function serializeUpdateState() {
    return { ...updateState };
}

function sendUpdateState() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('update-state-changed', serializeUpdateState());
}

function setUpdateState(patch) {
    Object.assign(updateState, patch);
    sendUpdateState();
}

function normalizeReleaseNotes(releaseNotes) {
    if (!releaseNotes) {
        return '';
    }

    if (Array.isArray(releaseNotes)) {
        return releaseNotes
            .map((entry) => entry?.note || entry?.releaseNotes || '')
            .filter(Boolean)
            .join('\n\n');
    }

    return String(releaseNotes).trim();
}

function getFriendlyUpdateError(error) {
    const message = error?.message || 'Error desconocido al comprobar actualizaciones.';

    if (message.includes('releases.atom') && message.includes('404')) {
        return 'Aun no hay una release publicada para autoactualizacion en GitHub.';
    }

    if (message.includes('net::ERR_INTERNET_DISCONNECTED')) {
        return 'No hay conexion a internet para revisar actualizaciones.';
    }

    if (message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        return 'No se pudo resolver el servidor de actualizaciones.';
    }

    if (message.includes('401') || message.includes('403')) {
        return 'La app no tiene permiso para consultar las releases publicadas.';
    }

    return message;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        icon: path.join(__dirname, '../renderer/assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: 'Valmu Admin',
        autoHideMenuBar: true,
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/login.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        sendUpdateState();
    });

    registerIpcHandlers(mainWindow, {
        getUpdateState: serializeUpdateState,
        checkForUpdates: checkForAppUpdates,
        installUpdate: () => autoUpdater.quitAndInstall()
    });
    return mainWindow;
}

function buildAppMenu() {
    Menu.setApplicationMenu(null);
}

async function checkForAppUpdates(isManual = false) {
    if (!app.isPackaged) {
        setUpdateState({
            status: 'development',
            statusMessage: 'Las actualizaciones automaticas solo funcionan en la app instalada.',
            errorMessage: '',
            checkedAt: new Date().toISOString()
        });
        return serializeUpdateState();
    }

    manualUpdateCheck = isManual;
    setUpdateState({
        status: 'checking',
        statusMessage: 'Buscando nuevas versiones...',
        errorMessage: '',
        checkedAt: new Date().toISOString()
    });

    try {
        const result = await autoUpdater.checkForUpdates();
        const updateInfo = result?.updateInfo;

        if (updateInfo) {
            setUpdateState({
                latestVersion: updateInfo.version || updateState.latestVersion,
                releaseNotes: normalizeReleaseNotes(updateInfo.releaseNotes),
                checkedAt: new Date().toISOString()
            });
        }

        return serializeUpdateState();
    } catch (error) {
        console.error('Check for updates failed:', error);
        manualUpdateCheck = false;
        setUpdateState({
            status: 'error',
            statusMessage: 'No se pudo comprobar si hay actualizaciones.',
            errorMessage: getFriendlyUpdateError(error),
            checkedAt: new Date().toISOString()
        });
        return serializeUpdateState();
    }
}

function setupAutoUpdates() {
    if (!app.isPackaged) {
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (error) => {
        console.error('Auto-update error:', error);
        manualUpdateCheck = false;
        setUpdateState({
            status: 'error',
            statusMessage: 'No se pudo completar la comprobacion de actualizaciones.',
            errorMessage: getFriendlyUpdateError(error),
            checkedAt: new Date().toISOString()
        });
    });

    autoUpdater.on('update-available', (info) => {
        setUpdateState({
            status: 'available',
            statusMessage: 'Hay una nueva version disponible. La descarga comenzo automaticamente.',
            latestVersion: info?.version || updateState.latestVersion,
            releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
            errorMessage: '',
            downloadReady: false,
            checkedAt: new Date().toISOString()
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        manualUpdateCheck = false;
        setUpdateState({
            status: 'up-to-date',
            statusMessage: 'Ya tienes instalada la ultima version disponible.',
            latestVersion: info?.version || updateState.currentVersion,
            releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
            errorMessage: '',
            downloadReady: false,
            checkedAt: new Date().toISOString()
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        setUpdateState({
            status: 'downloading',
            statusMessage: `Descargando actualizacion: ${Math.round(progress.percent || 0)}%`,
            errorMessage: '',
            checkedAt: new Date().toISOString()
        });
    });

    autoUpdater.on('update-downloaded', async (info) => {
        manualUpdateCheck = false;
        setUpdateState({
            status: 'downloaded',
            statusMessage: 'La nueva version ya esta lista para instalar.',
            latestVersion: info?.version || updateState.latestVersion,
            releaseNotes: normalizeReleaseNotes(info?.releaseNotes) || updateState.releaseNotes,
            errorMessage: '',
            downloadReady: true,
            checkedAt: new Date().toISOString()
        });

        const result = await dialog.showMessageBox({
            type: 'info',
            buttons: ['Reiniciar ahora', 'Despues'],
            defaultId: 0,
            cancelId: 1,
            title: 'Actualizacion lista',
            message: 'Se descargo una nueva version de Valmu Admin.',
            detail: 'La aplicacion debe reiniciarse para completar la actualizacion.'
        });

        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });

    setTimeout(() => {
        checkForAppUpdates(false);
    }, 3000);
}

app.whenReady().then(() => {
    createWindow();
    buildAppMenu();
    setupAutoUpdates();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
