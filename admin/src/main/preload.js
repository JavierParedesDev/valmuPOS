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
    UPDATE_STATE_CHANGED: 'update-state-changed',
    SAVE_SII_CONFIG: 'save-sii-config',
    GET_SII_CONFIG: 'get-sii-config',
    UPLOAD_SII_FILE: 'upload-sii-file',
    READ_LOCAL_CERT: 'read-local-cert',
    READ_LOCAL_TEXT: 'read-local-text',
    SAVE_XML: 'save-xml',
    LIST_INVOICES: 'list-invoices',
    OPEN_FILE: 'open-file',
    DELETE_INVOICE_FILES: 'delete-invoice-files',
    UPLOAD_PUBLICIDAD: 'upload-publicidad',
    GET_PRINTERS: 'settings:get-printers',
    PRINT_RECEIPT: 'printer:print-receipt'
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
    saveSiiConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SII_CONFIG, config),
    getSiiConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SII_CONFIG),
    uploadSiiFile: (type, filename, base64Data) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_SII_FILE, { type, filename, base64Data }),
    readLocalCert: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.READ_LOCAL_CERT, filePath),
    readLocalText: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.READ_LOCAL_TEXT, filePath),
    saveXml: (filename, data, folder) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_XML, { filename, data, folder }),
    listInvoices: (folder) => ipcRenderer.invoke(IPC_CHANNELS.LIST_INVOICES, folder),
    openFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE, filePath),
    deleteInvoiceFiles: (filename) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_INVOICE_FILES, filename),
    uploadPublicidad: (data) => ipcRenderer.invoke(IPC_CHANNELS.UPLOAD_PUBLICIDAD, data),
    getPrinters: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PRINTERS),
    printReceipt: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PRINT_RECEIPT, payload),
    onUpdateStateChanged: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on(IPC_CHANNELS.UPDATE_STATE_CHANGED, listener);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATE_CHANGED, listener);
    }
});
