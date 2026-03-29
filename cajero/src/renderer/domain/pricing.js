import { catalogState, saleState } from '../state/store.js';

export function roundWeightedQuantity(value) {
    return Math.round(value * 1000) / 1000;
}

export function getFamilyQuantityMap(cart = saleState.cart) {
    const map = {};

    cart.forEach((item) => {
        const product = catalogState.products.find((entry) => entry.id === item.productId);
        const family = product?.familyPromo;

        if (!product || !family) {
            return;
        }

        map[family] = (map[family] || 0) + Number(item.quantity || 0);
    });

    return map;
}

export function getPricingForProduct(product, quantity, cart = saleState.cart) {
    const familyQuantities = getFamilyQuantityMap(cart);
    const quantityToEvaluate = product.familyPromo
        ? Number(familyQuantities[product.familyPromo] || quantity)
        : quantity;

    if (product.offerAvailable && product.offerPrice) {
        return { unitPrice: product.offerPrice, label: 'Precio oferta' };
    }

    if (product.palletPrice && product.palletMinQty && quantityToEvaluate >= product.palletMinQty) {
        return { unitPrice: product.palletPrice, label: 'Precio pallet' };
    }

    if (product.wholesalePrice && product.wholesaleMinQty && quantityToEvaluate >= product.wholesaleMinQty) {
        return { unitPrice: product.wholesalePrice, label: 'Precio mayorista' };
    }

    return { unitPrice: product.price, label: 'Precio detalle' };
}

export function normalizeOptionalNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return null;
    }

    return numericValue;
}

export function normalizeBackendProduct(product, categories = []) {
    if (!product?.id_producto || !product?.nombreProducto) {
        return null;
    }

    const matchedCategory = categories.find((category) => String(category.id_categoria) === String(product.id_categoria));
    const categoryName = product.nombreCategoria
        || product.categoria
        || matchedCategory?.nombreCategoria
        || (product.id_categoria ? `Categoria ${product.id_categoria}` : 'Sin categoria');

    return {
        id: String(product.id_producto),
        code: String(product.codigoBarras || ''),
        name: String(product.nombreProducto || ''),
        category: String(categoryName),
        price: Number(product.precioDetalle || 0),
        detailPrice: Number(product.precioDetalle || 0),
        offerPrice: normalizeOptionalNumber(product.precioOferta),
        offerAvailable: Number(product.precioOferta || 0) > 0,
        wholesalePrice: normalizeOptionalNumber(product.precioMayor),
        wholesaleMinQty: normalizeOptionalNumber(product.cantidadMayor),
        palletPrice: normalizeOptionalNumber(product.precioPallet),
        palletMinQty: normalizeOptionalNumber(product.cantidadPallet),
        familyPromo: String(product.familiaPromo || '').trim() || null,
        stockActual: Number(product.stockActual || 0),
        isWeighted: product.esPesable === true || product.esPesable === 1 || product.esPesable === '1'
    };
}
