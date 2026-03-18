const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    navigateToIndex: () => ipcRenderer.send('navigate-to-index'),
    apiRequest: (options) => ipcRenderer.invoke('api-request', options)
});
