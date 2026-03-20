const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { registerIpcHandlers } = require('./ipc/register-handlers');

let mainWindow = null;
let manualUpdateCheck = false;

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
        title: `Valmu Admin ${app.getVersion()}`,
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

function buildAppMenu() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Salir',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Buscar actualizaciones',
                    click: () => checkForAppUpdates(true)
                },
                {
                    label: `Version ${app.getVersion()}`,
                    enabled: false
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

async function checkForAppUpdates(isManual = false) {
    if (!app.isPackaged) {
        if (isManual) {
            await dialog.showMessageBox({
                type: 'info',
                title: 'Actualizaciones',
                message: 'Las actualizaciones automaticas solo funcionan en la app instalada.',
                detail: 'En modo desarrollo no se descargan updates.'
            });
        }
        return;
    }

    manualUpdateCheck = isManual;

    try {
        await autoUpdater.checkForUpdates();
    } catch (error) {
        console.error('Check for updates failed:', error);

        if (manualUpdateCheck) {
            manualUpdateCheck = false;
            await dialog.showMessageBox({
                type: 'error',
                title: 'Actualizaciones',
                message: 'No se pudo comprobar si hay actualizaciones.',
                detail: error.message || 'Error desconocido'
            });
        }
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
    });

    autoUpdater.on('update-available', async () => {
        if (!manualUpdateCheck) return;

        await dialog.showMessageBox({
            type: 'info',
            title: 'Actualizacion disponible',
            message: 'Se encontro una nueva version de Valmu Admin.',
            detail: 'La descarga comenzara automaticamente en segundo plano.'
        });
    });

    autoUpdater.on('update-not-available', async () => {
        if (!manualUpdateCheck) return;

        manualUpdateCheck = false;
        await dialog.showMessageBox({
            type: 'info',
            title: 'Sin actualizaciones',
            message: 'Ya tienes la ultima version disponible de Valmu Admin.'
        });
    });

    autoUpdater.on('update-downloaded', async () => {
        manualUpdateCheck = false;

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
