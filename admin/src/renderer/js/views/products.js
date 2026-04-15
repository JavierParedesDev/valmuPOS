const ADMIN_PRODUCT_LIMIT = 25;
const ADMIN_PRODUCT_FORM_REFERENCE_LIMIT = 500;
let adminProductSearchTimer = null;
let adminProductRequestId = 0;
let adminProductsCache = [];
let adminExpandedProductId = null;
let adminInboundRowSequence = 0;
const adminProductPagination = {
    page: 1,
    hasMore: false,
    lastTerm: ''
};

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
                <button class="btn btn-ghost" onclick="openStockInboundForm()">📥 Ingreso</button>
                <button class="btn btn-ghost" onclick="openTransferForm()">🔄 Traslado</button>
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
                <button class="btn btn-primary" onclick="openStockInboundForm()">📥 Registrar ingreso</button>
                <button class="btn btn-ghost" onclick="openTransferForm()">🔄 Trasladar stock</button>
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

function openProductFormByIndex(index, event) {
    event?.stopPropagation?.();
    const product = window.allProducts[index];
    openProductForm(product);
}

function openStockInboundFormByIndex(index, event) {
    event?.stopPropagation?.();
    const product = window.allProducts[index];
    openStockInboundForm(product);
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
        loadAdminProductTable(document.getElementById('products-search')?.value || '', adminProductPagination.page);
    } else {
        Swal.fire('Error', response.data?.error || response.error || 'No se pudo eliminar', 'error');
    }
}

async function openStockInboundForm(initialProduct = null) {
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

    const selectedBranchId = activeBranchId || Number(branches[0]?.id_sucursal) || null;
    const selectedBranchName = activeBranchName || branches.find((branch) => Number(branch.id_sucursal) === Number(selectedBranchId))?.nombreSucursal || branches[0]?.nombreSucursal || 'Sucursal seleccionada';

    const content = `
        <div class="form-group">
            <label>Sucursal Activa</label>
            <input type="text" class="form-control" value="${selectedBranchName}" disabled>
        </div>
        <div class="form-group">
            <label>Numero de Factura / Guia</label>
            <input type="text" id="mov-invoice" class="form-control" placeholder="Ej: FAC-1234">
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:1rem;">
            <div>
                <strong style="display:block; color:var(--text-main);">Detalle de productos</strong>
                <span class="text-muted" style="font-size:0.82rem;">Agrega varias lineas para registrar una factura completa.</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="mov-add-line-btn">+ Agregar producto</button>
        </div>
        <div id="mov-lines" style="display:grid; gap:0.9rem; max-height:50vh; overflow:auto; padding-right:0.25rem;"></div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 1rem;">
            El ingreso se acumula por producto y se registra en <strong>${selectedBranchName}</strong>.
        </p>
    `;

    showModal('Ingreso de Mercaderia (Compras)', content, async () => {
        const targetBranchId = Number(selectedBranchId);
        const invoiceNumber = document.getElementById('mov-invoice').value.trim();
        const lineRows = Array.from(document.querySelectorAll('.mov-line-row'));

        if (Number.isNaN(targetBranchId)) {
            Swal.fire('Error', 'Debes seleccionar una sucursal valida.', 'error');
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
            return;
        }

        const invalidLine = parsedLines.find((line) => Number.isNaN(line.productId) || Number.isNaN(line.quantity) || line.quantity <= 0);
        if (invalidLine) {
            Swal.fire('Error', 'Todas las lineas deben tener producto y cantidad valida.', 'error');
            return;
        }

        const aggregatedLines = Array.from(parsedLines.reduce((map, line) => {
            const current = map.get(line.productId) || { ...line, quantity: 0 };
            current.quantity += line.quantity;
            map.set(line.productId, current);
            return map;
        }, new Map()).values());

        for (const line of aggregatedLines) {
            const response = await apiRequest({
                endpoint: '/productos/ingreso',
                method: 'POST',
                body: {
                    id_producto: line.productId,
                    id_sucursal: targetBranchId,
                    cantidadIngreso: line.quantity,
                    numeroFactura: invoiceNumber
                },
                token
            });

            if (!response.ok) {
                showMovementError(`${line.productName}: ${response.data?.error || response.error || 'Error'}`);
                return;
            }
        }

        Toast.fire({ icon: 'success', title: `Ingreso registrado con ${aggregatedLines.length} producto(s)` });
        closeModal();
        loadAdminProductTable(document.getElementById('products-search')?.value || '', adminProductPagination.page);
    });

    document.getElementById('modal-save-btn').textContent = 'Registrar ingreso';
    document.getElementById('mov-add-line-btn')?.addEventListener('click', () => {
        appendInboundLineRow();
    });

    appendInboundLineRow(initialProduct);
    if (!initialProduct) {
        appendInboundLineRow();
    }
}

