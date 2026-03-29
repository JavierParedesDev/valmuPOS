export function normalizeCatalogText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function findCatalogProducts(products, term) {
    const normalizedTerm = normalizeCatalogText(term);

    return products.filter((product) => {
        const haystack = normalizeCatalogText(`${product.name} ${product.code} ${product.category}`);
        return haystack.includes(normalizedTerm);
    });
}

export function getSelectedBranchNameFromList(branches, selectedBranchId) {
    const selectedBranch = branches.find((branch) => String(branch.id_sucursal) === String(selectedBranchId));
    return selectedBranch?.nombreSucursal || 'esta sucursal';
}

export function buildNoStockMessage({ product, currentBranchName, branchStock, formatQuantity }) {
    if (branchStock.length) {
        return `No queda stock de ${product.name} en ${currentBranchName}. Hay stock en: ${branchStock.map((entry) => `${entry.branchName} (${formatQuantity(entry.stockActual, product.isWeighted)})`).join(', ')}. Debes hacer traslado antes de vender.`;
    }

    return `No queda stock de ${product.name} en ${currentBranchName} ni en otras sucursales disponibles.`;
}
