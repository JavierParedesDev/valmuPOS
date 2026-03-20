const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    getUpdateState: () => ipcRenderer.invoke('get-update-state'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    navigateToIndex: () => ipcRenderer.send('navigate-to-index'),
    apiRequest: (options) => ipcRenderer.invoke('api-request', options),
    onUpdateStateChanged: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('update-state-changed', listener);
        return () => ipcRenderer.removeListener('update-state-changed', listener);
    }
});
