const ADMIN_PRODUCT_LIMIT = 25;
const ADMIN_PRODUCT_FORM_REFERENCE_LIMIT = 500;
let adminProductSearchTimer = null;
let adminProductRequestId = 0;
let adminProductsCache = [];
let adminExpandedProductId = null;
let adminInboundRowSequence = 0;
let adminTransferRowSequence = 0;
let adminProductLookupCatalogPromise = null;
let adminInboundSubmitInFlight = false;
let adminTransferSubmitInFlight = false;

const adminProductPagination = {
    page: 1,
    hasMore: false,
    lastTerm: ''
};

function isWeightedAdminProduct(value) {
    return value === true || value === 1 || value === '1';
}

function emitInventoryChanged(detail = {}) {
    window.dispatchEvent(new CustomEvent('valmu:inventory-changed', {
        detail: {
            source: 'products',
            at: Date.now(),
            ...detail
        }
    }));
}

function buildAdminProductEndpoint(term = '', limit = ADMIN_PRODUCT_LIMIT, page = 1) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('page', String(page));
    params.set('offset', String(Math.max(0, page - 1) * limit));

    if (term.trim()) {
        params.set('search', term.trim());
    }

    return `/productos?${params.toString()}`;
}

function normalizeAdminSearchValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function formatAdminCurrency(value) {
    const numericValue = Number(value || 0);
    return Math.round(numericValue).toLocaleString('es-CL');
}

function formatAdminInteger(value) {
    const numericValue = Number(value || 0);
    return Math.round(numericValue).toLocaleString('es-CL');
}

function parseAdminIntegerInput(elementId, fallback = 0) {
    const rawValue = document.getElementById(elementId)?.value ?? '';
    if (rawValue === '') return fallback;

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return fallback;

    return Math.round(numericValue);
}

function parseAdminPositiveIntegerInput(elementId, fallback = 0) {
    return Math.max(0, parseAdminIntegerInput(elementId, fallback));
}

function parseAdminOptionalPositiveIntegerInput(elementId) {
    const rawValue = document.getElementById(elementId)?.value ?? '';
    if (rawValue === '') return null;

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return null;

    return Math.max(0, Math.round(numericValue));
}

async function fetchAdminProducts(term = '', limit = ADMIN_PRODUCT_LIMIT, page = 1) {
    const token = getAuthToken();
    return apiRequest({
        endpoint: buildAdminProductEndpoint(term, limit, page),
        method: 'GET',
        token
    });
}

function normalizeAdminReferenceOptions(items, idKey, nameKey) {
    const uniqueItems = new Map();

    (Array.isArray(items) ? items : []).forEach((item) => {
        const id = item?.[idKey];
        const label = String(item?.[nameKey] || '').trim();
        if (!id || !label || uniqueItems.has(id)) return;
        uniqueItems.set(id, item);
    });

    return Array.from(uniqueItems.values()).sort((left, right) =>
        String(left?.[nameKey] || '').localeCompare(String(right?.[nameKey] || ''), 'es', { sensitivity: 'base' })
    );
}

async function fetchAdminProductFormReferences(token) {
    const [catRes, supRes] = await Promise.all([
        apiRequest({
            endpoint: `/categorias?limit=${ADMIN_PRODUCT_FORM_REFERENCE_LIMIT}&offset=0&page=1`,
            token
        }),
        apiRequest({
            endpoint: `/proveedores?limit=${ADMIN_PRODUCT_FORM_REFERENCE_LIMIT}&offset=0&page=1`,
            token
        })
    ]);

    return {
        categories: normalizeAdminReferenceOptions(catRes.ok ? catRes.data : [], 'id_categoria', 'nombreCategoria'),
        suppliers: normalizeAdminReferenceOptions(supRes.ok ? supRes.data : [], 'id_proveedor', 'nombreProveedor')
    };
}

async function renderProducts() {
    if (isBodeguero()) {
        await renderWarehouseProducts();
        return;
    }

    const contentArea = document.getElementById('content-area');

    contentArea.innerHTML = `
        <div class="action-bar">
            <h2><span class="icon">📦</span> Inventario de Productos</h2>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="openProductForm()">+ Nuevo Producto</button>
                <button class="btn btn-ghost" onclick="adminNavigateToPage('inbound-create')">📥 Ingreso</button>
                <button class="btn btn-ghost" onclick="adminNavigateToPage('transfer-create')">🔄 Traslado</button>
            </div>
        </div>
        <div class="glass-panel mt-4" style="padding: 1rem;">
            <div style="display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1; min-width: 260px; margin: 0;">
                    <label>Buscar producto</label>
                    <input type="text" id="products-search" class="form-control" placeholder="Nombre o codigo de barras">
                </div>
                <button class="btn btn-ghost" id="products-search-clear">Limpiar</button>
            </div>
            <p class="text-muted" style="margin-top: 0.75rem; font-size: 0.85rem;">
                Vista paginada de ${ADMIN_PRODUCT_LIMIT} productos por pagina para mantener el modulo mas rapido.
            </p>
            <div id="products-search-status" class="text-muted" style="margin-top: 0.35rem; font-size: 0.8rem;"></div>
        </div>
        <div class="glass-panel mt-4">
            <div class="table-shell product-table-shell">
                <table class="data-table product-data-table">
                    <thead>
                        <tr>
                            <th>Codigo</th>
                            <th>Producto</th>
                            <th>Categoria</th>
                            <th>Precios</th>
                            <th>Proveedor</th>
                        </tr>
                    </thead>
                    <tbody id="products-list">
                        <tr><td colspan="5">Cargando productos...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination-bar">
                <div class="pagination-summary" id="products-pagination-summary">Preparando paginacion...</div>
                <div class="pagination-actions">
                    <button class="btn btn-ghost btn-sm" id="products-prev-page">Anterior</button>
                    <button class="btn btn-ghost btn-sm" id="products-next-page">Siguiente</button>
                </div>
            </div>
        </div>
    `;

    const searchInput = document.getElementById('products-search');
    const clearButton = document.getElementById('products-search-clear');
    const prevButton = document.getElementById('products-prev-page');
    const nextButton = document.getElementById('products-next-page');

    searchInput.addEventListener('input', () => {
        adminProductPagination.page = 1;
        renderAdminProductRows(filterAdminProductsLocally(searchInput.value));
        clearTimeout(adminProductSearchTimer);
        adminProductSearchTimer = setTimeout(() => {
            loadAdminProductTable(searchInput.value, 1);
        }, 350);
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        adminProductPagination.page = 1;
        loadAdminProductTable('', 1);
    });

    prevButton.addEventListener('click', () => {
        if (adminProductPagination.page <= 1) return;
        adminProductPagination.page -= 1;
        loadAdminProductTable(searchInput.value, adminProductPagination.page);
    });

    nextButton.addEventListener('click', () => {
        if (!adminProductPagination.hasMore) return;
        adminProductPagination.page += 1;
        loadAdminProductTable(searchInput.value, adminProductPagination.page);
    });

    await loadAdminProductTable('', 1);
}

async function renderWarehouseProducts() {
    const contentArea = document.getElementById('content-area');
    const activeBranchName = getActiveBranchName();

    contentArea.innerHTML = `
        <div class="action-bar">
            <div>
                <h2><span class="icon">📦</span> Ingreso de Stock</h2>
                <p class="text-muted" style="margin-top: 0.35rem;">
                    ${activeBranchName ? `Ingreso y traslado de mercaderia con foco en ${activeBranchName}.` : 'Ingreso y traslado de mercaderia para bodega.'}
                </p>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="adminNavigateToPage('inbound-create')">📥 Registrar ingreso</button>
                <button class="btn btn-ghost" onclick="adminNavigateToPage('transfer-create')">🔄 Trasladar stock</button>
            </div>
        </div>
        <div class="glass-panel mt-4" style="padding: 1rem;">
            <div style="display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1; min-width: 260px; margin: 0;">
                    <label>Buscar producto</label>
                    <input type="text" id="products-search" class="form-control" placeholder="Nombre o codigo de barras">
                </div>
                <button class="btn btn-ghost" id="products-search-clear">Limpiar</button>
            </div>
            <p class="text-muted" style="margin-top: 0.75rem; font-size: 0.85rem;">
                Esta vista permite revisar productos, ingresar stock y trasladar entre sucursales. La creacion y edicion de productos quedan reservadas al administrador.
            </p>
            <div id="products-search-status" class="text-muted" style="margin-top: 0.35rem; font-size: 0.8rem;"></div>
        </div>
        <div class="glass-panel mt-4">
            <div class="table-shell product-table-shell">
                <table class="data-table product-data-table">
                    <thead>
                        <tr>
                            <th>Codigo</th>
                            <th>Producto</th>
                            <th>Categoria</th>
                            <th>Precios</th>
                            <th>Proveedor</th>
                        </tr>
                    </thead>
                    <tbody id="products-list">
                        <tr><td colspan="5">Cargando productos...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination-bar">
                <div class="pagination-summary" id="products-pagination-summary">Preparando paginacion...</div>
                <div class="pagination-actions">
                    <button class="btn btn-ghost btn-sm" id="products-prev-page">Anterior</button>
                    <button class="btn btn-ghost btn-sm" id="products-next-page">Siguiente</button>
                </div>
            </div>
        </div>
    `;

    const searchInput = document.getElementById('products-search');
    const clearButton = document.getElementById('products-search-clear');
    const prevButton = document.getElementById('products-prev-page');
    const nextButton = document.getElementById('products-next-page');

    searchInput.addEventListener('input', () => {
        adminProductPagination.page = 1;
        renderAdminProductRows(filterAdminProductsLocally(searchInput.value));
        clearTimeout(adminProductSearchTimer);
        adminProductSearchTimer = setTimeout(() => {
            loadAdminProductTable(searchInput.value, 1);
        }, 350);
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        adminProductPagination.page = 1;
        loadAdminProductTable('', 1);
    });

    prevButton.addEventListener('click', () => {
        if (adminProductPagination.page <= 1) return;
        adminProductPagination.page -= 1;
        loadAdminProductTable(searchInput.value, adminProductPagination.page);
    });

    nextButton.addEventListener('click', () => {
        if (!adminProductPagination.hasMore) return;
        adminProductPagination.page += 1;
        loadAdminProductTable(searchInput.value, adminProductPagination.page);
    });

    await loadAdminProductTable('', 1);
}

