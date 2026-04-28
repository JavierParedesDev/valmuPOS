export function getCartSnapshot({ cart, products, getPricingForProduct, collaboratorDiscountEnabled = false }) {
    let baseTotal = 0;
    let totalItems = 0;
    let lineDiscount = 0;

    cart.forEach((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return;
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        baseTotal += pricing.unitPrice * item.quantity;
        totalItems += item.quantity;
        lineDiscount += (product.price - pricing.unitPrice) * item.quantity;
    });

    const collaboratorDiscount = collaboratorDiscountEnabled
        ? Math.round(baseTotal * 0.1)
        : 0;
    const totalDiscount = lineDiscount + collaboratorDiscount;
    const total = Math.max(0, Math.round(baseTotal - collaboratorDiscount));

    return {
        total,
        subtotalBeforeDiscount: Math.round(baseTotal),
        items: totalItems,
        discount: Math.round(totalDiscount),
        lineDiscount: Math.round(lineDiscount),
        collaboratorDiscount: Math.round(collaboratorDiscount),
        collaboratorDiscountEnabled: Boolean(collaboratorDiscountEnabled)
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

function buildAdjustedCartLines({ cart, products, getPricingForProduct, collaboratorDiscount = 0, expectedTotal = null }) {
    const baseLines = cart.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return null;
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        const quantity = Number(item.quantity || 0);
        const baseLineTotal = Math.round(pricing.unitPrice * quantity);

        return {
            product,
            quantity,
            baseLineTotal
        };
    }).filter(Boolean);

    const baseTotal = baseLines.reduce((sum, line) => sum + line.baseLineTotal, 0);
    let assignedDiscount = 0;

    const adjustedLines = baseLines.map((line, index) => {
        const isLastLine = index === baseLines.length - 1;
        const proportionalDiscount = collaboratorDiscount > 0 && baseTotal > 0
            ? Math.round((line.baseLineTotal / baseTotal) * collaboratorDiscount)
            : 0;
        const lineDiscount = isLastLine
            ? Math.max(0, collaboratorDiscount - assignedDiscount)
            : Math.min(line.baseLineTotal, proportionalDiscount);

        assignedDiscount += lineDiscount;

        const adjustedLineTotal = Math.max(0, line.baseLineTotal - lineDiscount);
        const adjustedUnitPrice = line.quantity > 0
            ? Number((adjustedLineTotal / line.quantity).toFixed(4))
            : 0;

        return {
            product: line.product,
            quantity: line.quantity,
            unitPrice: adjustedUnitPrice,
            lineTotal: adjustedLineTotal
        };
    });

    const expectedLineTotal = Number.isFinite(Number(expectedTotal))
        ? Math.max(0, Math.round(Number(expectedTotal)))
        : null;

    if (expectedLineTotal != null && adjustedLines.length) {
        const currentLineTotal = adjustedLines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
        const roundingDifference = expectedLineTotal - currentLineTotal;

        if (roundingDifference !== 0) {
            const targetLine = [...adjustedLines].reverse().find((line) => Number(line.lineTotal || 0) + roundingDifference >= 0);
            if (targetLine) {
                targetLine.lineTotal = Number(targetLine.lineTotal || 0) + roundingDifference;
                targetLine.unitPrice = targetLine.quantity > 0
                    ? Number((targetLine.lineTotal / targetLine.quantity).toFixed(4))
                    : 0;
            }
        }
    }

    return adjustedLines;
}

export function buildSalePayload({
    cart,
    products,
    documentType,
    customer,
    method,
    received,
    folioDocumento,
    documentTypeIds,
    paymentMethodMap,
    getPricingForProduct,
    branchId = null,
    collaboratorDiscountEnabled = false
}) {
    const snapshot = getCartSnapshot({
        cart,
        products,
        getPricingForProduct,
        collaboratorDiscountEnabled
    });
    const subtotal = Math.round(snapshot.total / 1.19);
    const iva = snapshot.total - subtotal;
    const idTipoDoc = documentTypeIds[documentType] || documentTypeIds.Boleta;
    const customerId = documentType === 'Factura' ? customer?.id || null : null;

    const isMixed = method === 'mixto';
    const adjustedCartLines = buildAdjustedCartLines({
        cart,
        products,
        getPricingForProduct,
        collaboratorDiscount: snapshot.collaboratorDiscount || 0,
        expectedTotal: snapshot.total
    });

    return {
        id_cliente: customerId,
        id_tipoDoc: idTipoDoc,
        id_sucursal: branchId ? Number(branchId) : null,
        origenVenta: 'CAJA',
        folioDocumento: folioDocumento || null,
        subtotal,
        descuento: snapshot.discount || 0,
        iva,
        total: snapshot.total,
        metodoPago: isMixed ? 'MIXTO' : (paymentMethodMap[method] || paymentMethodMap.efectivo),
        montoPago: snapshot.total,
        // Breakdown for mixed payments
        pago_efectivo: isMixed ? Number(received?.cash || 0) : (method === 'efectivo' ? snapshot.total : 0),
        pago_tarjeta: isMixed ? Number(received?.card || 0) : (method === 'tarjeta' ? snapshot.total : 0),
        pago_transferencia: isMixed ? Number(received?.transfer || 0) : (method === 'transferencia' ? snapshot.total : 0),
        carrito: adjustedCartLines.map((line) => ({
            id_producto: Number(line.product.id),
            cantidad: Number(line.quantity),
            precioVenta: line.unitPrice,
            subtotalLinea: Number(line.lineTotal)
        }))
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
