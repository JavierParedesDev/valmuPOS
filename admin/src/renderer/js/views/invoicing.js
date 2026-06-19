console.log("Loading invoicing.js...");
const toastTypeMap = {
    error: 'error',
    warning: 'warning',
    success: 'success',
    info: 'info'
};

if (typeof Toast !== 'undefined' && typeof Toast.show !== 'function') {
    Toast.show = (message, type = 'info') => {
        Toast.fire({
            icon: toastTypeMap[type] || 'info',
            title: String(message || '')
        });
        return null;
    };
}

// CONSTANTES EMISOR (Defecto)
const DEFAULT_EMISOR = {
    rut: "77292701-0",
    razonSocial: "DISTRIBUIDORA Y COMERCIAL EDUARDO VALDEBENITO MORALES SPA",
    direccion: "YOBILO LT 1 MZ 1 1001 FRANK MARDONES NULL CORONEL",
    comuna: "CORONEL",
    giro: "COMERCIALIZACION Y DISTRIBUCION POR MAYOR Y MENOR DE PRODUCTOS VARIOS",
    acteco: 463019,
    email: "contacto@valmu.cl",
    telefono: "+569 0000 0000"
};

const api = window.ValmuInvoicingApi;
const invoicingConfigService = window.ValmuInvoicingConfig;
const invoicingPageTransport = window.ValmuInvoicingTransport;
const invoicingConfigController = window.ValmuInvoicingConfigController;
const invoicingAdjustmentController = window.ValmuInvoicingAdjustmentController;
const invoicingAdjustmentEmission = window.ValmuInvoicingAdjustmentEmission;
const invoicingCreateController = window.ValmuInvoicingCreateController;
const invoicingCreateEmission = window.ValmuInvoicingCreateEmission;
const invoicingDocuments = window.ValmuInvoicingDocuments;
const invoicingSmartData = window.ValmuInvoicingSmartData;
const invoicingFolioService = window.ValmuInvoicingFolios;
const invoicingHistoryController = window.ValmuInvoicingHistoryController;
const invoicingCreateView = window.ValmuInvoicingCreateView;
const invoicingDebitView = window.ValmuInvoicingDebitView;
const invoicingNoteView = window.ValmuInvoicingNoteView;
const invoicingConfigView = window.ValmuInvoicingConfigView;

class InvoicesPage {
    constructor() {
        this.container = null;
        this.activeTab = 'create'; // Default to Create for testing
        this.clients = [];
        this.products = [];
        this.isSmartDataLoaded = false;

        this.historyFilter = 'all';

        // Optimizations
        this.historyPage = 1;
        this.historyItemsPerPage = 15;
        this.historySearchTerm = '';
        // Expose instance for inline HTML event handlers (e.g. onchange="window.invoicePage.updateNCTotals()")
        window.invoicePage = this;


        this.isProcessing = false;
    }

    setHistoryFilter(filter) {
        return invoicingHistoryController.setFilter(this, filter);
    }

    async render(container) {
        this.container = container;
        this.updateUI();
    }

    async updateUI() {
        this.isProcessing = false;
        if (!this.container) return;

        // Wait for content to resolve if async
        const content = await this.renderContent();

        this.container.innerHTML = `
            <div class="h-full flex flex-col pt-2">
                <div class="flex flex-wrap gap-2 mb-6">
                    <button data-tab="create" class="tab-btn min-w-[150px] px-5 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${this.activeTab === 'create' ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Factura Electrónica</button>
                    <button data-tab="note" class="tab-btn min-w-[150px] px-5 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${this.activeTab === 'note' ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Nota de Crédito</button>
                    <button data-tab="debit" class="tab-btn min-w-[150px] px-5 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${this.activeTab === 'debit' ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Nota de Débito</button>
                    <button data-tab="history" class="tab-btn min-w-[150px] px-5 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${this.activeTab === 'history' ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Historial</button>
                    <button data-tab="config" class="tab-btn min-w-[150px] px-5 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${this.activeTab === 'config' ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Configuración</button>
                </div>

                <div id="invoice-view-area" class="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                    ${content}
                </div>
            </div>
        `;

        this.attachEvents();

        const pollTabs = ['create', 'note', 'debit'];
        if (pollTabs.includes(this.activeTab)) {
            this.loadConfig().then(() => {
                this.startFolioPolling();
                this.pollFolio();

                if (this.activeTab === 'create') {
                    const typeSelect = document.getElementById('dte-tipo');
                    if (typeSelect) {
                        this.fetchLastFolio(typeSelect.value);
                    }
                }
            });
        } else {
            this.stopFolioPolling();
        }

        if (this.activeTab === 'create' || this.activeTab === 'note' || this.activeTab === 'debit') {
            if (!this.isSmartDataLoaded) {
                this.loadSmartData();
            } else {
                // If already loaded but we re-rendered (e.g. switch tabs), we must re-inject options into DOM
                this.updateDatalists();
            }
        }
    }

