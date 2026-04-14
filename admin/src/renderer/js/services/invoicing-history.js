window.ValmuInvoicingHistory = {
    parseXmlSummary(xmlContent) {
        if (!xmlContent) {
            return null;
        }

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const getTag = (tag, parent = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
            const receptorNode = xmlDoc.getElementsByTagName('Receptor')[0] || xmlDoc;

            return {
                amount: Number(getTag('MntTotal')) || 0,
                date: getTag('FchEmis') || '',
                customerRut: getTag('RUTRecep', receptorNode),
                customerName: getTag('RznSocRecep', receptorNode) || getTag('RznSoc', receptorNode)
            };
        } catch (error) {
            console.warn('[HISTORY] No se pudo parsear XML local:', error);
            return null;
        }
    },

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
                const searchStr = [
                    doc.folio,
                    doc.type,
                    doc.amount,
                    doc.customerName,
                    doc.customerRut,
                    doc.date ? new Date(doc.date).toLocaleDateString('es-CL') : ''
                ].filter(Boolean).join(' ').toLowerCase();

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

        const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalItems = sorted.length;
        const totalPages = Math.ceil(totalItems / historyItemsPerPage);
        const safePage = Math.min(Math.max(historyPage || 1, 1), totalPages);
        const startIndex = (safePage - 1) * historyItemsPerPage;
        const endIndex = startIndex + historyItemsPerPage;
        const visibleItems = sorted.slice(startIndex, endIndex);

        const gridHtml = `
            <div class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
                ${visibleItems.map((doc) => {
            let label = 'DTE';
            let accentColor = 'gray';
            let icon = 'bi-file-earmark-text';

            if (doc.type === '33') { label = 'Factura'; accentColor = 'blue'; icon = 'bi-file-earmark-spreadsheet-fill'; }
            else if (doc.type === '34') { label = 'Factura Exenta'; accentColor = 'indigo'; icon = 'bi-file-earmark-richtext-fill'; }
            else if (doc.type === '39') { label = 'Boleta'; accentColor = 'amber'; icon = 'bi-receipt-cutoff'; }
            else if (doc.type === '61') { label = 'N. Credito'; accentColor = 'red'; icon = 'bi-file-earmark-minus-fill'; }
            else if (doc.type === '56') { label = 'N. Debito'; accentColor = 'emerald'; icon = 'bi-file-earmark-plus-fill'; }

            const isLocalOnly = !doc.is_db_record;
            const statusNormalized = String(doc.status || 'GENERADO').toLowerCase();
            const statusColor = statusNormalized === 'aceptado' || statusNormalized === 'enviado_sii'
                ? 'text-emerald-600'
                : statusNormalized === 'error_envio'
                    ? 'text-red-500'
                    : 'text-gray-500';
            const amountFormatted = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(doc.amount || 0);
            const issuedDate = doc.date ? new Date(doc.date) : null;
            const issuedDateLabel = issuedDate && !Number.isNaN(issuedDate.getTime())
                ? issuedDate.toLocaleDateString('es-CL')
                : 'Sin fecha';
            const customerLabel = doc.customerName || doc.customerRut || 'Sin receptor asociado';
            const sourceLabel = doc.is_db_record ? 'Respaldo centralizado' : 'Origen local';
            const syncBadge = isLocalOnly
                ? '<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 border border-amber-100"><i class="bi bi-laptop text-xs"></i> Solo local</span>'
                : '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 border border-emerald-100"><i class="bi bi-database-fill text-xs"></i> Servidor</span>';

            return `
                        <div class="bg-white max-w-[430px] rounded-[28px] border border-[#f1e5d8] shadow-[0_16px_50px_rgba(78,44,20,0.08)] p-5 hover:shadow-[0_20px_60px_rgba(78,44,20,0.12)] transition-all group relative overflow-hidden">
                            <div class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-${accentColor}-400 via-orange-300 to-transparent opacity-80"></div>

                            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4 relative z-10">
                                <div class="flex items-start gap-4 min-w-0">
                                    <div class="h-12 w-12 rounded-2xl bg-${accentColor}-50 text-${accentColor}-600 flex items-center justify-center text-xl shadow-inner border border-${accentColor}-100/50 shrink-0">
                                        <i class="bi ${icon}"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex flex-wrap items-center gap-2 mb-1.5">
                                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.22em]">${label}</span>
                                            ${syncBadge}
                                        </div>
                                        <div class="text-xl font-black text-gray-900 leading-none">#${doc.folio}</div>
                                        <div class="mt-1.5 text-sm font-bold text-gray-500 truncate">${customerLabel}</div>
                                    </div>
                                </div>

                                <div class="md:text-right">
                                    <div class="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em] mb-1">Estado SII</div>
                                    <div class="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5">
                                        <div class="h-2 w-2 rounded-full bg-current ${statusColor}"></div>
                                        <span class="text-[11px] font-black uppercase ${statusColor}">${doc.status || 'GENERADO'}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-2.5 mb-4 relative z-10">
                                <div class="rounded-2xl border border-gray-100 bg-[#fcfaf7] px-3 py-2.5 min-w-0">
                                    <div class="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-1">Fecha emision</div>
                                    <div class="text-sm font-black text-gray-800">${issuedDateLabel}</div>
                                </div>
                                <div class="rounded-2xl border border-gray-100 bg-[#fcfaf7] px-3 py-2.5 min-w-0">
                                    <div class="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-1">Monto total</div>
                                    <div class="text-lg font-black text-gray-900 leading-tight">${amountFormatted}</div>
                                </div>
                                <div class="rounded-2xl border border-gray-100 bg-[#fcfaf7] px-3 py-2.5 min-w-0">
                                    <div class="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-1">Origen</div>
                                    <div class="text-sm font-black text-gray-800">${sourceLabel}</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-12 gap-2.5 relative z-10">
                                <button onclick="invoicePage.createPdfFromXmlWrapper('${doc.type}', '${doc.folio}', '${doc.filename || ''}', '${doc.id_xml || ''}')" 
                                    class="col-span-7 bg-gray-900 text-white rounded-2xl py-3 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200">
                                    <i class="bi bi-file-pdf"></i> Ver documento
                                </button>
                                
                                <button onclick="invoicePage.handleDelete('${doc.filename}')" 
                                    class="col-span-5 bg-gray-50 text-gray-500 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center gap-2 border border-gray-100 py-3 text-[11px] font-black uppercase tracking-[0.18em]">
                                    <i class="bi bi-trash-fill"></i> Eliminar
                                </button>

                                ${isLocalOnly ? `
                                    <button onclick="invoicePage.uploadLocalDteToServer('${doc.type}', '${doc.folio}', this)" 
                                        class="col-span-12 bg-orange-600 text-white rounded-2xl py-3 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-100">
                                        <i class="bi bi-cloud-arrow-up-fill text-sm"></i> Sincronizar con servidor
                                    </button>
                                ` : ''}
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
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pagina</span>
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

    async fetchMergedHistory({ api, electronAPI } = {}) {
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
            localFiles = localFiles.concat(files.map((file) => ({ ...file, folder })));
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

        const xmlSummaryMap = new Map();
        await Promise.all(Array.from(localMap.entries()).map(async ([key, localData]) => {
            if (!localData?.xml?.name || !localData?.xml?.folder) {
                return;
            }

            try {
                const xmlContent = await electronAPI.readLocalText(`${localData.xml.folder}/${localData.xml.name}`);
                const summary = this.parseXmlSummary(xmlContent);
                if (summary) {
                    xmlSummaryMap.set(key, summary);
                }
            } catch (error) {
                console.warn(`[HISTORY] No se pudo leer XML local para ${key}:`, error);
            }
        }));

        const processedMap = new Map();

        xmlList.forEach((xmlRecord) => {
            if (Array.isArray(xmlRecord)) {
                return;
            }

            const type = String(xmlRecord.tipoDte || xmlRecord.doc_type || xmlRecord.docType || xmlRecord.type || xmlRecord.dte_type || '');
            const folio = String(xmlRecord.folio || xmlRecord.ticket_id || xmlRecord.number || '');
            if (!type || !folio) {
                return;
            }

            const key = `${type}_${folio}`;
            const sale = salesMap.get(key);
            const local = localMap.get(key);
            const xmlSummary = xmlSummaryMap.get(key);
            const dateStr = xmlSummary?.date || xmlRecord.fechaGuardado || sale?.created_at || xmlRecord.created_at || new Date().toISOString();
            const amount = sale
                ? (sale.total || sale.total_amount || xmlSummary?.amount || 0)
                : (xmlSummary?.amount || 0);
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
                customerRut: xmlSummary?.customerRut || sale?.rut_cliente || sale?.customer_rut || '',
                customerName: xmlSummary?.customerName || sale?.nombre_cliente || sale?.customer_name || sale?.cliente || '',
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
            const xmlSummary = xmlSummaryMap.get(key);
            const dateVal = xmlSummary?.date || fileRef.mtime || new Date();

            processedMap.set(key, {
                filename: fileRef.name,
                pdfName: localData.pdf?.name || null,
                pdfPath: localData.pdf?.path || null,
                xmlPath: localData.xml?.path || null,
                type,
                folio,
                date: new Date(dateVal),
                folder: this.getFolderForType(type),
                amount: Number(xmlSummary?.amount || 0),
                customerRut: xmlSummary?.customerRut || '',
                customerName: xmlSummary?.customerName || '',
                status: 'Local (Solo PC)',
                is_db_record: false,
                hasFile: !!localData.pdf
            });
        });

        return Array.from(processedMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    }
};