async function loadAdminProductTable(term = '', page = 1) {
    const list = document.getElementById('products-list');
    const status = document.getElementById('products-search-status');
    const prevButton = document.getElementById('products-prev-page');
    const nextButton = document.getElementById('products-next-page');
    if (!list) return;

    const currentRequestId = ++adminProductRequestId;
    const normalizedTerm = term.trim();
    adminProductPagination.lastTerm = normalizedTerm;
    adminProductPagination.page = Math.max(1, page);

    if (!adminProductsCache.length) {
        list.innerHTML = `<tr><td colspan="5">Cargando productos...</td></tr>`;
    }

    if (status) {
        status.textContent = normalizedTerm
            ? `Buscando "${normalizedTerm}"...`
            : `Cargando pagina ${adminProductPagination.page}...`;
    }

    try {
        const response = await fetchAdminProducts(normalizedTerm, ADMIN_PRODUCT_LIMIT, adminProductPagination.page);
        if (currentRequestId !== adminProductRequestId) return;

        if (!response.ok) {
            list.innerHTML = `<tr><td colspan="5" class="text-error">Error: ${response.data?.error || response.error || 'No autorizado'}</td></tr>`;
            updateAdminProductPaginationUi({ totalShown: 0, page: adminProductPagination.page, hasMore: false });
            return;
        }

        const apiProducts = Array.isArray(response.data) ? response.data.slice() : [];
        const filteredProducts = filterAdminProductsLocally(normalizedTerm, apiProducts);
        const serverRespectsPagination = apiProducts.length <= ADMIN_PRODUCT_LIMIT;
        const pagedProducts = serverRespectsPagination
            ? filteredProducts
            : paginateAdminProducts(filteredProducts, adminProductPagination.page, ADMIN_PRODUCT_LIMIT);

        adminProductsCache = apiProducts;
        adminProductPagination.hasMore = serverRespectsPagination
            ? apiProducts.length === ADMIN_PRODUCT_LIMIT
            : adminProductPagination.page * ADMIN_PRODUCT_LIMIT < filteredProducts.length;

        renderAdminProductRows(pagedProducts);
        updateAdminProductPaginationUi({
            totalShown: pagedProducts.length,
            page: adminProductPagination.page,
            hasMore: adminProductPagination.hasMore,
            totalLocal: serverRespectsPagination ? null : filteredProducts.length
        });

        if (status) {
            if (normalizedTerm) {
                status.textContent = serverRespectsPagination
                    ? `Pagina ${adminProductPagination.page} con ${pagedProducts.length} resultado(s) para "${normalizedTerm}".`
                    : `${filteredProducts.length} coincidencia(s) locales para "${normalizedTerm}".`;
            } else {
                status.textContent = `Pagina ${adminProductPagination.page} con ${pagedProducts.length} producto(s).`;
            }
        }
    } catch (error) {
        console.error(error);
        list.innerHTML = `<tr><td colspan="5" class="text-error">Error de conexion.</td></tr>`;
        updateAdminProductPaginationUi({ totalShown: 0, page: adminProductPagination.page, hasMore: false });
    }

    if (prevButton) prevButton.disabled = adminProductPagination.page <= 1;
    if (nextButton) nextButton.disabled = !adminProductPagination.hasMore;
}

function filterAdminProductsLocally(term = '', source = adminProductsCache) {
    const normalizedTerm = normalizeAdminSearchValue(term);
    if (!normalizedTerm) return source;

    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);

    return source.filter((product) => {
        const haystack = [
            product.nombreProducto,
            product.codigoBarras,
            product.nombreCategoria,
            product.nombreProveedor,
            product.familiaPromo
        ]
            .filter(Boolean)
            .map(normalizeAdminSearchValue)
            .join(' ');

        return tokens.every((token) => haystack.includes(token));
    });
}

function paginateAdminProducts(products, page, pageSize) {
    const start = (Math.max(1, page) - 1) * pageSize;
    return products.slice(start, start + pageSize);
}

async function getAdminProductLookupCatalog(forceRefresh = false) {
    if (!forceRefresh && Array.isArray(window.adminProductLookupCatalog) && window.adminProductLookupCatalog.length) {
        return window.adminProductLookupCatalog;
    }

    if (!forceRefresh && adminProductLookupCatalogPromise) {
        return adminProductLookupCatalogPromise;
    }

    adminProductLookupCatalogPromise = (async () => {
        const token = getAuthToken();
        const response = await apiRequest({
            endpoint: '/productos?limit=10000&page=1&offset=0',
            method: 'GET',
            token
        });

        const products = response.ok && Array.isArray(response.data) ? response.data : [];
        window.adminProductLookupCatalog = products;
        adminProductLookupCatalogPromise = null;
        return products;
    })().catch((error) => {
        adminProductLookupCatalogPromise = null;
        throw error;
    });

    return adminProductLookupCatalogPromise;
}

function searchAdminProductCatalog(term = '', source = []) {
    const normalizedTerm = normalizeAdminSearchValue(term);
    if (!normalizedTerm) return [];

    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);

    return (Array.isArray(source) ? source : [])
        .map((product) => {
            const normalizedName = normalizeAdminSearchValue(product?.nombreProducto);
            const normalizedCode = normalizeAdminSearchValue(product?.codigoBarras);
            const haystack = [
                normalizedName,
                normalizedCode,
                normalizeAdminSearchValue(product?.nombreCategoria),
                normalizeAdminSearchValue(product?.nombreProveedor),
                normalizeAdminSearchValue(product?.familiaPromo)
            ].filter(Boolean).join(' ');

            if (!tokens.every((token) => haystack.includes(token))) {
                return null;
            }

            let score = 0;
            if (normalizedCode === normalizedTerm) score += 100;
            if (normalizedName === normalizedTerm) score += 80;
            if (normalizedCode.startsWith(normalizedTerm)) score += 30;
            if (normalizedName.startsWith(normalizedTerm)) score += 20;

            return { product, score };
        })
        .filter(Boolean)
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return String(left.product?.nombreProducto || '').localeCompare(
                String(right.product?.nombreProducto || ''),
                'es',
                { sensitivity: 'base' }
            );
        })
        .map((entry) => entry.product);
}

function findExactAdminProductMatch(term = '', source = []) {
    const normalizedTerm = normalizeAdminSearchValue(term);
    if (!normalizedTerm) return null;

    return (Array.isArray(source) ? source : []).find((product) => {
        const normalizedName = normalizeAdminSearchValue(product?.nombreProducto);
        const normalizedCode = normalizeAdminSearchValue(product?.codigoBarras);
        return normalizedName === normalizedTerm || normalizedCode === normalizedTerm;
    }) || null;
}

function updateAdminProductPaginationUi({ totalShown = 0, page = 1, hasMore = false, totalLocal = null }) {
    const paginationSummary = document.getElementById('products-pagination-summary');
    const prevButton = document.getElementById('products-prev-page');
    const nextButton = document.getElementById('products-next-page');

    if (paginationSummary) {
        if (totalLocal != null) {
            const start = totalLocal === 0 ? 0 : ((page - 1) * ADMIN_PRODUCT_LIMIT) + 1;
            const end = Math.min(page * ADMIN_PRODUCT_LIMIT, totalLocal);
            paginationSummary.textContent = `Mostrando ${start}-${end} de ${totalLocal} resultado(s).`;
        } else {
            paginationSummary.textContent = totalShown
                ? `Pagina ${page} con ${totalShown} registro(s).`
                : `Pagina ${page} sin resultados.`;
        }
    }

    if (prevButton) prevButton.disabled = page <= 1;
    if (nextButton) nextButton.disabled = !hasMore;
}

