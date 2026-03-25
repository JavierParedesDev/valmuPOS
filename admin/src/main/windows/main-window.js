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
            nodeIntegration: false
        },
        title: 'Valmu Admin',
        autoHideMenuBar: true,
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, '../../renderer/login.html'));

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
