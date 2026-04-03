const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_API_BASE_URL = (process.env.VALMU_API_URL || 'http://64.176.17.147:3000/api').replace(/\/+$/, '');

contextBridge.exposeInMainWorld('cajeroAPI', {
    appName: 'Valmu Cajero',
    version: '0.1.0',
    apiBaseUrl: DEFAULT_API_BASE_URL,
    getPrinters: () => ipcRenderer.invoke('settings:get-printers'),
    checkGithubRelease: (repo) => ipcRenderer.invoke('settings:check-github-release', repo),
    printReceipt: (payload) => ipcRenderer.invoke('printer:print-receipt', payload),
    openCustomerDisplay: () => ipcRenderer.invoke('display:open-customer'),
    closeCustomerDisplay: () => ipcRenderer.invoke('display:close-customer'),
    updateCustomerDisplay: (payload) => ipcRenderer.invoke('display:update-customer', payload),
    getCustomerDisplayState: () => ipcRenderer.invoke('display:get-customer-state'),
    onCustomerDisplayUpdate: (callback) => {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('display:customer-update', listener);
        return () => ipcRenderer.removeListener('display:customer-update', listener);
    }
});
