window.ValmuInvoicingSmartData = {
    extractArray(response) {
        if (Array.isArray(response)) {
            return response;
        }

        if (!response || typeof response !== 'object') {
            return [];
        }

        if (Array.isArray(response.data)) {
            return response.data;
        }

        if (response.data && typeof response.data === 'object' && Array.isArray(response.data.data)) {
            return response.data.data;
        }

        if (Array.isArray(response.items)) {
            return response.items;
        }

        return [];
    },

    normalizeClients(rawClients = []) {
        const clientList = Array.isArray(rawClients) ? rawClients : [];
        return clientList.map((client) => ({
            id: client.id_cliente || client.id || null,
            rut: client.rut || client.rut_cliente || '',
            business_name: client.business_name || client.nombreCliente || client.nombre || '',
            address: client.address || client.direccion || '',
            comuna: client.comuna || '',
            city: client.city || client.ciudad || client.comuna || '',
            giro: client.giro || client.giroCliente || '',
            email: client.email || client.correo || '',
            phone: client.phone || client.telefono || '',
            raw: client
        }));
    },

    normalizeProducts(rawProducts = []) {
        const productList = Array.isArray(rawProducts) ? rawProducts : [];
        return productList.map((product) => ({
            id: product.id_producto || product.id || null,
            name: product.name || product.nombreProducto || '',
            sale_price: Number(product.sale_price || product.precioDetalle || 0),
            wholesale_price: Number(product.wholesale_price || product.precioMayor || 0),
            card_price: Number(product.card_price || product.precioPallet || product.precioDetalle || 0),
            raw: product
        })).filter((product) => product.name);
    },

    async load({ api, onLoaded } = {}) {
        try {
            const [clientsResult, productsResult] = await Promise.allSettled([
                api.getClients(),
                api.getProducts()
            ]);

            const clientsRes = clientsResult.status === 'fulfilled' ? clientsResult.value : [];
            const productsRes = productsResult.status === 'fulfilled' ? productsResult.value : [];

            if (clientsResult.status === 'rejected') {
                console.error('Clients Load Error:', clientsResult.reason);
            }

            if (productsResult.status === 'rejected') {
                console.error('Products Load Error:', productsResult.reason);
            }

            const rawClients = this.extractArray(clientsRes);
            const clients = this.normalizeClients(rawClients);
            const rawProducts = this.extractArray(productsRes);
            const products = this.normalizeProducts(rawProducts);

            onLoaded?.({ clients, products });
            return { clients, products };
        } catch (error) {
            console.error('Smart Data Load Error:', error);
            return { clients: [], products: [] };
        }
    },

    renderDatalists({ clients = [], products = [] } = {}) {
        const clientOptions = clients.map((client) =>
            `<option value="${client.rut}">${client.business_name} (${client.email || ''})</option>`
        ).join('');

        const productOptions = products.map((product) => {
            const salePrice = product.sale_price || 0;
            const wholesalePrice = product.wholesale_price || 0;
            const cardPrice = product.card_price || 0;
            return `<option value="${product.name}">Efe: $${salePrice} | May: $${wholesalePrice} | Tar: $${cardPrice}</option>`;
        }).join('');

        const noteProductOptions = products.map((product) =>
            `<option value="${product.name}">$${product.sale_price || 0}</option>`
        ).join('');

        return {
            clientOptions,
            productOptions,
            noteProductOptions
        };
    },

    applyDatalists({ clients = [], products = [] } = {}) {
        const { clientOptions, productOptions, noteProductOptions } = this.renderDatalists({ clients, products });

        const clientList = document.getElementById('list-clients');
        if (clientList) {
            clientList.innerHTML = '';
        }

        const ncClientList = document.getElementById('list-clients-nc');
        if (ncClientList && clients.length) {
            ncClientList.innerHTML = clientOptions;
        }

        const ndClientList = document.getElementById('list-clients-nd');
        if (ndClientList && clients.length) {
            ndClientList.innerHTML = clientOptions;
        }

        const productList = document.getElementById('list-products');
        if (productList && products.length) {
            productList.innerHTML = productOptions;
        }

        const ncProductList = document.getElementById('list-products-nc');
        if (ncProductList && products.length) {
            ncProductList.innerHTML = noteProductOptions;
        }
    }
};
