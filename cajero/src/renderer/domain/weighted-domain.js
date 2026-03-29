export function openWeightedState(weightedProductState, product, mode = 'add') {
    weightedProductState.productId = product.id;
    weightedProductState.mode = mode;
}

export function closeWeightedState(weightedProductState) {
    weightedProductState.productId = null;
    weightedProductState.mode = 'add';
}

export function resolveWeightedEditState({ products, cart, productId, findProductById, findCartItemByProductId }) {
    const product = findProductById(products, productId);
    const cartItem = findCartItemByProductId(cart, productId);

    if (!product || !cartItem) {
        return null;
    }

    return {
        product,
        quantity: cartItem.quantity
    };
}

export function parseWeightedQuantity(rawValue) {
    const quantity = Number(rawValue || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
    }

    return quantity;
}
