window.ValmuInvoicingHistory = {
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatMoney(value) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
    },

    formatDate(value) {
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return 'Sin fecha';
        }

        return date.toLocaleDateString('es-CL');
    },

    parseXmlSummary(xmlContent) {
        if (!xmlContent) {
            return null;
        }

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const getTag = (tag, parent = xmlDoc) => parent.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
            const receptorNode = xmlDoc.getElementsByTagName('Receptor')[0] || xmlDoc;
            const detalleNodes = Array.from(xmlDoc.getElementsByTagName('Detalle'));
            const total = Number(getTag('MntTotal')) || 0;
            const neto = Number(getTag('MntNeto')) || 0;
            const exento = Number(getTag('MntExe')) || 0;
            const iva = Number(getTag('IVA')) || 0;

            return {
                amount: total,
                total,
                neto,
                exento,
                iva,
                date: getTag('FchEmis') || '',
                customerRut: getTag('RUTRecep', receptorNode),
                customerName: getTag('RznSocRecep', receptorNode) || getTag('RznSoc', receptorNode),
                itemCount: detalleNodes.length,
                firstItem: detalleNodes[0] ? getTag('NmbItem', detalleNodes[0]) : '',
                type: getTag('TipoDTE'),
                folio: getTag('Folio')
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
        const totals = filtered.reduce((acc, doc) => {
            acc.total += Number(doc.amount || doc.total || 0);
            acc.neto += Number(doc.neto || 0);
            acc.iva += Number(doc.iva || 0);
            acc.count += 1;
            return acc;
        }, { total: 0, neto: 0, iva: 0, count: 0 });

        const gridHtml = `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div class="rounded-2xl border border-[#eadbcb] bg-white p-4 shadow-sm">
                    <div class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">Documentos</div>
                    <div class="text-2xl font-black text-gray-900">${totals.count}</div>
                </div>
                <div class="rounded-2xl border border-[#eadbcb] bg-white p-4 shadow-sm">
                    <div class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">Neto XML</div>
                    <div class="text-xl font-black text-gray-900">${this.formatMoney(totals.neto)}</div>
                </div>
                <div class="rounded-2xl border border-[#eadbcb] bg-white p-4 shadow-sm">
                    <div class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">IVA XML</div>
                    <div class="text-xl font-black text-gray-900">${this.formatMoney(totals.iva)}</div>
                </div>
                <div class="rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm">
                    <div class="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600 mb-2">Total XML</div>
                    <div class="text-xl font-black text-gray-900">${this.formatMoney(totals.total)}</div>
                </div>
            </div>

            <div class="overflow-x-auto rounded-[22px] border border-[#eadbcb] bg-white shadow-[0_18px_55px_rgba(78,44,20,0.07)]">
                <div class="grid grid-cols-[100px_120px_minmax(210px,1.35fr)_110px_110px_120px_130px_160px] gap-3 bg-[#fff7ef] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#806758] min-w-[1120px]">
                    <div>Fecha</div>
                    <div>Documento</div>
                    <div>Receptor</div>
                    <div class="text-right">Neto</div>
                    <div class="text-right">IVA</div>
                    <div class="text-right">Total</div>
                    <div>Estado</div>
                    <div class="text-right">Acciones</div>
                </div>
                <div class="divide-y divide-[#f3e7dc] min-w-[1120px]">
                ${visibleItems.map((doc) => {
            let label = 'DTE';
            let icon = 'bi-file-earmark-text';
            let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';

            if (doc.type === '33') { label = 'Factura'; icon = 'bi-file-earmark-spreadsheet-fill'; badgeClass = 'bg-blue-50 text-blue-700 border-blue-100'; }
            else if (doc.type === '34') { label = 'Factura Exenta'; icon = 'bi-file-earmark-richtext-fill'; badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-100'; }
            else if (doc.type === '39') { label = 'Boleta'; icon = 'bi-receipt-cutoff'; badgeClass = 'bg-amber-50 text-amber-700 border-amber-100'; }
            else if (doc.type === '61') { label = 'N. Credito'; icon = 'bi-file-earmark-minus-fill'; badgeClass = 'bg-red-50 text-red-700 border-red-100'; }
            else if (doc.type === '56') { label = 'N. Debito'; icon = 'bi-file-earmark-plus-fill'; badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100'; }

            const isLocalOnly = !doc.is_db_record;
            const statusNormalized = String(doc.status || 'GENERADO').toLowerCase();
            const statusClass = statusNormalized.includes('acept') || statusNormalized.includes('enviado')
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : statusNormalized.includes('error') || statusNormalized.includes('rechaz')
                    ? 'bg-red-50 text-red-700 border-red-100'
                    : 'bg-gray-50 text-gray-600 border-gray-100';
            const customerLabel = this.escapeHtml(doc.customerName || doc.customerRut || 'Sin receptor asociado');
            const customerRut = this.escapeHtml(doc.customerRut || '');
            const firstItem = this.escapeHtml(doc.firstItem || '');
            const syncBadge = isLocalOnly
                ? '<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-700 border border-amber-100"><i class="bi bi-laptop"></i> Local</span>'
                : '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 border border-emerald-100"><i class="bi bi-database-fill"></i> Servidor</span>';

            return `
                        <div class="grid grid-cols-[100px_120px_minmax(210px,1.35fr)_110px_110px_120px_130px_160px] gap-3 items-center px-4 py-3 hover:bg-[#fffaf5] transition-colors">
                            <div class="text-sm font-black text-gray-800">${this.formatDate(doc.date)}</div>
                            <div>
                                <div class="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${badgeClass}">
                                    <i class="bi ${icon}"></i>
                                    ${label}
                                </div>
                                <div class="mt-1 text-sm font-black text-gray-900">#${this.escapeHtml(doc.folio)}</div>
                            </div>
                            <div class="min-w-0">
                                <div class="truncate text-sm font-black text-gray-900">${customerLabel}</div>
                                <div class="truncate text-xs font-bold text-gray-400">${customerRut}${firstItem ? ` · ${firstItem}` : ''}</div>
                            </div>
                            <div class="text-right text-sm font-black text-gray-700">${this.formatMoney(doc.neto)}</div>
                            <div class="text-right text-sm font-black text-gray-700">${this.formatMoney(doc.iva)}</div>
                            <div class="text-right text-base font-black text-gray-950">${this.formatMoney(doc.amount)}</div>
                            <div class="flex flex-col items-start gap-1">
                                <span class="inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${statusClass}">
                                    <span class="truncate">${this.escapeHtml(doc.status || 'GENERADO')}</span>
                                </span>
                                ${syncBadge}
                            </div>
                            <div class="flex items-center justify-end gap-2">
                                <button onclick="invoicePage.createPdfFromXmlWrapper('${this.escapeHtml(doc.type)}', '${this.escapeHtml(doc.folio)}', '${this.escapeHtml(doc.filename || '')}', '${this.escapeHtml(doc.id_xml || '')}')" 
                                    class="h-9 w-9 rounded-xl bg-gray-900 text-white hover:bg-black transition-all" title="Ver PDF">
                                    <i class="bi bi-file-pdf"></i>
                                </button>
                                <button onclick="invoicePage.downloadDteXml('${this.escapeHtml(doc.filename || '')}', '${this.escapeHtml(doc.folder || '')}', '${this.escapeHtml(doc.id_xml || '')}')" 
                                    class="h-9 w-9 rounded-xl border border-gray-100 bg-white text-gray-500 hover:text-orange-600 transition-all" title="Descargar XML">
                                    <i class="bi bi-code-slash"></i>
                                </button>
                                <button onclick="invoicePage.duplicateInvoice('${this.escapeHtml(doc.type)}', '${this.escapeHtml(doc.folio)}', '${this.escapeHtml(doc.filename || '')}', '${this.escapeHtml(doc.id_xml || '')}')" 
                                    class="h-9 w-9 rounded-xl border border-gray-100 bg-white text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-all" title="Duplicar / Repetir Factura">
                                    <i class="bi bi-copy"></i>
                                </button>
                                ${isLocalOnly ? `
                                    <button onclick="invoicePage.uploadLocalDteToServer('${this.escapeHtml(doc.type)}', '${this.escapeHtml(doc.folio)}', this)" 
                                        class="h-9 w-9 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-all" title="Sincronizar">
                                        <i class="bi bi-cloud-arrow-up-fill"></i>
                                    </button>
                                ` : ''}
                                <button onclick="invoicePage.querySiiStatus('${this.escapeHtml(doc.trackId || '')}', '${this.escapeHtml(doc.id_xml || '')}', '${btoa(JSON.stringify(doc).replace(/[\u007F-\uFFFF]/g, function(chr) { return '\\u' + ('0000' + chr.charCodeAt(0).toString(16)).substr(-4); }))}')" 
                                    class="h-9 w-9 rounded-xl border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Consultar Estado en el SII">
                                    <i class="bi bi-search"></i>
                                </button>
                                <button onclick="invoicePage.handleDelete('${this.escapeHtml(doc.filename || '')}', '${this.escapeHtml(doc.id_xml || '')}')" 
                                    class="h-9 w-9 rounded-xl border border-gray-100 bg-white text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all" title="Eliminar">
                                    <i class="bi bi-trash-fill"></i>
                                </button>
                            </div>
                        </div>
                    `;
        }).join('')}
                </div>
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

        const missingRemoteSummaries = xmlList
            .filter((xmlRecord) => !Array.isArray(xmlRecord) && xmlRecord?.id_xml)
            .map((xmlRecord) => {
                const type = String(xmlRecord.tipoDte || xmlRecord.doc_type || xmlRecord.docType || xmlRecord.type || xmlRecord.dte_type || '');
                const folio = String(xmlRecord.folio || xmlRecord.ticket_id || xmlRecord.number || '');
                const hasServerSummary = Number(xmlRecord.mntTotal || xmlRecord.total || xmlRecord.MntTotal || 0) > 0;
                return { key: `${type}_${folio}`, id: xmlRecord.id_xml, hasServerSummary };
            })
            .filter((item) => item.key !== '_' && !item.hasServerSummary && !xmlSummaryMap.has(item.key));

        const remoteQueue = [...missingRemoteSummaries];
        const workers = Array.from({ length: Math.min(5, remoteQueue.length) }, async () => {
            while (remoteQueue.length) {
                const item = remoteQueue.shift();
                try {
                    const xmlContent = await api.downloadXml(item.id);
                    const summary = this.parseXmlSummary(xmlContent);
                    if (summary) {
                        xmlSummaryMap.set(item.key, summary);
                    }
                } catch (error) {
                    console.warn(`[HISTORY] No se pudo leer XML remoto para ${item.key}:`, error);
                }
            }
        });
        await Promise.all(workers);

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
            const serverSummary = {
                amount: Number(xmlRecord.mntTotal || xmlRecord.total || xmlRecord.MntTotal || 0),
                neto: Number(xmlRecord.mntNeto || xmlRecord.neto || xmlRecord.MntNeto || 0),
                iva: Number(xmlRecord.iva || xmlRecord.IVA || 0),
                exento: Number(xmlRecord.mntExento || xmlRecord.exento || xmlRecord.MntExe || 0),
                date: xmlRecord.fechaEmision || '',
                customerRut: xmlRecord.rutReceptor || xmlRecord.customerRut || '',
                customerName: xmlRecord.razonReceptor || xmlRecord.customerName || '',
                firstItem: xmlRecord.primerItem || ''
            };
            const dateStr = xmlSummary?.date || serverSummary.date || xmlRecord.fechaGuardado || sale?.created_at || xmlRecord.created_at || new Date().toISOString();
            const amount = sale
                ? (xmlSummary?.amount || serverSummary.amount || sale.total || sale.total_amount || 0)
                : (xmlSummary?.amount || serverSummary.amount || 0);
            const status = xmlRecord.estadoSii || (sale ? (sale.sii_status || sale.status) : 'GENERADO');

            processedMap.set(key, {
                id_xml: xmlRecord.id_xml || null, trackId: xmlRecord.trackId || null,
                filename: xmlRecord.filename || `DTE_${type}_Folio_${folio}.xml`,
                pdfName: local?.pdf?.name || null,
                pdfPath: local?.pdf?.path || null,
                xmlPath: local?.xml?.path || null,
                type,
                folio,
                date: new Date(dateStr),
                folder: this.getFolderForType(type),
                amount: Number(amount) || 0,
                neto: Number(xmlSummary?.neto || serverSummary.neto || sale?.subtotal || 0),
                iva: Number(xmlSummary?.iva || serverSummary.iva || sale?.iva || 0),
                exento: Number(xmlSummary?.exento || serverSummary.exento || 0),
                itemCount: Number(xmlSummary?.itemCount || 0),
                firstItem: xmlSummary?.firstItem || serverSummary.firstItem || '',
                customerRut: xmlSummary?.customerRut || serverSummary.customerRut || sale?.rut_cliente || sale?.customer_rut || '',
                customerName: xmlSummary?.customerName || serverSummary.customerName || sale?.nombre_cliente || sale?.customer_name || sale?.cliente || '',
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
                neto: Number(xmlSummary?.neto || 0),
                iva: Number(xmlSummary?.iva || 0),
                exento: Number(xmlSummary?.exento || 0),
                itemCount: Number(xmlSummary?.itemCount || 0),
                firstItem: xmlSummary?.firstItem || '',
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
