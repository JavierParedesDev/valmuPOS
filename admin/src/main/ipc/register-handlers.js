const path = require('path');
const { app, ipcMain } = require('electron');
const { API_BASE_URL } = require('../config');
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

    ipcMain.on('navigate-to-index', () => {
        activeWindow?.loadFile(path.join(__dirname, '../../renderer/index.html'));
    });

    ipcMain.handle('login', async (_event, credentials) => loginUser(credentials));
    ipcMain.handle('get-app-version', () => app.getVersion());
    ipcMain.handle('get-config', () => ({ apiBaseUrl: API_BASE_URL }));
    ipcMain.handle('get-update-state', () => updaterController?.getUpdateState?.() || null);
    ipcMain.handle('check-for-updates', () => updaterController?.checkForUpdates?.(true) || null);
    ipcMain.handle('install-update', () => updaterController?.installUpdate?.() || null);
    ipcMain.handle('api-request', async (_event, options) => requestJson(options));

    isRegistered = true;
}

module.exports = {
    registerIpcHandlers
};
