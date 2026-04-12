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
            <div class="h-full flex flex-col pt-4">
                <div class="flex items-center justify-between mb-8 px-8">
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter uppercase">Facturacion</h2>
                    <button class="bg-white border-2 border-gray-100 px-6 py-2 rounded-2xl text-[10px] font-black text-gray-400 hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm uppercase tracking-widest" onclick="window.electronAPI.toggleFullscreen()">
                        Pantalla completa
                    </button>
                </div>

                <div class="flex flex-wrap gap-2 px-8 mb-8">
                    <button data-tab="create" class="tab-btn min-w-[160px] px-6 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${this.activeTab === 'create' ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Factura Electrónica</button>
                    <button data-tab="note" class="tab-btn min-w-[160px] px-6 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${this.activeTab === 'note' ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Nota de Crédito</button>
                    <button data-tab="debit" class="tab-btn min-w-[160px] px-6 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${this.activeTab === 'debit' ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Nota de Débito</button>
                    <button data-tab="history" class="tab-btn min-w-[160px] px-6 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${this.activeTab === 'history' ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Historial</button>
                    <button data-tab="config" class="tab-btn min-w-[160px] px-6 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${this.activeTab === 'config' ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}">Configuración</button>
                </div>

                <div id="invoice-view-area" class="flex-1 overflow-y-auto px-8 no-scrollbar scroll-smooth">
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
        const folio61 = local.folio_61 || 41;

        return invoicingNoteView.render({
            config,
            today,
            folio: folio61
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
    async openRemoteXml(filename, folder) {
        return invoicingDocuments.openRemoteXml({
            filename,
            folder,
            api,
            toast: Toast,
            createPdfFromXml: (xmlContent, targetFilename, targetFolder) => this.createPdfFromXml(xmlContent, targetFilename, targetFolder)
        });
    }

    async createPdfFromXmlWrapper(type, folio, filename) {
        return invoicingDocuments.createPdfFromXmlWrapper({
            type,
            folio,
            filename,
            api,
            electronAPI: window.electronAPI,
            toast: Toast,
            createPdfFromXml: (xmlContent, targetFilename, targetFolder) => this.createPdfFromXml(xmlContent, targetFilename, targetFolder)
        });
    }

    async handleDelete(filename) {
        return invoicingDocuments.handleDelete({
            filename,
            api,
            toast: Toast,
            refreshHistory: async () => {
                await this.fetchHistory();
            }
        });
    }

    async downloadDteXml(filename, folder) {
        return invoicingDocuments.downloadAndSaveXml({
            filename,
            folder,
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
                saveConfig: () => this.saveConfig(),
                syncFolios: () => this.syncFolios(),
                reserveFolio: () => this.reserveFolio(),
                onConfigUpdated: (config) => {
                    this.currentConfig = config;
                },
                SwalRef: typeof Swal !== 'undefined' ? Swal : null
            });
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

    async handleDelete(filename) {
        if (!filename) return Toast.show('Nombre de archivo inválido', 'error');
        const ok = await Swal?.fire?.({
            title: '¿Eliminar documento?',
            text: `¿Seguro que deseas eliminar "${filename}"? Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!ok?.isConfirmed) return;

        try {
            await api.deleteXml(filename);
            Toast.show('Documento eliminado', 'success');
            this.fetchHistory();
        } catch (error) {
            Toast.show('Error al eliminar: ' + error.message, 'error');
        }
    }

    createPdfFromXmlWrapper(type, folio, filename) {
        const folder = window.ValmuInvoicingHistory.getFolderForType(type);
        return window.ValmuInvoicingDocuments?.createPdfFromXml?.({ type, folio, filename, folder, electronAPI: window.electronAPI, toast: Toast });
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