function renderAdminProductRows(products) {
    const list = document.getElementById('products-list');
    if (!list) return;

    window.allProducts = products;

    if (!products.length) {
        list.innerHTML = `<tr><td colspan="5" style="text-align:center;">No se encontraron productos.</td></tr>`;
        return;
    }

    list.innerHTML = products.map((product, index) => {
        const isExpanded = adminExpandedProductId === product.id_producto;
        const bodegueroMode = isBodeguero();
        const actionDescription = bodegueroMode
            ? 'Selecciona una accion para revisar el producto o registrar ingreso de stock.'
            : 'Selecciona una accion para ver, editar o eliminar este producto.';
        const actionButtons = bodegueroMode
            ? `
                        <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="previewProductByIndex(${index}, event)">Ver</button>
                        <button class="btn btn-primary btn-sm product-action-btn" type="button" onclick="openStockInboundFormByIndex(${index}, event)">Ingresar stock</button>
                    `
            : `
                        <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="previewProductByIndex(${index}, event)">Ver</button>
                        <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openProductFormByIndex(${index}, event)">Editar</button>
                        <button class="btn btn-ghost btn-sm text-error product-action-btn" type="button" onclick="deleteProduct(${product.id_producto}, event)">Borrar</button>
                    `;

        return `
        <tr
            class="product-row-compact product-row-clickable ${isExpanded ? 'is-expanded' : ''}"
            role="button"
            tabindex="0"
            aria-expanded="${isExpanded ? 'true' : 'false'}"
            onclick="toggleProductActions(${product.id_producto})"
            onkeydown="handleProductRowKeydown(event, ${product.id_producto})"
        >
            <td class="product-code-cell" data-label="Codigo"><code>${product.codigoBarras}</code></td>
            <td class="product-name-cell" data-label="Producto">
                <div class="product-name-stack">
                    <strong>${product.nombreProducto}</strong>
                    <span class="product-row-hint">${isExpanded ? 'Ocultar opciones' : 'Toca para ver opciones'}</span>
                </div>
                ${product.esPesable ? '<span class="badge badge-warning product-inline-badge">Pesable</span>' : ''}
                ${product.familiaPromo ? `<span class="badge badge-info product-inline-badge">Familia ${product.familiaPromo}</span>` : ''}
            </td>
            <td data-label="Categoria"><span class="badge badge-info product-category-badge">${product.nombreCategoria || 'Sin Cat.'}</span></td>
            <td class="product-prices-cell" data-label="Precios">
                <div class="product-price-line">Venta: <strong>$${formatAdminCurrency(product.precioDetalle)}</strong></div>
                <div class="product-cost-line">Costo: $${formatAdminCurrency(product.precioCosto)}</div>
            </td>
            <td class="product-supplier-cell" data-label="Proveedor">${product.nombreProveedor || '-'}</td>
        </tr>
        <tr class="product-action-row ${isExpanded ? 'is-expanded' : ''}">
            <td colspan="5" class="product-action-row-cell">
                <div class="product-actions-panel">
                    <div class="product-actions-panel-copy">
                        <strong>Opciones para ${product.nombreProducto}</strong>
                        <span>${actionDescription}</span>
                    </div>
                    <div class="product-actions-cell">
                        ${actionButtons}
                    </div>
                </div>
            </td>    
        </tr>
    `;
    }).join('');
}

function toggleProductActions(productId) {
    adminExpandedProductId = adminExpandedProductId === productId ? null : productId;
    renderAdminProductRows(window.allProducts || []);
}

function handleProductRowKeydown(event, productId) {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    event.preventDefault();
    toggleProductActions(productId);
}

function showMovementError(message) {
    const normalizedMessage = String(message || 'No se pudo completar la operacion').toLowerCase();
    const looksLikeStockError = normalizedMessage.includes('stock') || normalizedMessage.includes('insuf') || normalizedMessage.includes('existenc');

    if (looksLikeStockError) {
        Toast.fire({ icon: 'error', title: message || 'No hay stock suficiente' });
        return;
    }

    Swal.fire('Error', message || 'No se pudo completar la operacion', 'error');
}

function getMovementResponseError(response, fallback = 'No se pudo completar la operacion') {
    if (!response) return fallback;

    const statusLabel = response.status ? `HTTP ${response.status}` : 'Sin respuesta del servidor';
    const message = response.data?.error || response.error || response.data?.mensaje || fallback;
    const detail = response.data?.detalle ? ` (${typeof response.data.detalle === 'string' ? response.data.detalle : JSON.stringify(response.data.detalle)})` : '';
    return `${statusLabel}: ${message}${detail}`;
}

function createMovementRequestId(prefix = 'MOV') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openProductFormByIndex(index, event) {
    event?.stopPropagation?.();
    const product = window.allProducts[index];
    openProductForm(product);
}

function openStockInboundFormByIndex(index, event) {
    event?.stopPropagation?.();
    const product = window.allProducts[index];
    window.inboundCreateInitialProduct = product;
    adminNavigateToPage('inbound-create');
}

function previewProductByIndex(index, event) {
    event?.stopPropagation?.();
    const product = window.allProducts[index];
    if (!product) return;

    Swal.fire({
        html: `
            <div class="product-preview-header">
                <div class="preview-icon">📦</div>
                <div class="preview-title-stack">
                    <span class="preview-overline">Resumen del Producto</span>
                    <h3 class="preview-title">${product.nombreProducto || 'Producto'}</h3>
                </div>
            </div>
            <div class="preview-card-grid">
                <div class="preview-info-card">
                    <span class="preview-label">Codigo</span>
                    <strong class="preview-value">${product.codigoBarras || '-'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Categoria</span>
                    <strong class="preview-value">${product.nombreCategoria || 'General'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Proveedor</span>
                    <strong class="preview-value">${product.nombreProveedor || 'Ninguno'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Familia</span>
                    <strong class="preview-value">${product.familiaPromo || 'Sin familia'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Precio Detalle</span>
                    <strong class="preview-value text-accent">$${formatAdminCurrency(product.precioDetalle)}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Precio Costo</span>
                    <strong class="preview-value">$${formatAdminCurrency(product.precioCosto)}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Pesable</span>
                    <strong class="preview-value">${product.esPesable ? 'Si (Kilos)' : 'No (Unidad)'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Mayorista</span>
                    <strong class="preview-value">${Number(product.precioMayor) > 0 ? '$' + formatAdminCurrency(product.precioMayor) : '-'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Pallet</span>
                    <strong class="preview-value">${Number(product.precioPallet) > 0 ? '$' + formatAdminCurrency(product.precioPallet) : '-'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Oferta</span>
                    <strong class="preview-value">${product.precioOferta != null ? '$' + formatAdminCurrency(product.precioOferta) : '-'}</strong>
                </div>
            </div>
            <div class="preview-actions">
                <button class="btn btn-primary" onclick="Swal.close()">Entendido</button>
            </div>
        `,
        showConfirmButton: false,
        padding: 0,
        customClass: {
            popup: 'custom-swal-popup'
        },
        width: 820
    });
}