async function openTransferForm() {
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

    const content = `
        <div class="form-group">
            <label>Sucursal de Origen</label>
            <input type="text" class="form-control" value="${defaultSourceName}" disabled>
        </div>
        <div class="form-group">
            <label>Buscar Producto a Trasladar</label>
            <input type="text" id="tra-product-search" class="form-control" placeholder="Escribe nombre o codigo">
            <input type="hidden" id="tra-product-id">
        </div>
        <div id="tra-product-results" style="display:grid; gap:0.5rem; margin-bottom:1rem;"></div>
        <div id="tra-product-selected" class="text-muted" style="margin-bottom:0.5rem;">Sin producto seleccionado</div>
        <div id="tra-stock-info" style="display:none; margin-bottom:1rem; padding:0.75rem; background:#f0fdf4; border:1px solid #86efac; border-radius:0.5rem;">
            <span style="font-size:0.85rem; color:#166534;">
                <i class="bi bi-box-seam"></i> Stock disponible: <strong id="tra-stock-qty">0</strong>
            </span>
        </div>
        <div class="form-group">
            <label>Sucursal de Destino</label>
            <select id="tra-dest" class="form-control"></select>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            El traslado mueve stock de <strong id="tra-origin-name">${defaultSourceName}</strong> hacia otra sucursal.
        </p>
        <div class="form-group">
            <label>Cantidad a Trasladar</label>
            <input type="number" id="tra-qty" class="form-control" placeholder="0" step="1">
        </div>
    `;

    showModal('Traslado entre Sucursales', content, async () => {
        const data = {
            id_producto: parseInt(document.getElementById('tra-product-id').value, 10),
            id_sucursalOrigen: Number(defaultSourceId),
            id_sucursalDestino: parseInt(document.getElementById('tra-dest').value, 10),
            cantidadMov: parseFloat(document.getElementById('tra-qty').value)
        };

        if (isNaN(data.id_producto) || isNaN(data.id_sucursalOrigen) || isNaN(data.id_sucursalDestino)) {
            Swal.fire('Error', 'Debes seleccionar producto, sucursal origen y sucursal destino.', 'error');
            return;
        }

        if (isNaN(data.cantidadMov) || data.cantidadMov <= 0) {
            Swal.fire('Error', 'Cantidad invalida', 'error');
            return;
        }

        if (data.id_sucursalOrigen === data.id_sucursalDestino) {
            Swal.fire('Error', 'La sucursal de origen y destino deben ser distintas.', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: '/productos/traslado',
            method: 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: 'Traslado realizado con exito' });
            closeModal();
            loadAdminProductTable(document.getElementById('products-search')?.value || '', adminProductPagination.page);
        } else {
            showMovementError(response.data?.error || response.error || 'Error');
        }
    });

    document.getElementById('modal-save-btn').textContent = 'Registrar traslado';
    syncTransferDestinationOptions(branches, Number(defaultSourceId));

    initAdminProductPicker({
        searchInputId: 'tra-product-search',
        resultsId: 'tra-product-results',
        hiddenId: 'tra-product-id',
        selectedLabelId: 'tra-product-selected',
        quantityInputId: 'tra-qty',
        stockInfoId: 'tra-stock-info',
        stockQtyId: 'tra-stock-qty',
        sourceBranchId: Number(defaultSourceId)
    });
}

