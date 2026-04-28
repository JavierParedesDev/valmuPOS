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

function normalizeBranchName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function findPriorityBranch(branches, patterns) {
    return branches.find((branch) => {
        const normalized = normalizeBranchName(branch?.nombreSucursal);
        return patterns.some((pattern) => normalized.includes(pattern));
    }) || null;
}

function findPriorityBranchByNameOrId(branches, patterns, fallbackBranchId) {
    return findPriorityBranch(branches, patterns)
        || branches.find((branch) => Number(branch?.id_sucursal) === Number(fallbackBranchId))
        || null;
}

export async function resolveDispatchPriorityInventory({
    apiBaseUrl,
    token,
    branches,
    categories,
    fetchInventory,
    normalizeBackendProduct
}) {
    if (!apiBaseUrl || !token || !Array.isArray(branches) || !branches.length) {
        return {
            primaryBranch: null,
            secondaryBranch: null,
            inventoryByBranchId: new Map()
        };
    }

    const primaryBranch = findPriorityBranchByNameOrId(branches, ['casa matriz', 'matriz'], 1);
    const secondaryBranch = findPriorityBranchByNameOrId(branches, ['bodega'], 2);
    const targetBranches = [primaryBranch, secondaryBranch].filter(Boolean);

    if (!targetBranches.length) {
        return {
            primaryBranch,
            secondaryBranch,
            inventoryByBranchId: new Map()
        };
    }

    const inventoryEntries = await Promise.all(targetBranches.map(async (branch) => {
        const payload = await fetchInventory({
            apiBaseUrl,
            token,
            branchId: String(branch.id_sucursal)
        });

        const normalizedProducts = Array.isArray(payload)
            ? payload.map((product) => normalizeBackendProduct(product, categories)).filter(Boolean)
            : [];

        return [String(branch.id_sucursal), normalizedProducts];
    }));

    return {
        primaryBranch,
        secondaryBranch,
        inventoryByBranchId: new Map(inventoryEntries)
    };
}

export function applyDispatchPriorityStock(products, priorityInventory) {
    const primaryBranch = priorityInventory?.primaryBranch || null;
    const secondaryBranch = priorityInventory?.secondaryBranch || null;
    const inventoryByBranchId = priorityInventory?.inventoryByBranchId || new Map();
    const primaryInventory = primaryBranch ? (inventoryByBranchId.get(String(primaryBranch.id_sucursal)) || []) : [];
    const secondaryInventory = secondaryBranch ? (inventoryByBranchId.get(String(secondaryBranch.id_sucursal)) || []) : [];
    const primaryStockMap = new Map(primaryInventory.map((product) => [String(product.id), Number(product.stockActual || 0)]));
    const secondaryStockMap = new Map(secondaryInventory.map((product) => [String(product.id), Number(product.stockActual || 0)]));
    const mergedProductMap = new Map();

    const selectedProductIds = new Set(products.map((product) => String(product?.id || '')));

    [...products, ...primaryInventory, ...secondaryInventory].forEach((product) => {
        if (!product?.id) {
            return;
        }

        const productId = String(product.id);
        if (!mergedProductMap.has(productId)) {
            mergedProductMap.set(productId, {
                ...product,
                dispatchOnly: !selectedProductIds.has(productId)
            });
        }
    });

    return Array.from(mergedProductMap.values()).map((product) => {
        const primaryStock = primaryBranch ? Number(primaryStockMap.get(String(product.id)) || 0) : Number(product.stockActual || 0);
        const secondaryStock = secondaryBranch ? Number(secondaryStockMap.get(String(product.id)) || 0) : 0;
        const dispatchAvailableStock = primaryBranch || secondaryBranch
            ? primaryStock + secondaryStock
            : Number(product.stockActual || 0);

        let dispatchSourceLabel = primaryBranch?.nombreSucursal || 'Casa Matriz';
        if (primaryStock <= 0 && secondaryStock > 0) {
            dispatchSourceLabel = secondaryBranch?.nombreSucursal || 'Bodega';
        } else if (primaryStock > 0 && secondaryStock > 0) {
            dispatchSourceLabel = `${primaryBranch?.nombreSucursal || 'Casa Matriz'} + ${secondaryBranch?.nombreSucursal || 'Bodega'}`;
        } else if (!primaryBranch && !secondaryBranch) {
            dispatchSourceLabel = 'esta sucursal';
        }

        return {
            ...product,
            dispatchAvailableStock,
            dispatchPrimaryStock: primaryStock,
            dispatchSecondaryStock: secondaryStock,
            dispatchPrimaryBranchId: primaryBranch?.id_sucursal || null,
            dispatchSecondaryBranchId: secondaryBranch?.id_sucursal || null,
            dispatchPrimaryBranchName: primaryBranch?.nombreSucursal || 'Casa Matriz',
            dispatchSecondaryBranchName: secondaryBranch?.nombreSucursal || 'Bodega',
            dispatchSourceLabel
        };
    });
}