async function openProductForm(product = null) {
    const token = getAuthToken();
    const isEdit = !!product;

    const { categories, suppliers } = await fetchAdminProductFormReferences(token);

    const content = `
        <div class="product-form-grid">
            <div class="form-group" style="grid-column: span 2">
                <label>Nombre del Producto</label>
                <input type="text" id="p-name" class="form-control" value="${product?.nombreProducto || ''}" placeholder="Ej: Aceite Maravilla 1L">
            </div>
            <div class="form-group">
                <label>Codigo de Barras</label>
                <input type="text" id="p-code" class="form-control" value="${product?.codigoBarras || ''}" placeholder="780...">
            </div>
            <div class="form-group product-form-toggle">
                <input type="checkbox" id="p-pesable" ${product?.esPesable ? 'checked' : ''} style="width: 20px; height: 20px;">
                <label for="p-pesable" style="margin: 0">¿Es Producto Pesable? (Kilos)</label>
            </div>
            <div class="form-group">
                <label>Precio Costo</label>
                <input type="number" id="p-cost" class="form-control" value="${Math.round(product?.precioCosto || 0)}" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Precio Detalle (Venta)</label>
                <input type="number" id="p-price" class="form-control" value="${Math.round(product?.precioDetalle || 0)}" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Precio Mayorista</label>
                <input type="number" id="p-wholesale" class="form-control" value="${Math.round(product?.precioMayor || 0)}" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Precio Pallet</label>
                <input type="number" id="p-pallet" class="form-control" value="${Math.round(product?.precioPallet || 0)}" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Precio Oferta</label>
                <input type="number" id="p-offer" class="form-control" value="${product?.precioOferta != null ? Math.round(product.precioOferta) : ''}" placeholder="Opcional" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Cantidad Mayorista</label>
                <input type="number" id="p-major-qty" class="form-control" value="${product?.precioMayor > 0 && product?.cantidadMayor != null ? Math.max(0, Math.round(product.cantidadMayor)) : ''}" placeholder="Solo si defines precio mayorista" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group">
                <label>Cantidad por Pallet</label>
                <input type="number" id="p-pallet-qty" class="form-control" value="${product?.precioPallet > 0 && product?.cantidadPallet != null ? Math.max(0, Math.round(product.cantidadPallet)) : ''}" placeholder="Solo si defines precio pallet" step="1" min="0" inputmode="numeric">
            </div>
            <div class="form-group" style="grid-column: span 2">
                <label>Familia promocional</label>
                <input type="text" id="p-family" class="form-control" value="${product?.familiaPromo || ''}" placeholder="Ej: bebidas-3l, yogur-batido, sabor-mix">
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <select id="p-category" class="form-control">
                    <option value="">Seleccionar Categoria</option>
                    ${categories.map((c) => `<option value="${c.id_categoria}" ${product?.id_categoria === c.id_categoria ? 'selected' : ''}>${c.nombreCategoria}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Proveedor</label>
                <select id="p-supplier" class="form-control">
                    <option value="">Seleccionar Proveedor</option>
                    ${suppliers.map((s) => `<option value="${s.id_proveedor}" ${product?.id_proveedor === s.id_proveedor ? 'selected' : ''}>${s.nombreProveedor}</option>`).join('')}
                </select>
            </div>
        </div>
    `;

    showModal(isEdit ? 'Editar Producto' : 'Crear Nuevo Producto', content, async () => {
        const data = {
            nombreProducto: document.getElementById('p-name').value,
            codigoBarras: document.getElementById('p-code').value,
            precioCosto: parseAdminIntegerInput('p-cost'),
            precioDetalle: parseAdminIntegerInput('p-price'),
            precioMayor: parseAdminIntegerInput('p-wholesale'),
            precioPallet: parseAdminIntegerInput('p-pallet'),
            precioOferta: document.getElementById('p-offer').value === '' ? null : parseAdminIntegerInput('p-offer'),
            cantidadMayor: parseAdminIntegerInput('p-wholesale') > 0 ? parseAdminOptionalPositiveIntegerInput('p-major-qty') : null,
            cantidadPallet: parseAdminIntegerInput('p-pallet') > 0 ? parseAdminOptionalPositiveIntegerInput('p-pallet-qty') : null,
            familiaPromo: document.getElementById('p-family').value.trim() || null,
            id_categoria: document.getElementById('p-category').value ? parseInt(document.getElementById('p-category').value, 10) : null,
            id_proveedor: document.getElementById('p-supplier').value ? parseInt(document.getElementById('p-supplier').value, 10) : null,
            esPesable: document.getElementById('p-pesable').checked
        };

        if (!data.nombreProducto || !data.codigoBarras) {
            Swal.fire('Error', 'Nombre y Codigo son obligatorios', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: isEdit ? `/productos/${product.id_producto}` : '/productos',
            method: isEdit ? 'PUT' : 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: isEdit ? 'Producto actualizado' : 'Producto creado' });
            window.adminProductLookupCatalog = null;
            closeModal();
            loadAdminProductTable(document.getElementById('products-search')?.value || '', adminProductPagination.page);
        } else {
            Swal.fire('Error', response.data?.error || response.error || 'No se pudo procesar', 'error');
        }
    });
}

async function deleteProduct(id, event) {
    event?.stopPropagation?.();
    const result = await Swal.fire({
        title: '¿Estas seguro?',
        text: '¡No podras revertir esto!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff8a43',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const token = getAuthToken();
    const response = await apiRequest({
        endpoint: `/productos/${id}`,
        method: 'DELETE',
        token
    });

    if (response.ok) {
        Toast.fire({ icon: 'success', title: 'Producto eliminado' });
        window.adminProductLookupCatalog = null;
        loadAdminProductTable(document.getElementById('products-search')?.value || '', adminProductPagination.page);
    } else {
        Swal.fire('Error', response.data?.error || response.error || 'No se pudo eliminar', 'error');
    }
}

async function renderInboundCreateView() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();
    const activeBranchId = getActiveBranchId();
    const activeBranchName = getActiveBranchName();
    const branchRes = await apiRequest({ endpoint: '/sucursales', token });
    const allBranches = branchRes.ok ? branchRes.data : [];
    const branches = allBranches;

    if (!branches.length) {
        Swal.fire('Sucursal requerida', 'No hay una sucursal disponible para registrar el ingreso de stock.', 'warning');
        return;
    }

    const defaultBranchId = activeBranchId || Number(branches[0]?.id_sucursal) || null;
    const defaultBranchName = activeBranchName || branches.find((branch) => Number(branch.id_sucursal) === defaultBranchId)?.nombreSucursal || 'Sucursal destino';
    let selectedBranchId = Number(defaultBranchId);
    const inboundBatchId = createMovementRequestId('INGRESO');

    contentArea.innerHTML = `
        <div class="action-bar" style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem 2rem; border-radius: 16px; margin-bottom: 2rem; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);">
            <div>
                <h2 style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.75rem; color: white; font-size: 1.5rem;">
                    <button class="btn btn-ghost" onclick="adminNavigateToPage('products')" title="Volver al inventario" style="color: white; background: rgba(255,255,255,0.2); border-radius: 50%; padding: 0.5rem 0.6rem;">
                        <i class="bi bi-arrow-left" style="font-size: 1.2rem;"></i>
                    </button>
                    Ingreso de Mercadería (Compras)
                </h2>
                <p style="margin-top: 0; font-size: 0.95rem; color: rgba(255,255,255,0.8); margin-left: 3.2rem;">
                    Registrando compra para <strong id="inb-branch-name" style="color: white; background: rgba(255,255,255,0.2); padding: 0.1rem 0.5rem; border-radius: 4px;">${defaultBranchName}</strong>
                </p>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button class="btn btn-ghost" onclick="adminNavigateToPage('products')" style="color: white; border: 1px solid rgba(255,255,255,0.4);">
                    Cancelar
                </button>
                <button class="btn" id="save-inbound-btn" style="background: white; color: #4f46e5; font-weight: bold; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <i class="bi bi-check2-circle"></i> Registrar ingreso
                </button>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            <!-- Panel de Datos del Ingreso -->
            <div class="glass-panel" style="padding: 1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <h3 style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="bi bi-file-earmark-text text-primary"></i> Datos del Documento
                </h3>
                <div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; font-size: 0.9rem;">Sucursal Destino</label>
                        <div class="input-with-icon" style="position: relative;">
                            <i class="bi bi-shop" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                            <select id="inb-branch" class="form-control" ${isBodeguero() && activeBranchId ? 'disabled' : ''} style="appearance: none; -webkit-appearance: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.75rem 2.5rem; font-weight: 600; font-size: 0.95rem; width: 100%; color: #1e293b; cursor: pointer; outline: none; transition: all 0.2s; position: relative;">
                                ${branches.map((branch) => `
                                    <option value="${branch.id_sucursal}" ${Number(branch.id_sucursal) === selectedBranchId ? 'selected' : ''}>
                                        ${branch.nombreSucursal}
                                    </option>
                                `).join('')}
                            </select>
                            ${!(isBodeguero() && activeBranchId) ? '<i class="bi bi-chevron-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>' : ''}
                        </div>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; font-size: 0.9rem;">Número de Factura / Guía</label>
                        <div class="input-with-icon" style="position: relative;">
                            <i class="bi bi-receipt" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                            <input type="text" id="mov-invoice" class="form-control" placeholder="Ej: FAC-1234 o GUIA-987" style="padding-left: 2.5rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 600; font-size: 0.95rem; height: auto; padding-top: 0.75rem; padding-bottom: 0.75rem;">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Panel de Productos -->
            <div class="glass-panel" style="padding: 1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; min-height: 50vh;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0;">
                    <div>
                        <h3 style="margin: 0; color: #1e293b; font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="bi bi-box-seam text-primary"></i> Productos a ingresar
                        </h3>
                        <div class="text-muted" style="font-size:0.85rem; margin-top: 0.3rem;">Busca y agrega los ítems que ingresarán al inventario.</div>
                    </div>
                    <button type="button" class="btn btn-primary" id="mov-add-line-btn" style="border-radius: 8px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <i class="bi bi-plus-lg"></i> Agregar línea
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 2.5rem minmax(200px, 3fr) minmax(120px, 1fr) 3rem; gap: 1rem; padding: 0.5rem 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; font-weight: 600; color: #475569; font-size: 0.85rem; border: 1px solid #e2e8f0;">
                    <div style="text-align: center;">N°</div>
                    <div>Producto</div>
                    <div style="text-align: center;">Cant. Ingreso</div>
                    <div></div>
                </div>

                <div id="mov-lines" style="display:grid; gap: 0.75rem; padding-bottom: 2rem;"></div>
            </div>
        </div>
    `;

    document.getElementById('save-inbound-btn').addEventListener('click', async () => {
        if (adminInboundSubmitInFlight) {
            return;
        }

        const targetBranchId = parseInt(document.getElementById('inb-branch').value, 10);
        const invoiceNumber = document.getElementById('mov-invoice').value.trim();
        const lineRows = Array.from(document.querySelectorAll('.mov-line-row'));
        const saveButton = document.getElementById('save-inbound-btn');
        const releaseInboundSubmit = () => {
            adminInboundSubmitInFlight = false;
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Registrar ingreso';
            }
        };

        adminInboundSubmitInFlight = true;
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Registrando ingreso...';
        }

        if (Number.isNaN(targetBranchId)) {
            Swal.fire('Error', 'Debes seleccionar una sucursal válida.', 'error');
            releaseInboundSubmit();
            return;
        }

        const parsedLines = lineRows.map((row) => ({
            productId: parseInt(row.querySelector('.mov-line-product-id')?.value, 10),
            productName: row.querySelector('.mov-line-search')?.value?.trim() || 'Producto',
            quantity: parseFloat(row.querySelector('.mov-line-qty')?.value),
            isPesable: row.querySelector('.mov-line-search')?.dataset?.pesable === '1'
        })).filter((line) => !Number.isNaN(line.productId) || !Number.isNaN(line.quantity));

        if (!parsedLines.length) {
            Swal.fire('Error', 'Debes agregar al menos un producto al ingreso.', 'error');
            releaseInboundSubmit();
            return;
        }

        const invalidLine = parsedLines.find((line) => Number.isNaN(line.productId) || Number.isNaN(line.quantity) || line.quantity <= 0);
        if (invalidLine) {
            Swal.fire('Error', 'Todas las líneas deben tener producto y cantidad válida.', 'error');
            releaseInboundSubmit();
            return;
        }

        const aggregatedLines = Array.from(parsedLines.reduce((map, line) => {
            const current = map.get(line.productId) || { ...line, quantity: 0 };
            current.quantity += line.quantity;
            map.set(line.productId, current);
            return map;
        }, new Map()).values());

        const currentUserId = getCurrentUserId();
        try {
            for (const line of aggregatedLines) {
                const response = await apiRequest({
                    endpoint: '/productos/ingreso',
                    method: 'POST',
                    body: {
                        id_producto: line.productId,
                        id_usuario: currentUserId,
                        id_sucursal: targetBranchId,
                        cantidadIngreso: line.quantity,
                        numeroFactura: invoiceNumber,
                        comprobanteMov: `${inboundBatchId}-${line.productId}`
                    },
                    token
                });

                if (!response.ok) {
                    showMovementError(`${line.productName}: ${getMovementResponseError(response, 'Error al registrar el ingreso')}`);
                    return;
                }
            }
        } finally {
            releaseInboundSubmit();
        }

        Toast.fire({ icon: 'success', title: `Ingreso registrado con ${aggregatedLines.length} producto(s)` });
        window.adminProductLookupCatalog = null;
        emitInventoryChanged({
            type: 'ingreso',
            branchIds: [targetBranchId],
            productIds: aggregatedLines.map((line) => line.productId)
        });
        adminNavigateToPage('products');
    });

    document.getElementById('inb-branch')?.addEventListener('change', (event) => {
        selectedBranchId = Number(event.target.value);
        const selectedBranch = branches.find((branch) => Number(branch.id_sucursal) === selectedBranchId);
        const branchNameLabel = document.getElementById('inb-branch-name');
        if (branchNameLabel) {
            branchNameLabel.textContent = selectedBranch?.nombreSucursal || 'Sucursal destino';
        }
    });

    document.getElementById('mov-add-line-btn')?.addEventListener('click', () => {
        appendInboundLineRow();
    });

    const initialProduct = window.inboundCreateInitialProduct || null;
    window.inboundCreateInitialProduct = null;

    if (initialProduct) {
        appendInboundLineRow(initialProduct);
    } else {
        appendInboundLineRow();
        appendInboundLineRow();
    }
}
window.renderInboundCreateView = renderInboundCreateView;

async function renderTransferCreateView() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();
    const activeBranchId = getActiveBranchId();
    const activeBranchName = getActiveBranchName();
    const branchRes = await apiRequest({ endpoint: '/sucursales', token });
    const allBranches = branchRes.ok ? branchRes.data : [];
    const branches = allBranches;

    if (!branches.length) {
        Swal.fire('Sucursal requerida', 'No hay sucursales disponibles para registrar traslados.', 'warning');
        return;
    }

    const defaultSourceId = activeBranchId || Number(branches[0]?.id_sucursal) || null;
    const defaultSourceName = activeBranchName || branches.find((branch) => Number(branch.id_sucursal) === defaultSourceId)?.nombreSucursal || 'Sucursal origen';
    let selectedSourceId = Number(defaultSourceId);
    let inventoryMapPromise = fetchTransferInventoryMap(selectedSourceId, token);
    const transferBatchId = createMovementRequestId('TRASLADO');

    contentArea.innerHTML = `
        <div class="action-bar" style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem 2rem; border-radius: 16px; margin-bottom: 2rem; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);">
            <div>
                <h2 style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.75rem; color: white; font-size: 1.5rem;">
                    <button class="btn btn-ghost" onclick="adminNavigateToPage('transfers')" title="Volver al historial" style="color: white; background: rgba(255,255,255,0.2); border-radius: 50%; padding: 0.5rem 0.6rem;">
                        <i class="bi bi-arrow-left" style="font-size: 1.2rem;"></i>
                    </button>
                    Nuevo Traslado
                </h2>
                <p style="margin-top: 0; font-size: 0.95rem; color: rgba(255,255,255,0.8); margin-left: 3.2rem;">
                    Moviendo stock desde <strong id="tra-origin-name" style="color: white; background: rgba(255,255,255,0.2); padding: 0.1rem 0.5rem; border-radius: 4px;">${defaultSourceName}</strong>
                </p>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button class="btn btn-ghost" onclick="adminNavigateToPage('transfers')" style="color: white; border: 1px solid rgba(255,255,255,0.4);">
                    Cancelar
                </button>
                <button class="btn" id="save-transfer-btn" style="background: white; color: #4f46e5; font-weight: bold; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <i class="bi bi-check2-circle"></i> Registrar traslados
                </button>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            <!-- Panel de Sucursales -->
            <div class="glass-panel" style="padding: 1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <h3 style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="bi bi-geo-alt text-primary"></i> Datos de Origen y Destino
                </h3>
                <div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; font-size: 0.9rem;">Sucursal de Origen</label>
                        <div class="input-with-icon" style="position: relative;">
                            <i class="bi bi-shop" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                            <select id="tra-origin" class="form-control" style="appearance: none; -webkit-appearance: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.75rem 2.5rem; font-weight: 600; font-size: 0.95rem; width: 100%; color: #1e293b; cursor: pointer; outline: none; transition: all 0.2s; position: relative;">
                                ${branches.map((branch) => `
                                    <option value="${branch.id_sucursal}" ${Number(branch.id_sucursal) === selectedSourceId ? 'selected' : ''}>
                                        ${branch.nombreSucursal}
                                    </option>
                                `).join('')}
                            </select>
                            <i class="bi bi-chevron-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                        </div>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; font-size: 0.9rem;">Sucursal de Destino</label>
                        <div class="input-with-icon" style="position: relative;">
                            <i class="bi bi-shop-window" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                            <select id="tra-dest" class="form-control" style="appearance: none; -webkit-appearance: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.75rem 2.5rem; font-weight: 600; font-size: 0.95rem; width: 100%; color: #1e293b; cursor: pointer; outline: none; transition: all 0.2s; position: relative;"></select>
                            <i class="bi bi-chevron-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Panel de Productos -->
            <div class="glass-panel" style="padding: 1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; min-height: 50vh;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0;">
                    <div>
                        <h3 style="margin: 0; color: #1e293b; font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="bi bi-box-seam text-primary"></i> Productos a trasladar
                        </h3>
                        <div class="text-muted" style="font-size:0.85rem; margin-top: 0.3rem;">Busca y agrega los ítems que vas a mover entre las bodegas.</div>
                    </div>
                    <button type="button" class="btn btn-primary" id="tra-add-line-btn" style="border-radius: 8px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <i class="bi bi-plus-lg"></i> Agregar línea
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 2.5rem minmax(200px, 2.5fr) minmax(120px, 1.2fr) minmax(120px, 1fr) 3rem; gap: 1rem; padding: 0.5rem 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; font-weight: 600; color: #475569; font-size: 0.85rem; border: 1px solid #e2e8f0;">
                    <div style="text-align: center;">N°</div>
                    <div>Producto</div>
                    <div style="text-align: center;">Stock Origen</div>
                    <div style="text-align: center;">Cant. Traslado</div>
                    <div></div>
                </div>

                <div id="tra-lines" style="display:grid; gap: 0.75rem; padding-bottom: 2rem;"></div>
            </div>
        </div>
    `;

    document.getElementById('save-transfer-btn').addEventListener('click', async () => {
        if (adminTransferSubmitInFlight) {
            return;
        }

        const currentUserId = getCurrentUserId();
        const currentUser = getCurrentUser();
        const sourceId = parseInt(document.getElementById('tra-origin')?.value || '', 10);
        const destinationId = parseInt(document.getElementById('tra-dest').value, 10);
        const saveButton = document.getElementById('save-transfer-btn');
        const sourceLabel = document.getElementById('tra-origin')?.selectedOptions?.[0]?.textContent?.trim() || `Sucursal #${sourceId}`;
        const releaseTransferSubmit = () => {
            adminTransferSubmitInFlight = false;
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Registrar traslados';
            }
        };

        adminTransferSubmitInFlight = true;
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Registrando traslados...';
        }

        if (isNaN(sourceId) || isNaN(destinationId)) {
            Swal.fire('Error', 'Debes seleccionar sucursal origen y sucursal destino.', 'error');
            releaseTransferSubmit();
            return;
        }

        if (sourceId === destinationId) {
            Swal.fire('Error', 'La sucursal de origen y destino deben ser distintas.', 'error');
            releaseTransferSubmit();
            return;
        }

        const rowElements = Array.from(document.querySelectorAll('.tra-line-row'));
        const rawLines = rowElements.map((row) => ({
            productId: parseInt(row.querySelector('.tra-line-product-id')?.value || '', 10),
            quantity: Number(row.querySelector('.tra-line-qty')?.value || 0),
            label: row.querySelector('.tra-line-selected')?.textContent || 'Sin producto seleccionado',
            isWeighted: row.querySelector('.tra-line-search')?.dataset.pesable === '1'
        }));

        const validLines = rawLines.filter((line) => Number.isFinite(line.productId) && Number.isFinite(line.quantity) && line.quantity > 0);
        if (!validLines.length) {
            Swal.fire('Error', 'Agrega al menos un producto con cantidad valida para trasladar.', 'error');
            releaseTransferSubmit();
            return;
        }

        const aggregatedLines = Array.from(validLines.reduce((map, line) => {
            const current = map.get(line.productId) || {
                productId: line.productId,
                quantity: 0,
                label: line.label,
                isWeighted: line.isWeighted
            };
            current.quantity += line.quantity;
            map.set(line.productId, current);
            return map;
        }, new Map()).values());

        let sourceInventoryMap;
        try {
            sourceInventoryMap = await fetchTransferInventoryMap(sourceId, token);
        } catch (error) {
            console.error('Error fetching transfer inventory:', error);
            Swal.fire('Error', 'No se pudo validar el stock actualizado del origen.', 'error');
            releaseTransferSubmit();
            return;
        }

        const stockIssues = aggregatedLines
            .map((line) => {
                const stockItem = sourceInventoryMap.get(line.productId);
                const availableStock = Number(stockItem?.stock || 0);
                if (line.quantity <= availableStock) return null;

                const availableLabel = stockItem
                    ? formatTransferStockLabel(availableStock, stockItem.esPesable)
                    : '0 un.';

                return `${line.label}: solicitaste ${formatTransferStockLabel(line.quantity, line.isWeighted)} y solo hay ${availableLabel}`;
            })
            .filter(Boolean);

        if (stockIssues.length) {
            Swal.fire('Stock insuficiente', stockIssues.join('<br>'), 'error');
            releaseTransferSubmit();
            return;
        }

        const transferredProductIds = [];
        const destinationLabel = document.getElementById('tra-dest')?.selectedOptions?.[0]?.textContent || `Sucursal #${destinationId}`;

        const resolvedUserId = currentUser?.id_usuario || currentUserId || null;
        if (!resolvedUserId) {
            Swal.fire('Usuario requerido', 'No se pudo obtener el ID del usuario para registrar el traslado. Vuelve a iniciar sesión.', 'error');
            releaseTransferSubmit();
            return;
        }

        try {
            for (const line of aggregatedLines) {
                const data = {
                    id_producto: line.productId,
                    id_usuario: resolvedUserId,
                    idUsuario: resolvedUserId,
                    usuario_id: resolvedUserId,
                    id_sucursalOrigen: sourceId,
                    id_sucursalDestino: destinationId,
                    cantidadMov: line.quantity,
                    comprobanteMov: `${transferBatchId}-${line.productId}`
                };

                console.log('[Traslado] Payload enviado', data);

                const response = await apiRequest({
                    endpoint: '/productos/traslado',
                    method: 'POST',
                    body: data,
                    token
                });

                if (!response.ok) {
                    const backendMessage = getMovementResponseError(response, 'Error al procesar el traslado');
                    const partialMessage = transferredProductIds.length
                        ? `\n\nSe alcanzaron a trasladar ${transferredProductIds.length} producto(s) antes del error. Si reintentas esta misma ventana, el backend no duplicara los ya registrados.`
                        : '';

                    showMovementError(
                        `${backendMessage}${partialMessage}\n\n` +
                        `Operacion: ${data.comprobanteMov}\n` +
                        `Usuario enviado: ${data.id_usuario || 'No disponible'}\n` +
                        `Origen validado: #${data.id_sucursalOrigen} (${sourceLabel})\n` +
                        `Destino seleccionado: #${data.id_sucursalDestino} (${destinationLabel})\n` +
                        `Producto: ${line.label}\n` +
                        `Cantidad: ${line.quantity}`
                    );
                    return;
                }

                transferredProductIds.push(line.productId);
            }
        } finally {
            adminTransferSubmitInFlight = false;
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Registrar traslados';
            }
        }

        Toast.fire({ icon: 'success', title: `Traslado realizado con ${aggregatedLines.length} producto(s)` });
        window.adminProductLookupCatalog = null;
        emitInventoryChanged({
            type: 'traslado',
            branchIds: [sourceId, destinationId],
            productIds: transferredProductIds
        });
        adminNavigateToPage('transfers');
    });

    document.getElementById('save-transfer-btn').textContent = 'Registrar traslados';
    syncTransferDestinationOptions(branches, selectedSourceId);

    document.getElementById('tra-origin')?.addEventListener('change', (event) => {
        selectedSourceId = Number(event.target.value);
        inventoryMapPromise = fetchTransferInventoryMap(selectedSourceId, token);
        syncTransferDestinationOptions(branches, selectedSourceId);

        const linesContainer = document.getElementById('tra-lines');
        if (linesContainer) {
            linesContainer.innerHTML = '';
        }

        appendTransferLineRow(selectedSourceId, () => inventoryMapPromise);
    });

    document.getElementById('tra-add-line-btn')?.addEventListener('click', () => {
        appendTransferLineRow(selectedSourceId, () => inventoryMapPromise);
    });

    appendTransferLineRow(selectedSourceId, () => inventoryMapPromise);
}
window.renderTransferCreateView = renderTransferCreateView;

