const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_API_BASE_URL = (process.env.VALMU_API_URL || 'http://64.176.17.147:3000/api').replace(/\/+$/, '');

contextBridge.exposeInMainWorld('cajeroAPI', {
    appName: 'Valmu Cajero',
    version: '0.1.0',
    apiBaseUrl: DEFAULT_API_BASE_URL,
    getAppVersion: () => ipcRenderer.invoke('app:get-version'),
    getUpdateState: () => ipcRenderer.invoke('update:get-state'),
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    getSiiConfig: () => ipcRenderer.invoke('sii:get-config'),
    saveSiiConfig: (config) => ipcRenderer.invoke('sii:save-config', config),
    uploadSiiFile: ({ filename, base64Data }) => ipcRenderer.invoke('sii:upload-file', { filename, base64Data }),
    readLocalCert: (filename) => ipcRenderer.invoke('sii:read-local-cert', filename),
    readLocalText: (filename) => ipcRenderer.invoke('sii:read-local-text', filename),
    saveXml: ({ filename, data, folder }) => ipcRenderer.invoke('sii:save-xml', { filename, data, folder }),
    getPrinters: () => ipcRenderer.invoke('settings:get-printers'),
    printReceipt: (payload) => ipcRenderer.invoke('printer:print-receipt', payload),
    openCustomerDisplay: () => ipcRenderer.invoke('display:open-customer'),
    closeCustomerDisplay: () => ipcRenderer.invoke('display:close-customer'),
    updateCustomerDisplay: (payload) => ipcRenderer.invoke('display:update-customer', payload),
    getCustomerDisplayState: () => ipcRenderer.invoke('display:get-customer-state'),
    toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
    onCustomerDisplayUpdate: (callback) => {
        if (typeof callback !== 'function') {
            return () => { };
        }

        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('display:customer-update', listener);
        return () => ipcRenderer.removeListener('display:customer-update', listener);
    },
    onUpdateStateChanged: (callback) => {
        if (typeof callback !== 'function') {
            return () => { };
        }

        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('update:state-changed', listener);
        return () => ipcRenderer.removeListener('update:state-changed', listener);
    }
});
