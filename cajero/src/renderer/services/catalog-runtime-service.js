export async function resolveBranchState({
    apiBaseUrl,
    token,
    user,
    selectedBranchId,
    hasStoredSelection,
    fetchBranches
}) {
    if (!apiBaseUrl || !token) {
        return {
            mode: 'unavailable',
            branches: [],
            resolvedSelectedBranchId: ''
        };
    }

    const branches = await fetchBranches({ apiBaseUrl, token });
    const preferredBranchId = selectedBranchId || String(user?.id_sucursal || '');
    const resolvedSelectedBranchId = preferredBranchId || String(branches[0]?.id_sucursal || '');

    return {
        mode: 'ready',
        branches,
        shouldPersistSelection: !hasStoredSelection && Boolean(preferredBranchId),
        resolvedSelectedBranchId
    };
}

export async function resolveCategoryState({
    apiBaseUrl,
    token,
    fetchCategories
}) {
    if (!apiBaseUrl || !token) {
        return [];
    }

    return fetchCategories({ apiBaseUrl, token });
}

export async function resolveCatalogInventory({
    apiBaseUrl,
    token,
    selectedBranchId,
    categories,
    fetchInventory,
    normalizeBackendProduct,
    fallbackProducts
}) {
    if (!apiBaseUrl || !token) {
        return {
            products: fallbackProducts.slice(),
            source: 'demo',
            status: 'Modo demo activo'
        };
    }

    const payload = await fetchInventory({
        apiBaseUrl,
        token,
        branchId: selectedBranchId || ''
    });
    const products = Array.isArray(payload)
        ? payload.map((product) => normalizeBackendProduct(product, categories)).filter(Boolean)
        : [];

    if (!products.length) {
        throw new Error('No hay productos disponibles.');
    }

    return {
        products,
        source: 'api',
        status: `Inventario cargado: ${products.length} productos`
    };
}

export async function resolveOtherBranchStock({
    apiBaseUrl,
    token,
    selectedBranchId,
    branches,
    productId,
    fetchInventory
}) {
    if (!apiBaseUrl || !token || !branches.length) {
        return [];
    }

    const branchesToCheck = branches.filter((branch) => String(branch.id_sucursal) !== String(selectedBranchId));
    if (!branchesToCheck.length) {
        return [];
    }

    const results = await Promise.all(branchesToCheck.map(async (branch) => {
        try {
            const payload = await fetchInventory({
                apiBaseUrl,
                token,
                branchId: String(branch.id_sucursal)
            });
            const matchedProduct = payload.find((item) => String(item.id_producto) === String(productId));
            if (!matchedProduct || Number(matchedProduct.stockActual || 0) <= 0) {
                return null;
            }

            return {
                branchName: branch.nombreSucursal || `Sucursal ${branch.id_sucursal}`,
                stockActual: Number(matchedProduct.stockActual || 0)
            };
        } catch (_error) {
            return null;
        }
    }));

    return results.filter(Boolean);
}