function initAdminProductPicker({ searchInputId, resultsId, hiddenId, selectedLabelId, quantityInputId, stockInfoId, stockQtyId, sourceBranchId }) {
    const searchInput = document.getElementById(searchInputId);
    const results = document.getElementById(resultsId);
    const hiddenInput = document.getElementById(hiddenId);
    const selectedLabel = document.getElementById(selectedLabelId);
    const qtyInput = document.getElementById(quantityInputId);
    const stockInfoDiv = stockInfoId ? document.getElementById(stockInfoId) : null;
    const stockQtySpan = stockQtyId ? document.getElementById(stockQtyId) : null;

    let timer = null;
    let lastMatches = [];

    // Función para obtener stock del producto en la sucursal origen
    const fetchProductStock = async (productId) => {
        if (!sourceBranchId || !stockInfoDiv || !stockQtySpan) return;
        
        try {
            const token = getAuthToken();
            const invRes = await apiRequest({ 
                endpoint: `/productos/inventario?id_sucursal=${sourceBranchId}`, 
                token 
            });
            const inventario = Array.isArray(invRes?.data) ? invRes.data : [];
            const item = inventario.find(i => Number(i.id_producto) === Number(productId));
            const stock = item ? (Number(item.stockActual || item.cantidad || item.stock || 0)) : 0;
            const esPesable = isWeightedAdminProduct(item?.esPesable);
            
            stockQtySpan.textContent = esPesable ? `${stock.toFixed(3)} Kg` : `${Math.round(stock)} unidades`;
            stockInfoDiv.style.display = 'block';
            
            // Cambiar color si stock es bajo
            if (stock <= 0) {
                stockInfoDiv.style.background = '#fef2f2';
                stockInfoDiv.style.borderColor = '#fca5a5';
                stockQtySpan.parentElement.style.color = '#991b1b';
            } else {
                stockInfoDiv.style.background = '#f0fdf4';
                stockInfoDiv.style.borderColor = '#86efac';
                stockQtySpan.parentElement.style.color = '#166534';
            }
        } catch (e) {
            console.error('Error fetching stock:', e);
            stockInfoDiv.style.display = 'none';
        }
    };

    const selectProduct = (product) => {
        if (!product) return;

        hiddenInput.value = product.id_producto;
        selectedLabel.textContent = `${product.nombreProducto || 'Producto'} (${product.codigoBarras || 'Sin codigo'})`;
        searchInput.value = product.codigoBarras || product.nombreProducto || '';
        searchInput.dataset.pesable = isWeightedAdminProduct(product.esPesable) ? '1' : '0';
        results.innerHTML = '';
        lastMatches = [];
        updateProductQuantityStep(isWeightedAdminProduct(product.esPesable), qtyInput);
        void fetchProductStock(product.id_producto);
        qtyInput?.focus?.();
    };

    const renderMatches = (products) => {
        lastMatches = Array.isArray(products) ? products : [];
        results.innerHTML = lastMatches.map((product) => `
            <button
                type="button"
                class="btn btn-ghost"
                data-index="${product.id_producto}"
                style="justify-content:flex-start; text-align:left;"
            >
                <strong>${product.nombreProducto}</strong> <span style="margin-left:0.5rem; color:var(--text-muted);">${product.codigoBarras || 'Sin codigo'}</span>
            </button>
        `).join('');

        Array.from(results.querySelectorAll('button')).forEach((button, index) => {
            button.addEventListener('click', () => {
                selectProduct(lastMatches[index]);
            });
        });
    };

    searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const term = searchInput.value.trim();

            if (!term) {
                results.innerHTML = '';
                lastMatches = [];
                hiddenInput.value = '';
                selectedLabel.textContent = 'Sin producto seleccionado';
                if (stockInfoDiv) stockInfoDiv.style.display = 'none';
                return;
            }

            const catalog = await getAdminProductLookupCatalog();
            const exactMatch = findExactAdminProductMatch(term, catalog);
            if (exactMatch) {
                selectProduct(exactMatch);
                return;
            }

            renderMatches(searchAdminProductCatalog(term, catalog).slice(0, 12));
        }, 300);
    });

    searchInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();

        const term = searchInput.value.trim();
        if (!term) return;

        const catalog = await getAdminProductLookupCatalog();
        const match = findExactAdminProductMatch(term, catalog) || lastMatches[0] || searchAdminProductCatalog(term, catalog)[0];

        if (match) {
            selectProduct(match);
        }
    });
}