function initAdminProductPicker({ searchInputId, resultsId, hiddenId, selectedLabelId, quantityInputId, stockInfoId, stockQtyId, sourceBranchId }) {
    const searchInput = document.getElementById(searchInputId);
    const results = document.getElementById(resultsId);
    const hiddenInput = document.getElementById(hiddenId);
    const selectedLabel = document.getElementById(selectedLabelId);
    const qtyInput = document.getElementById(quantityInputId);
    const stockInfoDiv = stockInfoId ? document.getElementById(stockInfoId) : null;
    const stockQtySpan = stockQtyId ? document.getElementById(stockQtyId) : null;

    let timer = null;

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
            const esPesable = item?.esPesable;
            
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

    searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const term = searchInput.value.trim();

            if (!term) {
                results.innerHTML = '';
                hiddenInput.value = '';
                selectedLabel.textContent = 'Sin producto seleccionado';
                if (stockInfoDiv) stockInfoDiv.style.display = 'none';
                return;
            }

            const response = await fetchAdminProducts(term, 12, 1);
            const products = response.ok && Array.isArray(response.data) ? response.data : [];

            results.innerHTML = products.map((product) => `
                <button
                    type="button"
                    class="btn btn-ghost"
                    data-id="${product.id_producto}"
                    data-name="${product.nombreProducto}"
                    data-code="${product.codigoBarras}"
                    data-pesable="${product.esPesable ? '1' : '0'}"
                    style="justify-content:flex-start; text-align:left;"
                >
                    <strong>${product.nombreProducto}</strong> <span style="margin-left:0.5rem; color:var(--text-muted);">${product.codigoBarras}</span>
                </button>
            `).join('');

            Array.from(results.querySelectorAll('button')).forEach((button) => {
                button.addEventListener('click', () => {
                    hiddenInput.value = button.dataset.id;
                    selectedLabel.textContent = `${button.dataset.name} (${button.dataset.code})`;
                    searchInput.value = button.dataset.name;
                    results.innerHTML = '';
                    updateProductQuantityStep(button.dataset.pesable === '1', qtyInput);
                    
                    // Obtener y mostrar stock disponible
                    fetchProductStock(button.dataset.id);
                });
            });
        }, 300);
    });
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
    row.style.cssText = 'border:1px solid var(--line-soft); border-radius:16px; padding:1rem; background:rgba(255,255,255,0.75);';
    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:0.85rem;">
            <strong style="color:var(--text-main);">Producto ${rowId}</strong>
            <button type="button" class="btn btn-ghost btn-sm mov-remove-line-btn">Quitar</button>
        </div>
        <div class="form-group" style="margin-bottom:0.8rem;">
            <label>Buscar producto</label>
            <input type="text" class="form-control mov-line-search" placeholder="Escribe nombre o codigo" autocomplete="off">
            <input type="hidden" class="mov-line-product-id">
        </div>
        <div class="mov-line-results" style="display:grid; gap:0.45rem; margin-bottom:0.8rem;"></div>
        <div class="text-muted mov-line-selected" style="margin-bottom:0.8rem;">Sin producto seleccionado</div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Cantidad a ingresar</label>
            <input type="number" class="form-control mov-line-qty" placeholder="0" step="1" min="0">
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
                hiddenInput.value = '';
                searchInput.dataset.pesable = '0';
                selectedLabel.textContent = 'Sin producto seleccionado';
                return;
            }

            const response = await fetchAdminProducts(term, 12, 1);
            const products = response.ok && Array.isArray(response.data) ? response.data : [];

            results.innerHTML = products.map((item) => `
                <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    data-id="${item.id_producto}"
                    data-name="${item.nombreProducto}"
                    data-code="${item.codigoBarras || ''}"
                    data-pesable="${item.esPesable ? '1' : '0'}"
                    style="justify-content:flex-start; text-align:left;"
                >
                    <strong>${item.nombreProducto}</strong>
                    <span style="margin-left:0.5rem; color:var(--text-muted);">${item.codigoBarras || 'Sin codigo'}</span>
                </button>
            `).join('');

            Array.from(results.querySelectorAll('button')).forEach((button) => {
                button.addEventListener('click', () => {
                    hiddenInput.value = button.dataset.id;
                    searchInput.value = button.dataset.name;
                    searchInput.dataset.pesable = button.dataset.pesable;
                    selectedLabel.textContent = `${button.dataset.name} (${button.dataset.code || 'Sin codigo'})`;
                    results.innerHTML = '';
                    updateProductQuantityStep(button.dataset.pesable === '1', qtyInput);
                    qtyInput.focus();
                });
            });
        }, 250);
    });

    if (product?.id_producto) {
        hiddenInput.value = product.id_producto;
        searchInput.value = product.nombreProducto || '';
        searchInput.dataset.pesable = product.esPesable ? '1' : '0';
        selectedLabel.textContent = `${product.nombreProducto || 'Producto'} (${product.codigoBarras || 'Sin codigo'})`;
        updateProductQuantityStep(Boolean(product.esPesable), qtyInput);
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
