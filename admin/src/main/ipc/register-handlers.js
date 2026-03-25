const path = require('path');
const { app, ipcMain } = require('electron');
const { API_BASE_URL } = require('../config');
const { IPC_CHANNELS } = require('./channels');
const { loginUser } = require('../services/auth-service');
const { requestJson } = require('../services/http-client');

let activeWindow = null;
let isRegistered = false;
let updaterController = null;

function registerIpcHandlers(mainWindow, updaterApi = null) {
    activeWindow = mainWindow;
    updaterController = updaterApi;

    if (isRegistered) {
        return;
    }

    ipcMain.on(IPC_CHANNELS.NAVIGATE_TO_INDEX, () => {
        activeWindow?.loadFile(path.join(__dirname, '../../renderer/index.html'));
    });

    ipcMain.handle(IPC_CHANNELS.LOGIN, async (_event, credentials) => loginUser(credentials));
    ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => app.getVersion());
    ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => ({ apiBaseUrl: API_BASE_URL }));
    ipcMain.handle(IPC_CHANNELS.GET_UPDATE_STATE, () => updaterController?.getUpdateState?.() || null);
    ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, () => updaterController?.checkForUpdates?.(true) || null);
    ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, () => updaterController?.installUpdate?.() || null);
    ipcMain.handle(IPC_CHANNELS.TOGGLE_FULLSCREEN, () => updaterController?.toggleFullscreen?.() || { isFullScreen: false });
    ipcMain.handle(IPC_CHANNELS.GET_WINDOW_STATE, () => updaterController?.getWindowState?.() || { isFullScreen: false });
    ipcMain.handle(IPC_CHANNELS.API_REQUEST, async (_event, options) => requestJson(options));

    isRegistered = true;
}

module.exports = {
    registerIpcHandlers
};
