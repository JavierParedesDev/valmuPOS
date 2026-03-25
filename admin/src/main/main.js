const { app, BrowserWindow, Menu } = require('electron');
const { registerIpcHandlers } = require('./ipc/register-handlers');
const { createMainWindow, toggleMainWindowFullscreen, getMainWindowState } = require('./windows/main-window');
const { createUpdateManager } = require('./updater/update-manager');

let mainWindow = null;

function buildAppMenu() {
    Menu.setApplicationMenu(null);
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
