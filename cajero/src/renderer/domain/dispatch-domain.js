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
    const product = products.find((entry) => String(entry.id) === String(productId));
    if (!product) {
        return { cart, error: 'Producto no encontrado.' };
    }

    const currentLine = cart.find((entry) => String(entry.productId) === String(productId));
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
            cart: cart.map((entry) => String(entry.productId) === String(productId)
                ? { ...entry, quantity: product.isWeighted ? nextQuantity : Math.max(1, Math.round(nextQuantity)) }
                : entry)
        };
    }

    return {
        cart: [
            ...cart,
            {
                productId,
                quantity: product.isWeighted ? 0.25 : 1
            }
        ]
    };
}

export function updateDispatchCartQuantity(cart, productId, delta, products) {
    const product = products.find((entry) => String(entry.id) === String(productId));
    const currentLine = cart.find((entry) => String(entry.productId) === String(productId));

    if (!product || !currentLine) {
        return { cart };
    }

    const nextQuantity = product.isWeighted
        ? Math.round((currentLine.quantity + (delta * 0.25)) * 1000) / 1000
        : currentLine.quantity + delta;
    if (nextQuantity <= 0) {
        return {
            cart: cart.filter((entry) => String(entry.productId) !== String(productId))
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

export function addWeightedQuantityToDispatchCart(cart, product, quantity) {
    const normalizedQuantity = Math.round(Number(quantity || 0) * 1000) / 1000;
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        return { cart, error: 'Ingresa un peso valido para el producto pesable.' };
    }

    if (normalizedQuantity > Number(product.stockActual || 0)) {
        return {
            cart,
            error: `No queda suficiente stock de ${product.name} en esta sucursal.`
        };
    }

    const currentLine = cart.find((entry) => String(entry.productId) === String(product.id));
    if (currentLine) {
        const nextQuantity = Math.round((Number(currentLine.quantity || 0) + normalizedQuantity) * 1000) / 1000;
        if (nextQuantity > Number(product.stockActual || 0)) {
            return {
                cart,
                error: `No queda suficiente stock de ${product.name} en esta sucursal.`
            };
        }

        return {
            cart: cart.map((entry) => String(entry.productId) === String(product.id)
                ? { ...entry, quantity: nextQuantity }
                : entry)
        };
    }

    return {
        cart: [
            ...cart,
            {
                productId: product.id,
                quantity: normalizedQuantity
            }
        ]
    };
}

export function setDispatchCartItemQuantity(cart, product, quantity) {
    const normalizedQuantity = product.isWeighted
        ? Math.round(Number(quantity || 0) * 1000) / 1000
        : Number(quantity);

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        return { cart, error: product.isWeighted ? 'Ingresa un peso valido.' : 'Ingresa una cantidad valida.' };
    }

    if (!product.isWeighted && !Number.isInteger(normalizedQuantity)) {
        return { cart, error: 'Ingresa una cantidad entera valida.' };
    }

    if (normalizedQuantity > Number(product.stockActual || 0)) {
        return {
            cart,
            error: `No queda suficiente stock de ${product.name} en esta sucursal.`
        };
    }

    const currentLine = cart.find((entry) => String(entry.productId) === String(product.id));
    if (!currentLine) {
        return { cart, error: 'Producto no encontrado en el despacho.' };
    }

    return {
        cart: cart.map((entry) => String(entry.productId) === String(product.id)
            ? { ...entry, quantity: normalizedQuantity }
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
        const lineDiscount = (product.price - pricing.unitPrice) * item.quantity;

        return {
            items: snapshot.items + item.quantity,
            total: snapshot.total + lineTotal,
            discount: snapshot.discount + lineDiscount,
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
        discount: 0,
        lines: []
    });
}

export function buildDispatchPayload({
    snapshot,
    carrierId,
    documentTypeId,
    customerId,
    folioDocumento,
    manualPayment
}) {
    const subtotal = Math.round(snapshot.total / 1.19);
    const iva = snapshot.total - subtotal;

    return {
        id_transporte: Number(carrierId),
        id_tipoDoc: Number(documentTypeId),
        id_cliente: customerId ? Number(customerId) : null,
        origenVenta: 'DESPACHO',
        origen_venta: 'DESPACHO',
        folio_documento: folioDocumento || null,
        metodo_pago: manualPayment === 'en_ruta' ? 'efectivo' : manualPayment,
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
    const normalizeLineItems = (dispatch) => {
        const rawLines = dispatch?.detalle || dispatch?.detalles || dispatch?.carrito || dispatch?.productos || dispatch?.lineItems;
        if (!Array.isArray(rawLines)) {
            return [];
        }

        return rawLines.map((line) => {
            const quantity = Number(
                line?.cantidad ??
                line?.quantity ??
                line?.cantidadProducto ??
                0
            );
            const unitPrice = Number(
                line?.precioVenta ??
                line?.unitPrice ??
                line?.precio ??
                0
            );
            const subtotal = Number(
                line?.subtotalLinea ??
                line?.subtotal ??
                (quantity * unitPrice)
            );
            const isWeighted = Boolean(
                line?.isWeighted ??
                line?.pesable ??
                line?.esPesable
            );

            return {
                name: line?.nombreProducto || line?.name || line?.descripcion || 'Producto',
                quantity,
                quantityLabel: isWeighted ? `${quantity.toFixed(3)} kg` : String(Math.round(quantity || 0)),
                unitPrice,
                subtotal,
                isWeighted
            };
        }).filter((line) => line.quantity > 0 || line.subtotal > 0);
    };

    return (Array.isArray(history) ? history : []).map((dispatch) => ({
        id: String(dispatch.id_despacho || dispatch.id || ''),
        carrierName: dispatch.nombreTransporte || 'Transportista',
        carrierRut: dispatch.rutTransporte || dispatch.rut || '',
        plate: dispatch.patenteTransporte || '',
        status: dispatch.estadoDespacho || 'PENDIENTE',
        documentType: dispatch.nombreTipoDoc || dispatch.tipoDocumento || dispatch.documentType || 'Vale de despacho',
        customerLabel: dispatch.direccion || dispatch.direccionDespacho || dispatch.nombreCliente || dispatch.cliente || '',
        saleReference: dispatch.folioDocumento || `Venta ${dispatch.id_venta || ''}`.trim(),
        branchName: dispatch.nombreSucursal || dispatch.sucursal || '',
        rawDate: dispatch.fechaVenta || dispatch.fechaCreacion || new Date().toISOString(),
        subtotal: Number(dispatch.subtotal || 0),
        iva: Number(dispatch.iva || 0),
        total: Number(dispatch.total || 0),
        items: Number(dispatch.items || dispatch.cantidadItems || dispatch.totalItems || 0),
        lineItems: normalizeLineItems(dispatch),
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
