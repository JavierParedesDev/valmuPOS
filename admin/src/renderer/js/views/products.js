const ADMIN_PRODUCT_LIMIT = 25;
let adminProductSearchTimer = null;
let adminProductRequestId = 0;
let adminProductsCache = [];
let adminExpandedProductId = null;
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

async function renderProducts() {
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
                        <span>Selecciona una accion para ver, editar o eliminar este producto.</span>
                    </div>
                    <div class="product-actions-cell">
                        <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="previewProductByIndex(${index}, event)">Ver</button>
                        <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openProductFormByIndex(${index}, event)">Editar</button>
                        <button class="btn btn-ghost btn-sm text-error product-action-btn" type="button" onclick="deleteProduct(${product.id_producto}, event)">Borrar</button>
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

    const [catRes, supRes] = await Promise.all([
        apiRequest({ endpoint: '/categorias', token }),
        apiRequest({ endpoint: '/proveedores', token })
    ]);

    const categories = catRes.ok ? catRes.data : [];
    const suppliers = supRes.ok ? supRes.data : [];

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

async function openStockInboundForm() {
    const token = getAuthToken();
    const branchRes = await apiRequest({ endpoint: '/sucursales', token });
    const branches = branchRes.ok ? branchRes.data : [];

    const content = `
        <div class="form-group">
            <label>Buscar Producto</label>
            <input type="text" id="mov-product-search" class="form-control" placeholder="Escribe nombre o codigo">
            <input type="hidden" id="mov-product-id">
        </div>
        <div id="mov-product-results" style="display:grid; gap:0.5rem; margin-bottom:1rem;"></div>
        <div id="mov-product-selected" class="text-muted" style="margin-bottom:1rem;">Sin producto seleccionado</div>
        <div class="form-group">
            <label>Sucursal de Destino</label>
            <select id="mov-branch" class="form-control">
                ${branches.map((b) => `<option value="${b.id_sucursal}">${b.nombreSucursal}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Cantidad a Ingresar</label>
            <input type="number" id="mov-qty" class="form-control" placeholder="0" step="1">
        </div>
        <div class="form-group">
            <label>Numero de Factura / Guia</label>
            <input type="text" id="mov-invoice" class="form-control" placeholder="Ej: FAC-1234">
        </div>
    `;

    showModal('Ingreso de Mercaderia (Compras)', content, async () => {
        const selectedId = parseInt(document.getElementById('mov-product-id').value, 10);
        const data = {
            id_producto: selectedId,
            id_sucursal: parseInt(document.getElementById('mov-branch').value, 10),
            cantidadIngreso: parseFloat(document.getElementById('mov-qty').value),
            numeroFactura: document.getElementById('mov-invoice').value
        };

        if (isNaN(data.id_producto)) {
            Swal.fire('Error', 'Debes seleccionar un producto', 'error');
            return;
        }

        if (isNaN(data.cantidadIngreso) || data.cantidadIngreso <= 0) {
            Swal.fire('Error', 'Cantidad invalida', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: '/productos/ingreso',
            method: 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: 'Ingreso registrado con exito' });
            closeModal();
            loadAdminProductTable(document.getElementById('products-search')?.value || '', adminProductPagination.page);
        } else {
            showMovementError(response.data?.error || response.error || 'Error');
        }
    });

    initAdminProductPicker({
        searchInputId: 'mov-product-search',
        resultsId: 'mov-product-results',
        hiddenId: 'mov-product-id',
        selectedLabelId: 'mov-product-selected',
        quantityInputId: 'mov-qty'
    });
}

async function openTransferForm() {
    const token = getAuthToken();
    const branchRes = await apiRequest({ endpoint: '/sucursales', token });
    const branches = branchRes.ok ? branchRes.data : [];

    const content = `
        <div class="form-group">
            <label>Buscar Producto a Trasladar</label>
            <input type="text" id="tra-product-search" class="form-control" placeholder="Escribe nombre o codigo">
            <input type="hidden" id="tra-product-id">
        </div>
        <div id="tra-product-results" style="display:grid; gap:0.5rem; margin-bottom:1rem;"></div>
        <div id="tra-product-selected" class="text-muted" style="margin-bottom:1rem;">Sin producto seleccionado</div>
        <div class="form-group">
            <label>Sucursal de Destino</label>
            <select id="tra-dest" class="form-control">
                ${branches.map((b) => `<option value="${b.id_sucursal}">${b.nombreSucursal}</option>`).join('')}
            </select>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            * El origen sera tu sucursal actual asignada.
        </p>
        <div class="form-group">
            <label>Cantidad a Trasladar</label>
            <input type="number" id="tra-qty" class="form-control" placeholder="0" step="1">
        </div>
    `;

    showModal('Traslado entre Sucursales', content, async () => {
        const data = {
            id_producto: parseInt(document.getElementById('tra-product-id').value, 10),
            id_sucursalDestino: parseInt(document.getElementById('tra-dest').value, 10),
            cantidadMov: parseFloat(document.getElementById('tra-qty').value)
        };

        if (isNaN(data.id_producto) || isNaN(data.id_sucursalDestino)) {
            Swal.fire('Error', 'Debe seleccionar un producto y una sucursal de destino', 'error');
            return;
        }

        if (isNaN(data.cantidadMov) || data.cantidadMov <= 0) {
            Swal.fire('Error', 'Cantidad invalida', 'error');
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

    initAdminProductPicker({
        searchInputId: 'tra-product-search',
        resultsId: 'tra-product-results',
        hiddenId: 'tra-product-id',
        selectedLabelId: 'tra-product-selected',
        quantityInputId: 'tra-qty'
    });
}

function initAdminProductPicker({ searchInputId, resultsId, hiddenId, selectedLabelId, quantityInputId }) {
    const searchInput = document.getElementById(searchInputId);
    const results = document.getElementById(resultsId);
    const hiddenInput = document.getElementById(hiddenId);
    const selectedLabel = document.getElementById(selectedLabelId);
    const qtyInput = document.getElementById(quantityInputId);

    let timer = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const term = searchInput.value.trim();

            if (!term) {
                results.innerHTML = '';
                hiddenInput.value = '';
                selectedLabel.textContent = 'Sin producto seleccionado';
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
