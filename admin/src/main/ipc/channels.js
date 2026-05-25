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
    PRINT_RECEIPT: 'printer:print-receipt',
    GET_PRINTERS: 'settings:get-printers',
    QUERY_SII_STATUS: 'query-sii-status',
    QUERY_SII_DTE_STATUS: 'query-sii-dte-status',
    QUERY_SII_BOLETA_STATUS: 'query-sii-boleta-status',
    QUERY_SII_BOLETA_DTE_STATUS: 'query-sii-boleta-dte-status'
};

module.exports = {
    IPC_CHANNELS
};
