const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_API_BASE_URL = (process.env.VALMU_API_URL || 'http://64.176.17.147:3000/api').replace(/\/+$/, '');

contextBridge.exposeInMainWorld('cajeroAPI', {
    appName: 'Valmu Cajero',
    version: '0.1.0',
    apiBaseUrl: DEFAULT_API_BASE_URL,
    getPrinters: () => ipcRenderer.invoke('settings:get-printers'),
    checkGithubRelease: (repo) => ipcRenderer.invoke('settings:check-github-release', repo)
});
