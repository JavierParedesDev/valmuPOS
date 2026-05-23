const { BrowserWindow } = require('electron');
const path = require('path');

function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        icon: path.join(__dirname, '../../renderer/assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        },
        title: 'Valmu Admin',
        autoHideMenuBar: false,
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, '../../renderer/login.html'));

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

    return mainWindow;
}

function toggleMainWindowFullscreen(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return { isFullScreen: false };
    }

    const nextState = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(nextState);
    return { isFullScreen: nextState };
}

function getMainWindowState(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return { isFullScreen: false };
    }

    return { isFullScreen: mainWindow.isFullScreen() };
}

module.exports = {
    createMainWindow,
    toggleMainWindowFullscreen,
    getMainWindowState
};