async function fetchTransferInventoryMap(sourceBranchId, token = getAuthToken()) {
    if (!sourceBranchId) return new Map();

    const inventoryResponse = await apiRequest({
        endpoint: `/productos/inventario?id_sucursal=${sourceBranchId}`,
        token
    });
    const inventoryItems = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : [];

    return new Map(inventoryItems.map((item) => [
        Number(item.id_producto),
        {
            stock: Number(item.stockActual ?? item.cantidad ?? item.stock ?? 0),
            esPesable: isWeightedAdminProduct(item?.esPesable)
        }
    ]));
}

function formatTransferStockLabel(quantity, isPesable) {
    const numericValue = Number(quantity || 0);
    return isPesable
        ? `${numericValue.toFixed(3)} Kg`
        : `${Math.round(numericValue).toLocaleString('es-CL')} un.`;
}

async function resolveTransferInventoryMap(inventorySource) {
    if (typeof inventorySource === 'function') {
        return await inventorySource();
    }

    return await inventorySource;
}

function appendTransferLineRow(sourceBranchId, inventorySource, product = null) {
    const linesContainer = document.getElementById('tra-lines');
    if (!linesContainer) return;

    adminTransferRowSequence += 1;
    const rowId = adminTransferRowSequence;
    const row = document.createElement('div');
    row.className = 'tra-line-row';
    row.dataset.rowId = String(rowId);
    row.style.cssText = 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem 1rem; transition: all 0.2s; display: flex; align-items: center;';
    
    // Agregamos hover via event listeners o clase.
    row.classList.add('tra-line-row-hover');

    row.innerHTML = `
        <div style="display: grid; grid-template-columns: 2.5rem minmax(200px, 2.5fr) minmax(120px, 1.2fr) minmax(120px, 1fr) 3rem; gap: 1rem; align-items: center; width: 100%;">
            <!-- Index -->
            <div style="font-weight: 700; color: #94a3b8; font-size: 1.1rem; text-align: center; font-family: monospace;">
                ${rowId}
            </div>
            
            <!-- Search & Info -->
            <div style="position: relative;">
                <div style="position: relative;">
                    <i class="bi bi-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                    <input type="text" class="form-control tra-line-search" placeholder="Escribe para buscar un producto..." autocomplete="off" style="padding-left: 2.2rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem;">
                    <input type="hidden" class="tra-line-product-id">
                </div>
                <div class="tra-line-results" style="display:grid; gap:0.25rem; margin-top:0.4rem; position: absolute; z-index: 50; width: 100%; background: white; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto;"></div>
                <div class="tra-line-selected" style="margin-top:0.4rem; font-size:0.8rem; color:#64748b; font-weight:500; display:flex; align-items:center; gap:0.4rem; padding-left: 0.2rem;">
                    <i class="bi bi-dash text-muted"></i> <span>Aún no hay producto seleccionado</span>
                </div>
            </div>

            <!-- Stock -->
            <div style="display: flex; justify-content: center;">
                <div class="tra-line-stock-placeholder" style="font-size: 0.8rem; color: #94a3b8; text-align: center;">
                    -
                </div>
                <div class="tra-line-stock" style="display:none; padding: 0.4rem 1rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; text-align: center; width: 100%; max-width: 140px;">
                    <strong class="tra-line-stock-qty" style="color: #166534; font-size: 1.05rem;">0</strong>
                </div>
            </div>

            <!-- Quantity -->
            <div style="display: flex; justify-content: center;">
                <input type="number" class="form-control tra-line-qty" placeholder="0" step="1" min="0" style="text-align: center; font-weight: bold; font-size: 1.1rem; border: 1px solid #cbd5e1; background: #fff; width: 100%; max-width: 120px; border-radius: 8px;">
            </div>

            <!-- Remove -->
            <div style="text-align: center;">
                <button type="button" class="btn btn-ghost tra-remove-line-btn" style="color: #ef4444; padding: 0.5rem 0.6rem; border-radius: 8px; background: #fef2f2; border: 1px solid #fee2e2;" title="Quitar línea">
                    <i class="bi bi-x-lg" style="font-size: 1rem;"></i>
                </button>
            </div>
        </div>
    `;

    linesContainer.appendChild(row);
    bindTransferLineRow(row, sourceBranchId, inventorySource, product);
}

