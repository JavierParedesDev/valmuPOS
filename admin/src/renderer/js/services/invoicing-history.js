window.ValmuInvoicingHistory = {
    getFolderForType(type) {
        if (String(type) === '61') {
            return 'notas_de_credito';
        }

        if (String(type) === '56') {
            return 'notas_de_debito';
        }

        return 'facturas';
    },

    renderGrid({
        historyData = [],
        currentFilter = 'all',
        searchTerm = '',
        historyPage = 1,
        historyItemsPerPage = 15
    } = {}) {
        const normalizedSearch = String(searchTerm || '').toLowerCase();
        const filtered = historyData.filter((doc) => {
            if (normalizedSearch) {
                const searchStr = `${doc.folio} ${doc.type} ${doc.amount || ''} ${doc.date ? new Date(doc.date).toLocaleDateString() : ''}`.toLowerCase();
                if (!searchStr.includes(normalizedSearch)) {
                    return false;
                }
            }

            if (currentFilter === 'all') return true;
            if (currentFilter === 'facturas' && (doc.type === '33' || doc.type === '34')) return true;
            if (currentFilter === 'boletas' && doc.type === '39') return true;
            if (currentFilter === 'notas_de_credito' && doc.type === '61') return true;
            if (currentFilter === 'notas_de_debito' && doc.type === '56') return true;
            return false;
        });

        if (!filtered.length) {
            return {
                gridHtml: `
                    <div class="flex flex-col items-center justify-center py-24 text-gray-300">
                        <i class="bi bi-search text-5xl mb-4 opacity-20"></i>
                        <p class="text-xs font-black uppercase tracking-widest">Sin coincidencias encontradas</p>
                    </div>
                `,
                paginationHtml: '',
                meta: { currentPage: 1, totalPages: 0, totalDocs: 0 }
            };
        }

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / historyItemsPerPage);
        const safePage = Math.min(Math.max(historyPage || 1, 1), totalPages);
        const startIndex = (safePage - 1) * historyItemsPerPage;
        const endIndex = startIndex + historyItemsPerPage;
        const visibleItems = filtered.slice(startIndex, endIndex);

        const gridHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${visibleItems.map((doc) => {
            let label = 'DTE';
            let accentColor = 'gray'; // default
            let icon = 'bi-file-earmark-text';

            if (doc.type === '33') { label = 'Factura'; accentColor = 'blue'; icon = 'bi-file-earmark-spreadsheet-fill'; }
            else if (doc.type === '34') { label = 'Factura Exenta'; accentColor = 'indigo'; icon = 'bi-file-earmark-richtext-fill'; }
            else if (doc.type === '39') { label = 'Boleta'; accentColor = 'amber'; icon = 'bi-receipt-cutoff'; }
            else if (doc.type === '61') { label = 'N. Crédito'; accentColor = 'red'; icon = 'bi-file-earmark-minus-fill'; }
            else if (doc.type === '56') { label = 'N. Débito'; accentColor = 'emerald'; icon = 'bi-file-earmark-plus-fill'; }

            const isLocalOnly = !doc.is_db_record;
            const statusColor = doc.status?.toLowerCase() === 'aceptado' ? 'text-emerald-500' : 'text-gray-400';
            const amountFormatted = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(doc.amount || 0);

            return `
                        <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 hover:shadow-xl hover:shadow-gray-200/40 transition-all group relative overflow-hidden">
                            <!-- Background Decor -->
                            <div class="absolute -right-8 -top-8 w-24 h-24 bg-${accentColor}-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <!-- Header -->
                            <div class="flex justify-between items-start mb-6 relative z-10">
                                <div class="h-12 w-12 rounded-2xl bg-${accentColor}-50 text-${accentColor}-600 flex items-center justify-center text-xl shadow-inner border border-${accentColor}-100/50">
                                    <i class="bi ${icon}"></i>
                                </div>
                                <div class="text-right">
                                    <div class="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">${label}</div>
                                    <div class="text-xl font-black text-gray-900 group-hover:text-orange-600 transition-colors">#${doc.folio}</div>
                                </div>
                            </div>

                            <!-- Data -->
                            <div class="space-y-3 mb-6 relative z-10">
                                <div class="flex justify-between items-center text-[10px] font-bold">
                                    <span class="text-gray-400 uppercase tracking-tighter">Fecha Emisión</span>
                                    <span class="text-gray-700">${new Date(doc.date).toLocaleDateString()}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Monto Total</span>
                                    <span class="text-lg font-black text-gray-900">${amountFormatted}</span>
                                </div>
                                <div class="pt-3 border-t border-gray-50 flex justify-between items-center">
                                    <span class="text-[9px] font-black text-gray-300 uppercase">Estado SII</span>
                                    <div class="flex items-center gap-1.5">
                                        <div class="h-1.5 w-1.5 rounded-full bg-current ${statusColor}"></div>
                                        <span class="text-[10px] font-black uppercase ${statusColor}">${doc.status || 'GENERADO'}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="grid grid-cols-12 gap-2 relative z-10">
                                <button onclick="invoicePage.createPdfFromXmlWrapper('${doc.type}', '${doc.folio}', '${doc.filename || ''}')" 
                                    class="col-span-8 bg-gray-900 text-white rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200">
                                    <i class="bi bi-file-pdf"></i> DOCUMENTO
                                </button>
                                
                                <button onclick="invoicePage.handleDelete('${doc.filename}')" 
                                    class="col-span-4 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center border border-gray-100">
                                    <i class="bi bi-trash-fill"></i>
                                </button>

                                ${isLocalOnly ? `
                                    <button onclick="invoicePage.uploadLocalDteToServer('${doc.type}', '${doc.folio}', this)" 
                                        class="col-span-12 mt-1 bg-orange-600 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-100">
                                        <i class="bi bi-cloud-arrow-up-fill text-sm"></i> SINCRONIZAR CON SERVIDOR
                                    </button>
                                ` : ''}
                            </div>

                            <!-- Source Indicator -->
                            <div class="mt-4 pt-4 border-t border-gray-50 flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                <i class="bi ${doc.is_db_record ? 'bi-database-fill' : 'bi-laptop'} text-xs"></i>
                                <span class="text-[8px] font-black uppercase tracking-widest">${doc.is_db_record ? 'RESERVA CENTRALIZADA' : 'ORIGEN LOCAL'}</span>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        const paginationHtml = totalPages > 1
            ? `
                <button onclick="invoicePage.setHistoryPage(${safePage - 1})" 
                    class="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 hover:text-orange-600 hover:border-orange-100 transition-all shadow-sm disabled:opacity-30 disabled:pointer-events-none" 
                    ${safePage === 1 ? 'disabled' : ''}>
                    <i class="bi bi-chevron-left"></i>
                </button>
                
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Página</span>
                    <span class="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-900 text-white font-black text-xs shadow-lg shadow-gray-200">${safePage}</span>
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">de ${totalPages}</span>
                </div>

                <button onclick="invoicePage.setHistoryPage(${safePage + 1})" 
                    class="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 hover:text-orange-600 hover:border-orange-100 transition-all shadow-sm disabled:opacity-30 disabled:pointer-events-none" 
                    ${safePage === totalPages ? 'disabled' : ''}>
                    <i class="bi bi-chevron-right"></i>
                </button>
            `
            : `
                <div class="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Total: ${totalItems} documentos</div>
            `;

        return { gridHtml, paginationHtml, meta: { currentPage: safePage, totalPages, totalDocs: totalItems } };
    },

    async fetchMergedHistory({ api, electronAPI, toast } = {}) {
        console.log('[HISTORY] Fetching merged history (XML Primary)...');

        const xmlRes = await api.getXmlList(10000);
        const xmlList = Array.isArray(xmlRes) ? xmlRes : (xmlRes?.data || xmlRes?.files || []);
        console.log(`[HISTORY] Found ${xmlList.length} records in DB.`);

        let dbSales = [];
        try {
            const salesRes = await api.getSalesHistory(10000);
            if (salesRes && Array.isArray(salesRes.data)) {
                dbSales = salesRes.data;
            } else if (Array.isArray(salesRes)) {
                dbSales = salesRes;
            }
        } catch (error) {
            console.warn('[HISTORY] Sales fetch warning:', error);
        }

        const salesMap = new Map();
        dbSales.forEach((sale) => {
            const type = sale.doc_type || sale.dte_type;
            const folio = sale.folio || sale.ticket_id;
            if (type && folio) {
                salesMap.set(`${type}_${folio}`, sale);
            }
        });

        const folders = ['facturas', 'notas_de_credito', 'notas_de_debito'];
        let localFiles = [];
        for (const folder of folders) {
            const files = await electronAPI.listInvoices(folder);
            localFiles = localFiles.concat(files);
        }

        const localMap = new Map();
        localFiles.forEach((file) => {
            const match = file.name.match(/DTE_(\d+)_Folio_(\d+)/i) || file.name.match(/^(\d+)_(\d+)/i);
            if (!match) {
                return;
            }

            const key = `${match[1]}_${match[2]}`;
            if (!localMap.has(key)) {
                localMap.set(key, { pdf: null, xml: null });
            }

            if (file.ext === '.pdf') {
                localMap.get(key).pdf = file;
            }

            if (file.ext === '.xml') {
                localMap.get(key).xml = file;
            }
        });

        const processedMap = new Map();

        if (xmlList.length > 0) {
            const first = xmlList[0];
            console.log('[HISTORY] First Record Keys:', typeof first === 'object' ? Object.keys(first).join(',') : 'Not Object');
        }

        xmlList.forEach((xmlRecord) => {
            if (Array.isArray(xmlRecord)) {
                return;
            }

            // El servidor devuelve 'tipoDte' (nombre de columna en BD)
            const type = String(xmlRecord.tipoDte || xmlRecord.doc_type || xmlRecord.docType || xmlRecord.type || xmlRecord.dte_type || '');
            const folio = String(xmlRecord.folio || xmlRecord.ticket_id || xmlRecord.number || '');
            if (!type || !folio) {
                return;
            }

            const key = `${type}_${folio}`;
            const sale = salesMap.get(key);
            const local = localMap.get(key);
            const dateStr = xmlRecord.fechaGuardado || sale?.created_at || xmlRecord.created_at || new Date().toISOString();
            const amount = sale ? (sale.total || sale.total_amount || 0) : 0;
            const status = xmlRecord.estadoSii || (sale ? (sale.sii_status || sale.status) : 'GENERADO');

            processedMap.set(key, {
                id_xml: xmlRecord.id_xml || null,
                filename: xmlRecord.filename || `DTE_${type}_Folio_${folio}.xml`,
                pdfName: local?.pdf?.name || null,
                pdfPath: local?.pdf?.path || null,
                xmlPath: local?.xml?.path || null,
                type,
                folio,
                date: new Date(dateStr),
                folder: this.getFolderForType(type),
                amount: Number(amount) || 0,
                status,
                is_db_record: true,
                hasFile: !!local?.pdf
            });
        });

        localMap.forEach((localData, key) => {
            if (processedMap.has(key)) {
                return;
            }

            const fileRef = localData.xml || localData.pdf;
            if (!fileRef) {
                return;
            }

            const parts = key.split('_');
            const type = parts[0];
            const folio = parts[1];
            const dateVal = fileRef.mtime || new Date();

            processedMap.set(key, {
                filename: fileRef.name,
                pdfName: localData.pdf?.name || null,
                pdfPath: localData.pdf?.path || null,
                xmlPath: localData.xml?.path || null,
                type,
                folio,
                date: new Date(dateVal),
                folder: this.getFolderForType(type),
                amount: 0,
                status: 'Local (Solo PC)',
                is_db_record: false,
                hasFile: !!localData.pdf
            });
        });

        return Array.from(processedMap.values());
    }
};