    async loadSmartData() {
        const data = await invoicingSmartData.load({
            api,
            onLoaded: ({ clients, products }) => {
                this.clients = clients;
                this.products = products;
                this.isSmartDataLoaded = true;
            }
        });

        this.clients = data.clients;
        this.products = data.products;
        this.isSmartDataLoaded = true;
        this.updateDatalists();
    }

    updateDatalists() {
        return invoicingSmartData.applyDatalists({
            clients: this.clients,
            products: this.products
        });
    }





    async renderContent() {
        switch (this.activeTab) {
            case 'history': return this.renderHistory();
            case 'create':
                await this.loadConfig();
                return this.renderCreate();
            case 'note':
                await this.loadConfig();
                return await this.renderNote();
            case 'debit':
                await this.loadConfig();
                return await this.renderDebitNote();
            case 'config':
                await this.loadConfig();
                return this.renderConfig();
            default: return '';
        }
    }
    async renderNote() {
        // Ensure Clients are loaded
        if (this.clients.length === 0) {
            await this.loadSmartData();
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        // Dynamic Config Load (Merge with Defaults)
        const local = invoicingConfigService.getLocalConfig(this.currentConfig);
        const config = {
            rutEmisor: local.rutEmisor || DEFAULT_EMISOR.rut,
            razonSocial: local.razonSocial || DEFAULT_EMISOR.razonSocial,
            direccion: local.direccion || DEFAULT_EMISOR.direccion,
            comuna: local.comuna || DEFAULT_EMISOR.comuna,
            giro: local.giro || DEFAULT_EMISOR.giro,
            acteco: local.acteco || DEFAULT_EMISOR.acteco,
            email: local.email || '',
            telefono: local.telefono || '',
            ciudad: local.ciudad || 'CONCEPCION'
        };

        // Determine Next Folio for NC (61)
        const folio61 = invoicingFolioService.getLocalNextFolio(61, this.currentConfig);

        return invoicingNoteView.render({
            config,
            today,
            folio: folio61
        });
    }

    async renderDebitNote() {
        if (this.clients.length === 0) {
            await this.loadSmartData();
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const local = invoicingConfigService.getLocalConfig(this.currentConfig);
        const config = {
            rutEmisor: local.rutEmisor || DEFAULT_EMISOR.rut,
            razonSocial: local.razonSocial || DEFAULT_EMISOR.razonSocial,
            direccion: local.direccion || DEFAULT_EMISOR.direccion,
            comuna: local.comuna || DEFAULT_EMISOR.comuna,
            giro: local.giro || DEFAULT_EMISOR.giro,
            acteco: local.acteco || DEFAULT_EMISOR.acteco,
            email: local.email || '',
            telefono: local.telefono || '',
            ciudad: local.ciudad || 'CONCEPCION'
        };

        const folio56 = invoicingFolioService.getLocalNextFolio(56, this.currentConfig);

        return invoicingDebitView.render({
            config,
            today,
            folio: folio56
        });
    }

    async emitCreditNote() {
        return invoicingAdjustmentEmission.emitCreditNote({
            page: this,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            defaultEmisor: DEFAULT_EMISOR
        });
    }

    // --- END CREDIT NOTE LOGIC ---


    // --- HISTORY LOGIC ---



    renderHistory() {
        return invoicingHistoryController.render(this);
    }

    handleSearch(val) {
        return invoicingHistoryController.handleSearch(this, val);
    }

    setHistoryPage(page) {
        return invoicingHistoryController.setPage(this, page);
    }

    updateHistoryGrid() {
        return invoicingHistoryController.updateGrid(this);
    }

    async fetchHistory() {
        return invoicingHistoryController.fetch(this);
    }

    // --- IMPORT XML (Manual Upload) ---
    async handleImportXml(input) {
        return invoicingDocuments.importXml({
            input,
            api,
            toast: Toast,
            onImported: async () => {
                await this.fetchHistory();
            }
        });
    }

    // --- NEW: Handle Remote XML Download & Open ---
    async openRemoteXml(filename, folder, idXml) {
        return invoicingDocuments.openRemoteXml({
            filename,
            folder,
            idXml,
            api,
            toast: Toast,
            createPdfFromXml: (xmlContent, targetFilename, targetFolder) => this.createPdfFromXml(xmlContent, targetFilename, targetFolder)
        });
    }

    async createPdfFromXmlWrapper(type, folio, filename, idXml) {
        return invoicingDocuments.createPdfFromXmlWrapper({
            type,
            folio,
            filename,
            idXml,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            createPdfFromXml: (xmlContent, targetFilename, targetFolder) => this.createPdfFromXml(xmlContent, targetFilename, targetFolder)
        });
    }



    async downloadDteXml(filename, folder, idXml) {
        return invoicingDocuments.downloadAndSaveXml({
            filename,
            folder,
            idXml,
            api,
            electronAPI: window.electronAPI,
            toast: Toast
        });
    }

    // --- CLIENT-SIDE PDF GENERATOR (Replaces Python Script) ---
    async createPdfFromXml(xmlContent, filename, folder) {
        return invoicingDocuments.createPdfFromXml({
            xmlContent,
            filename,
            folder,
            electronAPI: window.electronAPI
        });
    }


    async loadDteDataFromXml(type, folio) {
        return invoicingDocuments.loadDteDataFromXml({
            type,
            folio,
            activeTab: this.activeTab,
            electronAPI: window.electronAPI,
            toast: Toast,
            calcNCLine: this.calcNCLine,
            calcNDLine: this.calcNDLine
        });
    }

    // Removed: saveInvoiceToHistory (deprecated)
    // saveInvoiceToHistory(invoiceData) { ... }


    renderCreate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        // Dynamic Config Load (Merge with Defaults)
        const local = invoicingConfigService.getLocalConfig(this.currentConfig);
        const config = {
            rutEmisor: local.rutEmisor || DEFAULT_EMISOR.rut,
            razonSocial: local.razonSocial || DEFAULT_EMISOR.razonSocial,
            direccion: local.direccion || DEFAULT_EMISOR.direccion,
            comuna: local.comuna || DEFAULT_EMISOR.comuna,
            giro: local.giro || DEFAULT_EMISOR.giro,
            acteco: local.acteco || DEFAULT_EMISOR.acteco,
            email: local.email || '',
            telefono: local.telefono || '',
            ciudad: local.ciudad || 'CONCEPCION'
        };
        const folio33 = local.folio_33 || 1;

        return invoicingCreateView.render({
            config,
            today,
            folio: folio33
        });
    }
    renderConfig() {
        const local = invoicingConfigService.getLocalConfig(this.currentConfig);
        const config = {
            ...local,
            razonSocial: local.razonSocial || DEFAULT_EMISOR.razonSocial,
            direccion: local.direccion || DEFAULT_EMISOR.direccion,
            comuna: local.comuna || DEFAULT_EMISOR.comuna,
            rutEmisor: local.rutEmisor || DEFAULT_EMISOR.rut,
            email: local.email || '',
            telefono: local.telefono || ''
        };

        return invoicingConfigView.render(config);
    }
    attachEvents() {
        if (!this.container) return;
        const container = this.container;

        // Tab Switching
        container.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab !== this.activeTab) {
                    this.activeTab = tab;
                    this.updateUI();
                }
            });
        });

        // Config Events
        if (this.activeTab === 'config') {
            void invoicingConfigController.bind({
                electronAPI: window.electronAPI,
                api,
                saveConfig: () => this.saveConfig(),
                syncFolios: () => this.syncFolios(),
                reserveFolio: () => this.reserveFolio(),
                onConfigUpdated: (config) => {
                    this.currentConfig = config;
                },
                SwalRef: typeof Swal !== 'undefined' ? Swal : null
            });
        } else {
            invoicingConfigController?.stopAutoSync?.();
        }

        // Create Events
        if (this.activeTab === 'create') {
            const createBindings = invoicingCreateController.bind({
                clients: this.clients,
                products: this.products,
                getClients: () => this.clients,
                getProducts: () => this.products,
                api,
                fetchLastFolio: (tipo) => this.fetchLastFolio(tipo),
                emitInvoice: () => this.emitInvoice(),
                renderItemRow: () => invoicingCreateView.renderItemRow(),
                toast: Toast
            });

            this.calcTotals = createBindings.calcTotals;
            this.calcLine = createBindings.calcLine;
        }

        // --- NOTE TAB EVENTS ---
        if (this.activeTab === 'note') {
            const noteBindings = invoicingAdjustmentController.bind({
                prefix: 'nc',
                clients: this.clients,
                emitDocument: () => this.emitCreditNote(),
                loadDteDataFromXml: (type, folio) => this.loadDteDataFromXml(type, folio),
                renderItemRow: () => invoicingNoteView.renderItemRow(),
                toast: Toast,
                onClientSelected: (client) => {
                    this.selectedNCClient = client;
                }
            });

            this.calcNCLine = noteBindings.calcLine;
            this.calcNCTotals = noteBindings.calcTotals;
            this.toggleNCRemoveBtn = noteBindings.toggleRemoveBtn;
        }

        // --- DEBIT TAB EVENTS ---
        if (this.activeTab === 'debit') {
            const debitBindings = invoicingAdjustmentController.bind({
                prefix: 'nd',
                clients: this.clients,
                emitDocument: () => this.emitDebitNote(),
                loadDteDataFromXml: (type, folio) => this.loadDteDataFromXml(type, folio),
                renderItemRow: () => invoicingDebitView.renderItemRow(),
                toast: Toast
            });

            this.calcNDLine = debitBindings.calcLine;
            this.calcNDTotals = debitBindings.calcTotals;
            this.toggleNDRemoveBtn = debitBindings.toggleRemoveBtn;
        }
    }

    async testConnection() {
        return invoicingPageTransport.testConnection({
            button: document.getElementById('btn-test-connection'),
            toast: Toast
        });
    }
    async getBearerToken() {
        return invoicingPageTransport.getBearerToken();
    }
    async probeFolio(tipo, folio, token) {
        return invoicingPageTransport.probeFolio(tipo, folio, token);
    }

    async emitInvoice() {
        return invoicingCreateEmission.emitInvoice({
            page: this,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            defaultEmisor: DEFAULT_EMISOR
        });
    }

    async sendDTE(dteXmlContent, config, tipoDTE, token, certBlob) {
        return invoicingPageTransport.sendDTE({
            dteXmlContent,
            config,
            tipoDTE,
            token,
            certBlob,
            toast: Toast
        });
    }

    startFolioPolling() {
        if (this.folioPollingInterval) return; // Already running

        // Initial fetch immediately
        this.pollFolio();

        this.folioPollingInterval = setInterval(() => {
            this.pollFolio();
        }, 5000); // 5 seconds
        console.log("Folio Polling Started");
    }

    stopFolioPolling() {
        if (this.folioPollingInterval) {
            clearInterval(this.folioPollingInterval);
            this.folioPollingInterval = null;
            console.log("Folio Polling Stopped");
        }
    }





    async saveConfig() {
        return invoicingConfigService.save({
            electronAPI: window.electronAPI,
            api,
            currentConfig: this.currentConfig,
            onSaved: (config) => {
                this.currentConfig = config;
            },
            SwalRef: typeof Swal !== 'undefined' ? Swal : null
        });
    }

    async loadConfig() {
        return invoicingConfigService.load({
            electronAPI: window.electronAPI,
            onLoaded: (config) => {
                this.currentConfig = config;
            }
        });
    }

    checkFolioLimit(tipo) {
        return invoicingConfigService.checkFolioLimit(tipo, Toast);
    }

    async syncFolios() {
        return invoicingFolioService.sync({
            button: document.getElementById('btn-sync-folios'),
            getBearerToken: () => this.getBearerToken(),
            currentConfig: this.currentConfig,
            loadConfig: () => this.loadConfig(),
            api,
            toast: Toast
        });
    }

    reserveFolio() {
        Toast.show('La reserva manual de folios ya no se usa. Utiliza sincronizar folios.', 'info');
        return null;
    }

    async fetchLastFolio(tipoDTE) {
        return invoicingFolioService.fetchLastFolio({
            tipoDTE,
            currentConfig: this.currentConfig,
            inputId: 'dte-folio'
        });
    }

    async pollFolio() {
        if (!invoicingFolioService.resolvePollTarget(this.activeTab)) {
            this.stopFolioPolling();
            return null;
        }

        return invoicingFolioService.poll({
            activeTab: this.activeTab,
            currentConfig: this.currentConfig,
            api,
            onConfigUpdated: (config) => {
                this.currentConfig = config;
            }
        });
    }

    async emitDebitNote() {
        return invoicingAdjustmentEmission.emitDebitNote({
            page: this,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            defaultEmisor: DEFAULT_EMISOR
        });
    }

    // ── Historial de Documentos ─────────────────────────────────────────────
    fetchHistory() {
        this.historyData = null;
        return window.ValmuInvoicingHistoryController.fetch(this);
    }

    setHistoryFilter(filter) {
        return window.ValmuInvoicingHistoryController.setFilter(this, filter);
    }

    setHistoryPage(page) {
        return window.ValmuInvoicingHistoryController.setPage(this, page);
    }

    handleSearch(value) {
        return window.ValmuInvoicingHistoryController.handleSearch(this, value);
    }

    async handleDelete(filename, idXml) {
        if (!filename && !idXml) return Toast.show('Documento inválido', 'error');
        
        const ok = await Swal?.fire?.({
            title: '¿Eliminar documento?',
            text: '¿Seguro que deseas eliminar este documento del historial y servidor? Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#f3f4f6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: '<span style="color: #374151">Cancelar</span>',
            customClass: {
                popup: 'rounded-2xl',
                confirmButton: 'rounded-xl px-6 py-2 font-semibold text-sm',
                cancelButton: 'rounded-xl px-6 py-2 font-semibold text-sm border-0'
            }
        });

        if (!ok?.isConfirmed) return;

        try {
            if (!idXml || idXml === 'null' || idXml === 'undefined' || idXml === '') {
                await Swal?.fire?.({
                    title: 'Error de Sincronización',
                    text: 'El servidor remoto no entregó el ID numérico de este documento (id_xml). Asegúrate de haber subido la última versión de "api-valmu" al VPS.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            try {
                await api.deleteXml(idXml);
            } catch (apiErr) {
                console.warn('Error al borrar en API:', apiErr);
                await Swal?.fire?.({
                    title: 'Error de servidor',
                    text: `No se pudo borrar el registro remoto: ${apiErr.message}`,
                    icon: 'warning',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }
            
            if (filename && filename !== 'null' && filename !== 'undefined' && typeof window.electronAPI?.deleteInvoiceFiles === 'function') {
                await window.electronAPI.deleteInvoiceFiles(filename);
            }

            Toast.show('Documento eliminado', 'success');
            this.fetchHistory();
        } catch (error) {
            Toast.show('Error al eliminar: ' + error.message, 'error');
        }
    }

    async querySiiStatus(trackId, idXml, docBase64) {
        let docData = null;
        try {
            if (docBase64) {
                docData = JSON.parse(atob(docBase64));
            }
        } catch (e) { console.error('Error parseando docBase64', e); }

        let finalTrackId = trackId;
        
        if (!finalTrackId || finalTrackId === 'undefined' || finalTrackId === 'null') {
            const { value: inputTrackId, isConfirmed } = await Swal.fire({
                title: 'Consultar Estado',
                html: `
                    <p class="text-sm text-gray-500 mb-4">Esta factura no tiene un TrackID guardado. Si lo conoces, ingrésalo a continuación.</p>
                    <p class="text-xs font-bold text-gray-400 mb-2">SI DEJAS ESTE CAMPO EN BLANCO Y PULSAS CONSULTAR:</p>
                    <p class="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg">Se realizará una consulta "Por Folio" (QueryEstDte) para verificar directamente si la factura fue recibida comercialmente por el SII.</p>
                `,
                input: 'text',
                inputPlaceholder: 'Ej: 12060061078 (Opcional)',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#f3f4f6',
                confirmButtonText: 'Consultar al SII',
                cancelButtonText: '<span style="color: #374151">Cancelar</span>',
                customClass: {
                    popup: 'rounded-2xl',
                    confirmButton: 'rounded-xl px-6 py-2 font-semibold text-sm',
                    cancelButton: 'rounded-xl px-6 py-2 font-semibold text-sm border-0'
                }
            });

            if (!isConfirmed) return;
            finalTrackId = inputTrackId ? inputTrackId.trim() : null;
        }

        if (!window.electronAPI?.querySiiStatus) return Toast.show('Tu versión no soporta consultas directas al SII. Actualiza el sistema.', 'error');

        try {
            const config = JSON.parse(localStorage.getItem('sii_config') || '{}');
            const rutEmpresa = config.rut_empresa;
            const rutFirma = config.rut_certificado;
            
            if (!rutEmpresa || !rutFirma) {
                return Toast.show('Faltan datos de configuración SII (RUT Empresa o RUT Firma)', 'warning');
            }

            Swal.fire({
                title: 'Consultando al SII...',
                text: 'Conectando directamente con palena.sii.cl',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const authHeader = 'Basic ' + btoa('api:' + config.apiKey);
            const tokenRes = await fetch('https://api.simpleapi.cl/api/v1/sii/token', {
                method: 'GET',
                headers: { Authorization: authHeader }
            });
            const tokenData = await tokenRes.json();
            const token = tokenData.token;

            if (!token) throw new Error('No se pudo obtener el token del SII');

            let result;
            let isEnvioStatus = false;
            let isBoleta = docData && (String(docData.type) === '39' || String(docData.type) === '41');

            if (finalTrackId) {
                isEnvioStatus = true;
                if (isBoleta) {
                    result = await window.electronAPI.querySiiBoletaStatus({
                        trackId: finalTrackId,
                        token,
                        rutEmpresa
                    });
                } else {
                    result = await window.electronAPI.querySiiStatus({
                        trackId: finalTrackId,
                        token,
                        rutEmpresa,
                        rutFirma
                    });
                }
            } else {
                if (!docData) throw new Error('No se puede consultar por folio: faltan datos del documento en la tabla.');
                
                if (isBoleta) {
                    result = await window.electronAPI.querySiiBoletaDteStatus({
                        rutEmpresa,
                        rutReceptor: docData.customerRut,
                        tipoDte: docData.type,
                        folio: docData.folio,
                        token,
                        monto: docData.amount,
                        fecha: docData.date
                    });
                } else {
                    result = await window.electronAPI.querySiiDteStatus({
                        rutEmpresa,
                        rutFirma,
                        token,
                        tipoDte: docData.type,
                        folio: docData.folio,
                        rutReceptor: docData.customerRut,
                        monto: docData.amount,
                        fecha: docData.date
                    });
                }
            }

            if (!result.success) {
                throw new Error(result.error || 'Error desconocido al consultar el SII');
            }

            let isAccepted = false;
            let isRejected = false;

            if (isBoleta) {
                // REST API returns JSON. The IPC wrapper returns stringified JSON in result.result and parsed JSON in result.json
                const json = result.json || {};
                const estado = json.estado || '';
                isAccepted = estado === 'REC' || estado === 'EPR' || estado === 'ACE' || estado === 'RSC';
                isRejected = estado === 'RCH' || estado === 'RFR' || estado === 'RVA' || estado === 'RMD';
            } else if (isEnvioStatus) {
                isAccepted = result.result.includes('EPR - Envio Procesado');
                isRejected = result.result.includes('RCH - ') || result.result.includes('RFR - ');
            } else {
                isAccepted = result.result.includes('DTE Recibido') || result.result.includes('DTE Aceptado');
                isRejected = result.result.includes('DTE Rechazado') || result.result.includes('DTE No Recibido');
            }

            await Swal.fire({
                title: isEnvioStatus ? 'Respuesta del Envío (TrackID)' : 'Respuesta del Documento (Folio)',
                html: `<pre class="text-left text-xs bg-gray-50 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">${this.escapeHtml(result.result)}</pre>`,
                icon: isAccepted ? 'success' : (isRejected ? 'error' : 'info'),
                confirmButtonColor: isAccepted ? '#059669' : '#ef4444',
                confirmButtonText: 'Aceptar',
                customClass: { popup: 'rounded-2xl w-full max-w-2xl' }
            });

            if (isAccepted && idXml && typeof api.updateDteStatus === 'function') {
                try {
                    await api.updateDteStatus(idXml, 'ACEPTADO SII');
                    this.fetchHistory();
                } catch (e) { console.warn('No se auto-actualizo estado a ACEPTADO SII:', e); }
            } else if (isRejected && idXml && typeof api.updateDteStatus === 'function') {
                try {
                    await api.updateDteStatus(idXml, 'RECHAZADO SII');
                    this.fetchHistory();
                } catch (e) { console.warn('No se auto-actualizo estado a RECHAZADO SII:', e); }
            }
        } catch (error) {
            Swal.fire({
                title: 'Error de Consulta',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    }

    createPdfFromXmlWrapper(type, folio, filename, idXml) {
        return window.ValmuInvoicingDocuments.createPdfFromXmlWrapper({
            type,
            folio,
            filename,
            idXml,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            createPdfFromXml: (xmlContent, targetFilename, targetFolder) => this.createPdfFromXml(xmlContent, targetFilename, targetFolder)
        });
    }

    async duplicateInvoice(type, folio, filename, idXml) {
        if (!['33', '34', '39'].includes(String(type))) {
            return Toast.show('Solo se pueden duplicar facturas o boletas.', 'warning');
        }

        this.activeTab = 'create';
        await this.updateUI();

        const success = await window.ValmuInvoicingDocuments.loadDteDataFromXml({
            type,
            folio,
            activeTab: 'create',
            electronAPI: window.electronAPI,
            toast: Toast,
            calcNCLine: this.calcLine,
            calcNDLine: this.calcLine
        });

        if (success) {
            const tipoSelect = document.getElementById('dte-tipo');
            if (tipoSelect) {
                tipoSelect.value = String(type);
            }
            Toast.show('Documento clonado. Listo para emitir de nuevo.', 'success');
        }
    }

    // ── Subir DTE local al servidor ─────────────────────────────────────────
    async uploadLocalDteToServer(type, folio, btnElement) {

        // 1. Buscar el documento en el historial cacheado
        const doc = (this.historyData || []).find(
            (d) => String(d.type) === String(type) && String(d.folio) === String(folio)
        );

        if (!doc) {
            return Toast.show(`No se encontró el DTE ${type}-${folio} en el historial`, 'error');
        }

        if (doc.is_db_record) {
            return Toast.show('Este DTE ya está en el servidor', 'info');
        }

        // 2. Determinar cómo leer el XML
        const xmlPath = doc.xmlPath;   // ruta absoluta del XML local (puede ser null)
        const filename = doc.filename;   // nombre del archivo, ej: DTE_33_Folio_1.xml
        const folder = doc.folder;     // 'facturas' | 'notas_de_credito' | 'notas_de_debito'

        if (!filename) {
            return Toast.show('No hay archivo XML disponible para subir', 'error');
        }

        // Feedback visual en el botón
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Subiendo...';
        }

        try {
            let xmlContent = null;

            // Patrón confirmado: readLocalText('folder/filename') relativo a sii_data/
            if (folder && filename) {
                try {
                    xmlContent = await window.electronAPI.readLocalText(`${folder}/${filename}`);
                } catch (_) { xmlContent = null; }
            }

            // Fallback: el filename trae el nombre del DTE estándar
            if (!xmlContent && type && folio) {
                const stdName = `DTE_${type}_Folio_${folio}.xml`;
                try {
                    xmlContent = await window.electronAPI.readLocalText(`${folder}/${stdName}`);
                } catch (_) { xmlContent = null; }
            }

            if (!xmlContent) {
                throw new Error(`No se pudo leer el XML local del archivo "${filename}"`);
            }

            // 3. Subir al servidor
            const result = await window.ValmuInvoicingApi.uploadXml(type, folio, xmlContent, {
                estadoSii: 'GENERADO'
            });

            if (result?.skipped) {
                Toast.show(`Advertencia: ${result.reason}`, 'warning');
                if (btnElement) {
                    btnElement.disabled = false;
                    btnElement.innerHTML = '<i class="fas fa-cloud-upload-alt mr-1"></i> Subir';
                }
                return;
            }

            Toast.show(`DTE ${type}-${folio} subido al servidor ✓`, 'success');

            // 4. Actualizar el historial (botón desaparece al refrescar)
            this.historyData = null;
            this.fetchHistory();

        } catch (error) {
            console.error('[DTE Upload]', error);
            Toast.show(`Error al subir: ${error.message}`, 'error');
            // El archivo local se mantiene intacto
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = '<i class="fas fa-cloud-upload-alt mr-1"></i> Subir';
            }
        }
    }

    async sendGeneratedDteToSii(type, folio, idXml, btnElement) {
        if (!type || !folio) {
            return Toast.show('Documento inválido', 'error');
        }

        const originalHtml = btnElement ? btnElement.innerHTML : '';
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            // 1. Obtener la configuración de SII
            await this.loadConfig(); // Carga this.currentConfig
            const local = {
                ...JSON.parse(localStorage.getItem('sii_config') || '{}'),
                ...((await window.electronAPI?.getSiiConfig?.()) || {})
            };
            localStorage.setItem('sii_config', JSON.stringify(local));
            const config = {
                ...local,
                rutEmisor: local.rutEmisor || DEFAULT_EMISOR.rut
            };

            const { apiKey, rutEmisor } = config;

            if (!apiKey || !rutEmisor) {
                throw new Error('Falta configuración del SII (API Key o RUT Emisor)');
            }

            // 2. Descargar el XML del servidor o leer localmente
            let xmlContent = null;
            if (idXml && idXml !== 'null' && idXml !== 'undefined' && idXml !== '') {
                try {
                    xmlContent = await api.downloadXml(idXml);
                } catch (err) {
                    console.warn('Error al descargar XML del servidor, intentando local:', err);
                }
            }

            if (!xmlContent) {
                // Buscar localmente
                const doc = (this.historyData || []).find(
                    (d) => String(d.type) === String(type) && String(d.folio) === String(folio)
                );
                if (doc && doc.filename && doc.folder) {
                    xmlContent = await window.electronAPI.readLocalText(`${doc.folder}/${doc.filename}`);
                }
            }

            if (!xmlContent) {
                throw new Error('No se pudo encontrar el archivo XML local ni remoto.');
            }

            // 3. Generar token
            const token = await this.getBearerToken();
            if (!token) {
                throw new Error('No se pudo obtener el token de autenticación.');
            }

            // 4. Leer el certificado
            const certBase64Data = await window.electronAPI.readLocalCert('certificado.pfx');
            if (!certBase64Data) {
                throw new Error('Falta Certificado Digital (no instalado)');
            }
            const certBlob = window.ValmuInvoicingUtils.b64toBlob(certBase64Data);

            // 5. Enviar usando transport
            const sendResult = await window.ValmuInvoicingTransport.sendDTE({
                dteXmlContent: xmlContent,
                config,
                tipoDTE: Number(type),
                token,
                certBlob,
                toast: Toast
            });

            if (window.ValmuInvoicingTransport.isSuccessfulSiiSend(sendResult)) {
                const trackId = window.ValmuInvoicingTransport.getSiiTrackId(sendResult);
                if (idXml && idXml !== 'null' && idXml !== 'undefined' && idXml !== '') {
                    await api.updateDteStatus(idXml, 'ENVIADO_SII', trackId);
                } else {
                    // Si no estaba en el servidor, subirlo ahora
                    await api.uploadXml(type, folio, xmlContent, {
                        trackId,
                        estadoSii: 'ENVIADO_SII'
                    });
                }
                Toast.show('Factura enviada al SII exitosamente', 'success');
                this.historyData = null;
                await this.fetchHistory();
            } else {
                throw new Error('La API del SII rechazó o devolvió un formato inesperado.');
            }

        } catch (error) {
            console.error('[Send Generated DTE Error]:', error);
            const userMsg = window.ValmuInvoicingTransport.cleanSiiErrorMessage(error);
            Swal.fire({
                title: 'Error de Envío',
                text: userMsg,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = originalHtml;
            }
        }
    }

    async loadFromSaleDetails(saleId, type, idXml, btnElement) {
        if (!saleId) {
            return Toast.show('ID de venta inválido', 'error');
        }

        const originalHtml = btnElement ? btnElement.innerHTML : '';
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            Toast.show('Obteniendo detalles de la venta...', 'info');
            const sale = await api.getSaleDetails(saleId);
            if (!sale || !sale.cabecera) {
                throw new Error('No se pudieron obtener los datos de la venta');
            }

            // Cambiar a la pestaña de creación
            this.activeTab = 'create';
            await this.updateUI();

            // Esperar un instante para que el DOM esté listo
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Rellenar Receptor
            const cab = sale.cabecera;
            const fields = {
                'rut-recep': cab.rut_cliente,
                'rzn-recep': cab.nombreCliente || 'PARTICULAR',
                'dir-recep': cab.direccion_cliente || '',
                'cmna-recep': cab.comuna_cliente || '',
                'giro-recep': cab.giro_cliente || 'PARTICULAR',
                'ciudad-recep': cab.ciudad_cliente || cab.comuna_cliente || ''
            };

            for (const [suffix, value] of Object.entries(fields)) {
                const el = document.getElementById(`dte-${suffix}`);
                if (el) {
                    el.value = value || '';
                }
            }

            // Rellenar tipo de DTE
            const tipoSelect = document.getElementById('dte-tipo');
            if (tipoSelect && type) {
                tipoSelect.value = String(type);
            }

            // Rellenar Productos
            const container = document.getElementById('invoice-items-container');
            if (container && Array.isArray(sale.productos) && sale.productos.length > 0) {
                // Eliminar filas existentes
                container.innerHTML = '';

                for (let i = 0; i < sale.productos.length; i++) {
                    const prod = sale.productos[i];
                    const btnAdd = document.getElementById('btn-add-line');
                    if (btnAdd) {
                        btnAdd.click();
                    }

                    const targetRow = container.lastElementChild;
                    if (targetRow) {
                        targetRow.querySelector('.item-nombre').value = prod.nombreProducto || '';
                        targetRow.querySelector('.item-qty').value = prod.cantidadVenta || 1;
                        
                        // Los precios de venta de la base de datos están en bruto (con IVA). 
                        // El formulario de factura manual asume precio NETO.
                        const precioNeto = Math.round(Number(prod.precioVenta || 0) / 1.19);
                        targetRow.querySelector('.item-price').value = precioNeto;

                        const qtyInput = targetRow.querySelector('.item-qty');
                        if (typeof this.calcLine === 'function') {
                            this.calcLine(qtyInput);
                        }
                    }
                }
            }

            // Eliminar registro DTE fallido anterior si idXml existe
            if (idXml && idXml !== 'null' && idXml !== 'undefined' && idXml !== '') {
                try {
                    await api.deleteXml(idXml);
                    console.log(`DTE fallido anterior (${idXml}) eliminado de la base de datos.`);
                } catch (delErr) {
                    console.warn('Error al eliminar DTE fallido anterior:', delErr);
                }
            }

            Toast.show('Venta cargada correctamente. Lista para emitir.', 'success');

        } catch (error) {
            console.error('[Load Sale Details Error]:', error);
            Toast.show(`Error al cargar datos: ${error.message}`, 'error');
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = originalHtml;
            }
        }
    }

    async fetchHistory() {
        this.historyData = null;
        return invoicingHistoryController.fetch(this);
    }

    setHistoryFilter(filter) {
        return invoicingHistoryController.setFilter(this, filter);
    }

    setHistoryPage(page) {
        return invoicingHistoryController.setPage(this, page);
    }

    handleSearch(value) {
        return invoicingHistoryController.handleSearch(this, value);
    }



    async createPdfFromXmlWrapper(type, folio, filename, idXml) {
        return invoicingDocuments.createPdfFromXmlWrapper({
            type,
            folio,
            filename,
            idXml,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            createPdfFromXml: (xmlContent, targetFilename, targetFolder) => this.createPdfFromXml(xmlContent, targetFilename, targetFolder)
        });
    }
}


// Instantiate and expose globally
window.invoicePage = new InvoicesPage();

// --- BINDING FOR VALMU ADMIN ROUTING ---
const invoicePageInstance = new InvoicesPage();

// The Valmu routing loads via function names matching 'renderX'
async function renderInvoicing() {
    console.log("Calling renderInvoicing...");
    const container = document.getElementById('content-area');
    if (container) {
        // Clear previous custom valmu CSS classes from container if any
        container.className = 'content-area';
        await invoicePageInstance.render(container);
    }
}

console.log("invoicing.js finished. renderInvoicing defined:", typeof renderInvoicing);
// Expose legacy name if needed elsewhere
window.renderInvoicing = renderInvoicing;