function bindTransferLineRow(row, sourceBranchId, inventorySource, product = null) {
    const searchInput = row.querySelector('.tra-line-search');
    const hiddenInput = row.querySelector('.tra-line-product-id');
    const results = row.querySelector('.tra-line-results');
    const selectedLabel = row.querySelector('.tra-line-selected');
    const qtyInput = row.querySelector('.tra-line-qty');
    const stockInfoDiv = row.querySelector('.tra-line-stock');
    const stockQtySpan = row.querySelector('.tra-line-stock-qty');
    const removeButton = row.querySelector('.tra-remove-line-btn');
    let timer = null;
    let lastMatches = [];

    const paintStock = async (productId, isPesable) => {
        if (!stockInfoDiv || !stockQtySpan || !sourceBranchId) return;

        const inventoryMap = await resolveTransferInventoryMap(inventorySource);
        const inventoryItem = inventoryMap.get(Number(productId));
        const stock = Number(inventoryItem?.stock || 0);
        const weighted = inventoryItem?.esPesable ?? isPesable;

        stockQtySpan.textContent = formatTransferStockLabel(stock, weighted);
        stockInfoDiv.style.display = 'block';
        if (row.querySelector('.tra-line-stock-placeholder')) {
            row.querySelector('.tra-line-stock-placeholder').style.display = 'none';
        }

        const labelSpan = stockQtySpan.parentElement;
        if (stock <= 0) {
            stockInfoDiv.style.background = '#fef2f2';
            stockInfoDiv.style.borderColor = '#fca5a5';
            if (labelSpan) labelSpan.style.color = '#991b1b';
            return;
        }

        stockInfoDiv.style.background = '#f0fdf4';
        stockInfoDiv.style.borderColor = '#86efac';
        if (labelSpan) labelSpan.style.color = '#166534';
    };

    const selectProduct = (selectedProduct) => {
        if (!selectedProduct) return;

        const weighted = isWeightedAdminProduct(selectedProduct.esPesable);
        hiddenInput.value = selectedProduct.id_producto;
        searchInput.value = selectedProduct.codigoBarras || selectedProduct.nombreProducto || '';
        searchInput.dataset.pesable = weighted ? '1' : '0';
        selectedLabel.innerHTML = `<i class="bi bi-check-circle-fill text-success" style="font-size:1.1rem;"></i> <span style="color:#1e293b; font-weight:600;">${selectedProduct.nombreProducto || 'Producto'} <span style="color:#94a3b8; font-size:0.75rem; font-weight:normal; margin-left:0.4rem;">(${selectedProduct.codigoBarras || 'Sin codigo'})</span></span>`;
        results.innerHTML = '';
        lastMatches = [];
        updateProductQuantityStep(weighted, qtyInput);
        void paintStock(selectedProduct.id_producto, weighted);
        qtyInput?.focus?.();
    };

    const renderMatches = (products) => {
        lastMatches = Array.isArray(products) ? products : [];
        results.innerHTML = lastMatches.map((item) => `
            <button
                type="button"
                class="btn btn-ghost btn-sm"
                style="justify-content:flex-start; text-align:left; background: #ffffff; border-bottom: 1px solid #f1f5f9; padding: 0.75rem 1rem; width: 100%; border-radius: 0;"
            >
                <div style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${item.nombreProducto}</div>
                <div style="color:#64748b; font-size: 0.75rem; margin-top: 0.2rem;"><i class="bi bi-upc-scan"></i> ${item.codigoBarras || 'Sin codigo'}</div>
            </button>
        `).join('');

        Array.from(results.querySelectorAll('button')).forEach((button, index) => {
            button.addEventListener('click', () => {
                selectProduct(lastMatches[index]);
            });
        });
    };

    removeButton?.addEventListener('click', () => {
        const allRows = document.querySelectorAll('.tra-line-row');
        if (allRows.length === 1) {
            clearTransferLineRow(row);
            return;
        }
        row.remove();
    });

    searchInput?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const term = searchInput.value.trim();

            if (!term) {
                results.innerHTML = '';
                lastMatches = [];
                hiddenInput.value = '';
                searchInput.dataset.pesable = '0';
                selectedLabel.textContent = 'Sin producto seleccionado';
                if (stockInfoDiv) stockInfoDiv.style.display = 'none';
                return;
            }

            const catalog = await getAdminProductLookupCatalog();
            const exactMatch = findExactAdminProductMatch(term, catalog);
            if (exactMatch) {
                selectProduct(exactMatch);
                return;
            }

            renderMatches(searchAdminProductCatalog(term, catalog).slice(0, 12));
        }, 250);
    });

    searchInput?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();

        const term = searchInput.value.trim();
        if (!term) return;

        const catalog = await getAdminProductLookupCatalog();
        const match = findExactAdminProductMatch(term, catalog) || lastMatches[0] || searchAdminProductCatalog(term, catalog)[0];

        if (match) {
            selectProduct(match);
        }
    });

    if (product?.id_producto) {
        selectProduct(product);
    }
}

