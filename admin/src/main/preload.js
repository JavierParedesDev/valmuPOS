const { contextBridge, ipcRenderer } = require('electron');

// Keep preload self-contained because Electron may sandbox it and reject local requires.
const IPC_CHANNELS = {
    NAVIGATE_TO_INDEX: 'navigate-to-index',
    LOGIN: 'login',
    GET_APP_VERSION: 'get-app-version',
    GET_CONFIG: 'get-config',
    GET_UPDATE_STATE: 'get-update-state',
    CHECK_FOR_UPDATES: 'check-for-updates',
    INSTALL_UPDATE: 'install-update',
    TOGGLE_FULLSCREEN: 'toggle-fullscreen',
    GET_WINDOW_STATE: 'get-window-state',
    API_REQUEST: 'api-request',
    UPDATE_STATE_CHANGED: 'update-state-changed'
};

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
    getUpdateState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_UPDATE_STATE),
    checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
    installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_UPDATE),
    toggleFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FULLSCREEN),
    getWindowState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_WINDOW_STATE),
    login: (credentials) => ipcRenderer.invoke(IPC_CHANNELS.LOGIN, credentials),
    navigateToIndex: () => ipcRenderer.send(IPC_CHANNELS.NAVIGATE_TO_INDEX),
    apiRequest: (options) => ipcRenderer.invoke(IPC_CHANNELS.API_REQUEST, options),
    onUpdateStateChanged: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on(IPC_CHANNELS.UPDATE_STATE_CHANGED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATE_CHANGED, listener);
    }
});
