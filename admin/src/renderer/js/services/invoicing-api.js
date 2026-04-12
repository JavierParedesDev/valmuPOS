window.ValmuInvoicingApi = (() => {
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
        downloadXml: (id) => safeRequest(`/dte/${id}/xml`, 'GET'),
        getSalesHistory: (limit) => safeRequest(`/ventas`),
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
