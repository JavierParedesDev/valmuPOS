const { app, BrowserWindow, Menu } = require('electron');
const { registerIpcHandlers } = require('./ipc/register-handlers');
const { createMainWindow, toggleMainWindowFullscreen, getMainWindowState } = require('./windows/main-window');
const { createUpdateManager } = require('./updater/update-manager');

let mainWindow = null;

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

app.whenReady().then(() => {
    const updateManager = createUpdateManager({
        app,
        getMainWindow: () => mainWindow
    });

    mainWindow = createMainWindow();
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        updateManager.sendStateToWindow();
    });

    buildAppMenu();
    registerIpcHandlers(mainWindow, {
        getUpdateState: updateManager.getUpdateState,
        checkForUpdates: updateManager.checkForUpdates,
        installUpdate: updateManager.installUpdate,
        toggleFullscreen: () => toggleMainWindowFullscreen(mainWindow),
        getWindowState: () => getMainWindowState(mainWindow)
    });
    updateManager.initialize();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
            mainWindow.once('ready-to-show', () => {
                mainWindow.show();
                updateManager.sendStateToWindow();
            });
            registerIpcHandlers(mainWindow, {
                getUpdateState: updateManager.getUpdateState,
                checkForUpdates: updateManager.checkForUpdates,
                installUpdate: updateManager.installUpdate,
                toggleFullscreen: () => toggleMainWindowFullscreen(mainWindow),
                getWindowState: () => getMainWindowState(mainWindow)
            });
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
