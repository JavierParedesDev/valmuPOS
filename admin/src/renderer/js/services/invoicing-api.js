window.ValmuInvoicingApi = (() => {
    const extractXmlString = (payload) => {
        if (typeof payload === 'string') {
            return payload;
        }

        if (!payload || typeof payload !== 'object') {
            return '';
        }

        if (typeof payload.data === 'string') {
            return payload.data;
        }

        if (typeof payload.xmlContenido === 'string') {
            return payload.xmlContenido;
        }

        if (typeof payload.xmlContent === 'string') {
            return payload.xmlContent;
        }

        if (typeof payload.xml === 'string') {
            return payload.xml;
        }

        return '';
    };

    const normalizeTipoDocLabel = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const resolveTipoDteFromControlRow = (row = {}) => {
        const explicitType = row.tipoDte || row.tipo_dte || row.doc_type || row.dte_type || row.tipo;
        if (explicitType) {
            return String(explicitType);
        }

        const label = normalizeTipoDocLabel(row.tipoDoc || row.tipo_doc || row.nombre || row.descripcion || '');
        const idTipoDoc = Number(row.id_tipoDoc || row.idTipoDoc || row.id || 0);
        if (label.includes('credito')) return '61';
        if (label.includes('debito')) return '56';
        if (label.includes('boleta')) return '39';
        if (label.includes('factura')) return '33';
        if (idTipoDoc === 1) return '39';
        if (idTipoDoc === 2) return '33';
        return null;
    };

    const safeRequest = async (endpoint, method = 'GET', body = null) => {
        if (window.electronAPI?.apiRequest) {
            const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
            return window.electronAPI.apiRequest({ endpoint, method, body, token });
        }

        return { data: [] };
    };

    const unwrapData = (response) => {
        if (Array.isArray(response)) {
            return response;
        }

        if (response && typeof response === 'object' && 'data' in response) {
            return response.data;
        }

        return response;
    };

    const getErrorMessage = (response, fallbackMessage = 'Error de comunicacion con el servidor') => {
        const payload = unwrapData(response);
        return payload?.error || payload?.message || response?.error || fallbackMessage;
    };

    const ensureOk = (response, fallbackMessage) => {
        if (response?.ok === false) {
            throw new Error(getErrorMessage(response, fallbackMessage));
        }

        return response;
    };

    const getControlFolios = async () => {
        const response = await safeRequest('/folios');
        ensureOk(response, 'No se pudo consultar el control de folios');
        const rows = unwrapData(response);

        return (Array.isArray(rows) ? rows : []).map((row) => ({
            ...row,
            tipoDte: resolveTipoDteFromControlRow(row),
            id_tipoDoc: Number(row.id_tipoDoc || row.idTipoDoc || row.id || 0),
            ultimoFolioUsado: Number(row.ultimoFolioUsado || row.ultimo_folio_usado || 0),
            folioDisponibleHasta: Number(row.folioDisponibleHasta || row.folio_disponible_hasta || 0)
        })).filter((row) => row.tipoDte && row.id_tipoDoc);
    };

    const requestNextFolio = async (tipoDte) => {
        const controls = await getControlFolios();
        const match = controls.find((row) => String(row.tipoDte) === String(tipoDte));

        if (!match?.id_tipoDoc) {
            throw new Error(`No existe mapeo backend para el DTE ${tipoDte}`);
        }

        const response = await safeRequest('/folios/solicitar', 'POST', {
            id_tipoDoc: match.id_tipoDoc
        });

        ensureOk(response, `No se pudo reservar el folio para DTE ${tipoDte}`);
        const payload = unwrapData(response) || {};
        return {
            ...payload,
            folio: Number(payload.folio || 0),
            id_tipoDoc: match.id_tipoDoc,
            tipoDte: String(tipoDte)
        };
    };

    const getLocalSiiConfig = async () => {
        if (typeof window.electronAPI?.getSiiConfig === 'function') {
            return window.electronAPI.getSiiConfig();
        }

        return {};
    };

    const saveLocalSiiConfig = async (data) => {
        if (typeof window.electronAPI?.saveSiiConfig === 'function') {
            return window.electronAPI.saveSiiConfig(data);
        }

        return { success: false, error: 'local_sii_config_unavailable' };
    };

    const resolveSaleIdFromHistory = async (tipoDte, folio) => {
        try {
            const historyResponse = await safeRequest('/ventas');
            const history = unwrapData(historyResponse);
            if (!Array.isArray(history)) {
                return null;
            }

            const match = history.find((sale) => {
                const saleType = String(sale.doc_type || sale.dte_type || sale.tipoDte || sale.tipo_dte || '');
                const saleFolio = String(sale.folio || sale.ticket_id || sale.numero_ticket || '');
                return saleType === String(tipoDte) && saleFolio === String(folio);
            });

            return match?.id_venta || match?.sale_id || match?.id_boleta || match?.id || null;
        } catch (error) {
            console.warn('No se pudo resolver id_venta desde historial:', error);
            return null;
        }
    };

    return {
        createSale: async (saleData) => safeRequest('/ventas', 'POST', saleData),
        getClients: () => safeRequest('/clientes'),
        getProducts: () => safeRequest('/productos?limit=1000&page=1&offset=0'),
        getSiiSettings: async () => getLocalSiiConfig(),
        saveSiiSettings: async (data) => saveLocalSiiConfig(data),
        getFoliosControl: async () => getControlFolios(),
        requestNextFolio: async (tipoDte) => requestNextFolio(tipoDte),
        getXmlList: () => safeRequest('/dte/list'),
        uploadXml: async (type, folio, content, options = {}) => {
            const idVenta = options.idVenta
                || options.id_venta
                || options.saleId
                || await resolveSaleIdFromHistory(type, folio)
                || null; // NC/ND no tienen venta — guardar igual con null

            const response = await safeRequest('/dte/guardar', 'POST', {
                id_venta: idVenta,
                tipoDte: Number(type),
                folio: Number(folio),
                xmlContenido: content,
                trackId: options.trackId || null,
                estadoSii: options.estadoSii || 'GENERADO'
            });

            ensureOk(response, 'No se pudo respaldar el XML del DTE');
            return unwrapData(response);
        },
        updateDteStatus: async (idXml, estadoSii) => {
            if (!idXml) {
                throw new Error('Se requiere id_xml para actualizar el estado del DTE');
            }

            const response = await safeRequest(`/dte/${idXml}/estado`, 'PUT', { estadoSii });
            ensureOk(response, 'No se pudo actualizar el estado del DTE');
            return unwrapData(response);
        },
        downloadXml: async (id) => {
            const response = await safeRequest(`/dte/${id}/xml`, 'GET');
            ensureOk(response, 'No se pudo descargar el XML del DTE');
            const payload = unwrapData(response);
            const xmlContent = extractXmlString(payload);
            if (!xmlContent.trim()) {
                throw new Error('El servidor no devolvio un XML valido');
            }
            return xmlContent;
        },
        getSalesHistory: (limit) => safeRequest(`/ventas?limit=${limit || 100000}`),
        deleteXml: (id) => safeRequest(`/dte/${id}`, 'DELETE'),
        uploadManualXml: async (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const content = event.target.result;
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(content, 'text/xml');
                        const folioNode = xmlDoc.getElementsByTagName('Folio')[0];
                        const typeNode = xmlDoc.getElementsByTagName('TipoDTE')[0];

                        if (!folioNode || !typeNode) {
                            throw new Error('XML Invalido: Falta Folio o TipoDTE');
                        }

                        const filename = `${typeNode.textContent}_${folioNode.textContent}.xml`;
                        await window.electronAPI.saveXml(filename, content, 'facturas');
                        resolve({ success: true, id: filename });
                    } catch (error) {
                        reject(error);
                    }
                };

                reader.onerror = reject;
                reader.readAsText(file);
            });
        }
    };
})();
