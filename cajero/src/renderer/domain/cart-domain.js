export function findProductById(products, productId) {
    return products.find((item) => item.id === productId) || null;
}

export function findCartItemByProductId(cart, productId) {
    return cart.find((item) => item.productId === productId) || null;
}

export function addUnitToCart({
    cart,
    product,
    roundWeightedQuantity
}) {
    const existingItem = findCartItemByProductId(cart, product.id);

    if (existingItem) {
        if (Number(existingItem.quantity || 0) >= Number(product.stockActual || 0)) {
            return {
                ok: false,
                reason: 'stock_max',
                product
            };
        }

        existingItem.quantity = product.isWeighted
            ? roundWeightedQuantity(existingItem.quantity + 0.25)
            : existingItem.quantity + 1;

        return { ok: true };
    }

    cart.push({
        productId: product.id,
        quantity: 1
    });

    return { ok: true };
}

export function addWeightedQuantityToCart({
    cart,
    product,
    quantity,
    roundWeightedQuantity
}) {
    const normalizedQuantity = roundWeightedQuantity(quantity);
    if (normalizedQuantity <= 0) {
        return { ok: false, reason: 'invalid_quantity' };
    }

    if (normalizedQuantity > Number(product.stockActual || 0)) {
        return {
            ok: false,
            reason: 'stock_insufficient',
            product
        };
    }

    const existingItem = findCartItemByProductId(cart, product.id);

    if (existingItem) {
        const nextQuantity = roundWeightedQuantity(existingItem.quantity + normalizedQuantity);
        if (nextQuantity > Number(product.stockActual || 0)) {
            return {
                ok: false,
                reason: 'stock_insufficient',
                product
            };
        }

        existingItem.quantity = nextQuantity;
        return { ok: true };
    }

    cart.push({
        productId: product.id,
        quantity: normalizedQuantity
    });

    return { ok: true };
}

export function setWeightedCartQuantity({
    cart,
    product,
    quantity,
    roundWeightedQuantity
}) {
    const normalizedQuantity = roundWeightedQuantity(quantity);
    if (normalizedQuantity <= 0) {
        return { ok: false, reason: 'invalid_quantity' };
    }

    if (normalizedQuantity > Number(product.stockActual || 0)) {
        return {
            ok: false,
            reason: 'stock_insufficient',
            product
        };
    }

    const existingItem = findCartItemByProductId(cart, product.id);
    if (!existingItem) {
        return { ok: false, reason: 'missing_cart_item' };
    }

    existingItem.quantity = normalizedQuantity;
    return { ok: true };
}

export function updateCartItemQuantityValue({
    cart,
    product,
    delta,
    roundWeightedQuantity
}) {
    const item = findCartItemByProductId(cart, product.id);
    if (!item) {
        return { ok: false, reason: 'missing_cart_item' };
    }

    const nextQuantity = product.isWeighted
        ? roundWeightedQuantity(item.quantity + (delta * 0.25))
        : item.quantity + delta;

    if (nextQuantity > Number(product.stockActual || 0)) {
        return {
            ok: false,
            reason: 'stock_max',
            product
        };
    }

    if (nextQuantity <= 0) {
        return {
            ok: true,
            remove: true
        };
    }

    item.quantity = nextQuantity;
    return { ok: true };
}

export function removeCartItemByProductId(cart, productId) {
    return cart.filter((entry) => entry.productId !== productId);
}
