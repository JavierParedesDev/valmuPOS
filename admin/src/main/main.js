const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { registerIpcHandlers } = require('./ipc/register-handlers');

let mainWindow = null;

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
    });

    registerIpcHandlers(mainWindow);
    return mainWindow;
}

function setupAutoUpdates() {
    if (!app.isPackaged) {
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (error) => {
        console.error('Auto-update error:', error);
    });

    autoUpdater.on('update-downloaded', async () => {
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
        autoUpdater.checkForUpdatesAndNotify().catch((error) => {
            console.error('Check for updates failed:', error);
        });
    }, 3000);
}

app.whenReady().then(() => {
    createWindow();
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