function clearTransferLineRow(row) {
    const searchInput = row.querySelector('.tra-line-search');
    const hiddenInput = row.querySelector('.tra-line-product-id');
    const results = row.querySelector('.tra-line-results');
    const selectedLabel = row.querySelector('.tra-line-selected');
    const qtyInput = row.querySelector('.tra-line-qty');
    const stockInfoDiv = row.querySelector('.tra-line-stock');

    if (searchInput) {
        searchInput.value = '';
        searchInput.dataset.pesable = '0';
    }
    if (hiddenInput) hiddenInput.value = '';
    if (results) results.innerHTML = '';
    if (selectedLabel) selectedLabel.textContent = 'Sin producto seleccionado';
    if (qtyInput) {
        qtyInput.value = '';
        updateProductQuantityStep(false, qtyInput);
    }
    if (stockInfoDiv) stockInfoDiv.style.display = 'none';
}

function updateProductQuantityStep(isPesable, input) {
    if (!input) return;
    input.step = isPesable ? '0.001' : '1';
    input.placeholder = isPesable ? '0.000' : '0';
}

function syncTransferDestinationOptions(branches, originId) {
    const destinationSelect = document.getElementById('tra-dest');
    const originNameLabel = document.getElementById('tra-origin-name');
    if (!destinationSelect) return;

    const availableDestinations = branches.filter((branch) => Number(branch.id_sucursal) !== originId);
    destinationSelect.innerHTML = availableDestinations.map((branch) =>
        `<option value="${branch.id_sucursal}">${branch.nombreSucursal}</option>`
    ).join('');

    const selectedOrigin = branches.find((branch) => Number(branch.id_sucursal) === originId);
    if (originNameLabel) {
        originNameLabel.textContent = selectedOrigin?.nombreSucursal || 'Sucursal origen';
    }
}

function appendInboundLineRow(product = null) {
    const linesContainer = document.getElementById('mov-lines');
    if (!linesContainer) return;

    adminInboundRowSequence += 1;
    const rowId = adminInboundRowSequence;
    const row = document.createElement('div');
    row.className = 'mov-line-row';
    row.dataset.rowId = String(rowId);
    row.style.cssText = 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem 1rem; transition: all 0.2s; display: flex; align-items: center;';
    row.classList.add('tra-line-row-hover');

    row.innerHTML = `
        <div style="display: grid; grid-template-columns: 2.5rem minmax(200px, 3fr) minmax(120px, 1fr) 3rem; gap: 1rem; align-items: center; width: 100%;">
            <!-- Index -->
            <div style="font-weight: 700; color: #94a3b8; font-size: 1.1rem; text-align: center; font-family: monospace;">
                ${rowId}
            </div>
            
            <!-- Search & Info -->
            <div style="position: relative;">
                <div style="position: relative;">
                    <i class="bi bi-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                    <input type="text" class="form-control mov-line-search" placeholder="Escribe para buscar un producto..." autocomplete="off" style="padding-left: 2.2rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem;">
                    <input type="hidden" class="mov-line-product-id">
                </div>
                <div class="mov-line-results" style="display:grid; gap:0.25rem; margin-top:0.4rem; position: absolute; z-index: 50; width: 100%; background: white; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto;"></div>
                <div class="mov-line-selected" style="margin-top:0.4rem; font-size:0.8rem; color:#64748b; font-weight:500; display:flex; align-items:center; gap:0.4rem; padding-left: 0.2rem;">
                    <i class="bi bi-dash text-muted"></i> <span>Aún no hay producto seleccionado</span>
                </div>
            </div>

            <!-- Quantity -->
            <div style="display: flex; justify-content: center;">
                <input type="number" class="form-control mov-line-qty" placeholder="0" step="1" min="0" style="text-align: center; font-weight: bold; font-size: 1.1rem; border: 1px solid #cbd5e1; background: #fff; width: 100%; max-width: 120px; border-radius: 8px;">
            </div>

            <!-- Remove -->
            <div style="text-align: center;">
                <button type="button" class="btn btn-ghost mov-remove-line-btn" style="color: #ef4444; padding: 0.5rem 0.6rem; border-radius: 8px; background: #fef2f2; border: 1px solid #fee2e2;" title="Quitar línea">
                    <i class="bi bi-x-lg" style="font-size: 1rem;"></i>
                </button>
            </div>
        </div>
    `;

    linesContainer.appendChild(row);
    bindInboundLineRow(row, product);
}

function bindInboundLineRow(row, product = null) {
    const searchInput = row.querySelector('.mov-line-search');
    const hiddenInput = row.querySelector('.mov-line-product-id');
    const results = row.querySelector('.mov-line-results');
    const selectedLabel = row.querySelector('.mov-line-selected');
    const qtyInput = row.querySelector('.mov-line-qty');
    const removeButton = row.querySelector('.mov-remove-line-btn');
    let timer = null;
    let lastMatches = [];

    const selectProduct = (selectedProduct) => {
        if (!selectedProduct) return;

        const weighted = isWeightedAdminProduct(selectedProduct.esPesable);
        hiddenInput.value = selectedProduct.id_producto;
        searchInput.value = selectedProduct.codigoBarras || selectedProduct.nombreProducto || '';
        searchInput.dataset.pesable = weighted ? '1' : '0';
        selectedLabel.innerHTML = `<i class="bi bi-check-circle-fill text-success" style="font-size:1.1rem;"></i> <span style="color:#1e293b; font-weight:600;">${selectedProduct.nombreProducto || 'Producto'} <span style="color:#94a3b8; font-size:0.75rem; font-weight:normal; margin-left:0.4rem;">(${selectedProduct.codigoBarras || 'Sin codigo'})</span></span>`;
        results.innerHTML = '';
        lastMatches = [];
        updateProductQuantityStep(weighted, qtyInput);
        qtyInput.focus();
    };

    const renderMatches = (products) => {
        lastMatches = Array.isArray(products) ? products : [];
        results.innerHTML = lastMatches.map((item) => `
            <button
                type="button"
                class="btn btn-ghost btn-sm"
                style="justify-content:flex-start; text-align:left; background: #ffffff; border-bottom: 1px solid #f1f5f9; padding: 0.75rem 1rem; width: 100%; border-radius: 0;"
            >
                <div style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${item.nombreProducto}</div>
                <div style="color:#64748b; font-size: 0.75rem; margin-top: 0.2rem;"><i class="bi bi-upc-scan"></i> ${item.codigoBarras || 'Sin codigo'}</div>
            </button>
        `).join('');

        Array.from(results.querySelectorAll('button')).forEach((button, index) => {
            button.addEventListener('click', () => {
                selectProduct(lastMatches[index]);
            });
        });
    };

    removeButton?.addEventListener('click', () => {
        const allRows = document.querySelectorAll('.mov-line-row');
        if (allRows.length === 1) {
            clearInboundLineRow(row);
            return;
        }
        row.remove();
    });

    searchInput?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const term = searchInput.value.trim();

            if (!term) {
                results.innerHTML = '';
                lastMatches = [];
                hiddenInput.value = '';
                searchInput.dataset.pesable = '0';
                selectedLabel.textContent = 'Sin producto seleccionado';
                return;
            }

            const catalog = await getAdminProductLookupCatalog();
            const exactMatch = findExactAdminProductMatch(term, catalog);
            if (exactMatch) {
                selectProduct(exactMatch);
                return;
            }

            renderMatches(searchAdminProductCatalog(term, catalog).slice(0, 12));
        }, 250);
    });

    searchInput?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();

        const term = searchInput.value.trim();
        if (!term) return;

        const catalog = await getAdminProductLookupCatalog();
        const match = findExactAdminProductMatch(term, catalog) || lastMatches[0] || searchAdminProductCatalog(term, catalog)[0];

        if (match) {
            selectProduct(match);
        }
    });

    if (product?.id_producto) {
        selectProduct(product);
    }
}

function clearInboundLineRow(row) {
    const searchInput = row.querySelector('.mov-line-search');
    const hiddenInput = row.querySelector('.mov-line-product-id');
    const results = row.querySelector('.mov-line-results');
    const selectedLabel = row.querySelector('.mov-line-selected');
    const qtyInput = row.querySelector('.mov-line-qty');

    if (searchInput) {
        searchInput.value = '';
        searchInput.dataset.pesable = '0';
    }
    if (hiddenInput) hiddenInput.value = '';
    if (results) results.innerHTML = '';
    if (selectedLabel) selectedLabel.textContent = 'Sin producto seleccionado';
    if (qtyInput) {
        qtyInput.value = '';
        updateProductQuantityStep(false, qtyInput);
    }
}
