export function filterDispatchProducts(products, query, normalizeCatalogText) {
    const normalizedQuery = normalizeCatalogText(query || '');
    if (!normalizedQuery) {
        return [];
    }

    return products.filter((product) => {
        const haystack = normalizeCatalogText(`${product.name} ${product.code} ${product.category}`);
        return haystack.includes(normalizedQuery);
    }).slice(0, 8);
}

export function addProductToDispatchCart(cart, productId, products) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) {
        return { cart, error: 'Producto no encontrado.' };
    }

    const currentLine = cart.find((entry) => entry.productId === productId);
    const nextQuantity = (currentLine?.quantity || 0) + 1;
    const stockActual = Number(product.stockActual || 0);

    if (!product.isWeighted && nextQuantity > stockActual) {
        return {
            cart,
            error: `No queda suficiente stock de ${product.name} en esta sucursal.`
        };
    }

    if (currentLine) {
        return {
            cart: cart.map((entry) => entry.productId === productId
                ? { ...entry, quantity: product.isWeighted ? nextQuantity : Math.max(1, Math.round(nextQuantity)) }
                : entry)
        };
    }

    return {
        cart: [
            ...cart,
            {
                productId,
                quantity: product.isWeighted ? 1 : 1
            }
        ]
    };
}

export function updateDispatchCartQuantity(cart, productId, delta, products) {
    const product = products.find((entry) => entry.id === productId);
    const currentLine = cart.find((entry) => entry.productId === productId);

    if (!product || !currentLine) {
        return { cart };
    }

    const nextQuantity = currentLine.quantity + delta;
    if (nextQuantity <= 0) {
        return {
            cart: cart.filter((entry) => entry.productId !== productId)
        };
    }

    if (!product.isWeighted && nextQuantity > Number(product.stockActual || 0)) {
        return {
            cart,
            error: `No queda suficiente stock de ${product.name} en esta sucursal.`
        };
    }

    return {
        cart: cart.map((entry) => entry.productId === productId
            ? { ...entry, quantity: product.isWeighted ? nextQuantity : Math.max(1, Math.round(nextQuantity)) }
            : entry)
    };
}

export function removeDispatchCartItem(cart, productId) {
    return cart.filter((entry) => entry.productId !== productId);
}

export function buildDispatchSnapshot(cart, products, getPricingForProduct) {
    return cart.reduce((snapshot, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return snapshot;
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        const lineTotal = pricing.unitPrice * item.quantity;

        return {
            items: snapshot.items + item.quantity,
            total: snapshot.total + lineTotal,
            lines: [
                ...snapshot.lines,
                {
                    productId: product.id,
                    productName: product.name,
                    productCode: product.code,
                    category: product.category,
                    quantity: item.quantity,
                    unitPrice: pricing.unitPrice,
                    lineTotal,
                    isWeighted: product.isWeighted
                }
            ]
        };
    }, {
        items: 0,
        total: 0,
        lines: []
    });
}

export function buildDispatchPayload({
    snapshot,
    carrierId,
    documentTypeId
}) {
    const subtotal = Math.round(snapshot.total / 1.19);
    const iva = snapshot.total - subtotal;

    return {
        id_transporte: Number(carrierId),
        id_tipoDoc: Number(documentTypeId),
        subtotal,
        iva,
        total: snapshot.total,
        carrito: snapshot.lines.map((line) => ({
            id_producto: Number(line.productId),
            cantidad: Number(line.quantity),
            precioVenta: Number(line.unitPrice),
            subtotalLinea: Number(line.lineTotal)
        }))
    };
}

export function buildDispatchRecord({
    carrier,
    branchName,
    snapshot,
    formatDateTime
}) {
    return {
        id: `DSP-${Date.now()}`,
        carrierName: carrier?.name || 'Transportista',
        carrierRut: carrier?.rut || '',
        plate: carrier?.plate || '',
        routeName: carrier?.routeName || '',
        branchName,
        createdAt: new Date().toISOString(),
        createdAtLabel: formatDateTime(new Date().toISOString()),
        total: snapshot.total,
        items: snapshot.items,
        lines: snapshot.lines
    };
}

export function normalizeDispatchCarrierList(transportes) {
    return (Array.isArray(transportes) ? transportes : []).map((transport) => ({
        id: Number(
            transport.id_transporte ||
            transport.idTransporte ||
            transport.id ||
            0
        ),
        name: transport.nombreTransporte || transport.nombre || 'Transportista',
        rut: transport.rutTransporte || transport.rut || '',
        plate: transport.patenteTransporte || transport.patente || '',
        routeName: transport.rutaTransporte || transport.ruta || 'Ruta asignada'
    })).filter((carrier) => carrier.id);
}

export function normalizeDispatchHistory(history, formatDateTime) {
    return (Array.isArray(history) ? history : []).map((dispatch) => ({
        id: String(dispatch.id_despacho || dispatch.id || ''),
        carrierName: dispatch.nombreTransporte || 'Transportista',
        plate: dispatch.patenteTransporte || '',
        status: dispatch.estadoDespacho || 'PENDIENTE',
        saleReference: dispatch.folioDocumento || `Venta ${dispatch.id_venta || ''}`.trim(),
        total: Number(dispatch.total || 0),
        createdAtLabel: formatDateTime(dispatch.fechaVenta || dispatch.fechaCreacion || new Date().toISOString())
    })).filter((dispatch) => dispatch.id);
}

export function decreaseLocalStockFromDispatchCart(products, cart) {
    return products.map((product) => {
        const line = cart.find((entry) => entry.productId === product.id);
        if (!line) {
            return product;
        }

        return {
            ...product,
            stockActual: Math.max(0, Number(product.stockActual || 0) - Number(line.quantity || 0))
        };
    });
}
