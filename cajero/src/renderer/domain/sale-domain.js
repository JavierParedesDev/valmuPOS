export function getCartSnapshot({ cart, products, getPricingForProduct }) {
    let total = 0;
    let totalItems = 0;

    cart.forEach((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return;
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        total += pricing.unitPrice * item.quantity;
        totalItems += item.quantity;
    });

    return {
        total: Math.round(total),
        items: totalItems
    };
}

export function validateCartStock({ cart, products, formatQuantity }) {
    for (const item of cart) {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return { ok: false, message: 'Hay productos invalidos en el carrito.' };
        }

        if (Number(item.quantity || 0) > Number(product.stockActual || 0)) {
            return {
                ok: false,
                message: `Stock insuficiente para ${product.name}. Quedan ${formatQuantity(product.stockActual || 0, product.isWeighted)}`
            };
        }
    }

    return { ok: true };
}

export function buildSalePayload({
    cart,
    products,
    documentType,
    customer,
    method,
    received,
    documentTypeIds,
    paymentMethodMap,
    getPricingForProduct
}) {
    const snapshot = getCartSnapshot({
        cart,
        products,
        getPricingForProduct
    });
    const subtotal = Math.round(snapshot.total / 1.19);
    const iva = snapshot.total - subtotal;
    const idTipoDoc = documentTypeIds[documentType] || documentTypeIds.Boleta;
    const customerId = documentType === 'Factura' ? customer?.id || null : null;

    return {
        id_cliente: customerId,
        id_tipoDoc: idTipoDoc,
        folioDocumento: null,
        subtotal,
        iva,
        total: snapshot.total,
        metodoPago: paymentMethodMap[method] || paymentMethodMap.efectivo,
        montoPago: method === 'efectivo' ? received || snapshot.total : snapshot.total,
        carrito: cart.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            const pricing = getPricingForProduct(product, item.quantity, cart);

            return {
                id_producto: Number(product.id),
                cantidad: Number(item.quantity),
                precioVenta: pricing.unitPrice,
                subtotalLinea: Math.round(pricing.unitPrice * item.quantity)
            };
        })
    };
}

export function decreaseLocalStockFromCart({ cart, products }) {
    cart.forEach((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return;
        }

        product.stockActual = Math.max(0, Number(product.stockActual || 0) - Number(item.quantity || 0));
    });
}
