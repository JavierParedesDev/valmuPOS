const ADMIN_PRODUCT_LIMIT = 50;
let adminProductSearchTimer = null;
let adminProductRequestId = 0;
let adminProductsCache = [];

function buildAdminProductEndpoint(term = '', limit = ADMIN_PRODUCT_LIMIT) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));

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

function parseAdminIntegerInput(elementId, fallback = 0) {
    const rawValue = document.getElementById(elementId)?.value ?? '';
    if (rawValue === '') return fallback;

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return fallback;

    return Math.round(numericValue);
}

async function fetchAdminProducts(term = '', limit = ADMIN_PRODUCT_LIMIT) {
    const token = getAuthToken();
    return apiRequest({
        endpoint: buildAdminProductEndpoint(term, limit),
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
                Se cargan resultados por busqueda y un maximo de ${ADMIN_PRODUCT_LIMIT} registros por consulta.
            </p>
            <div id="products-search-status" class="text-muted" style="margin-top: 0.35rem; font-size: 0.8rem;"></div>
        </div>
        <div class="glass-panel mt-4">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Precios</th>
                        <th>Proveedor</th>
                        <th style="text-align: right">Acciones</th>
                    </tr>
                </thead>
                <tbody id="products-list">
                    <tr><td colspan="6">Cargando productos...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    const searchInput = document.getElementById('products-search');
    const clearButton = document.getElementById('products-search-clear');

    searchInput.addEventListener('input', () => {
        renderAdminProductRows(filterAdminProductsLocally(searchInput.value));
        clearTimeout(adminProductSearchTimer);
        adminProductSearchTimer = setTimeout(() => {
            loadAdminProductTable(searchInput.value);
        }, 350);
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        loadAdminProductTable('');
    });

    await loadAdminProductTable('');
}

async function loadAdminProductTable(term = '') {
    const list = document.getElementById('products-list');
    const status = document.getElementById('products-search-status');
    if (!list) return;

    const currentRequestId = ++adminProductRequestId;

    if (!adminProductsCache.length) {
        list.innerHTML = `<tr><td colspan="6">Cargando productos...</td></tr>`;
    }

    if (status) {
        status.textContent = term.trim()
            ? `Buscando "${term.trim()}"...`
            : `Mostrando hasta ${ADMIN_PRODUCT_LIMIT} productos.`;
    }

    try {
        const response = await fetchAdminProducts(term, ADMIN_PRODUCT_LIMIT);
        if (currentRequestId !== adminProductRequestId) return;

        if (!response.ok) {
            list.innerHTML = `<tr><td colspan="6" class="text-error">Error: ${response.data?.error || response.error || 'No autorizado'}</td></tr>`;
            return;
        }

        adminProductsCache = Array.isArray(response.data) ? response.data.slice() : [];
        renderAdminProductRows(filterAdminProductsLocally(term, adminProductsCache));

        if (status) {
            status.textContent = term.trim()
                ? `${filterAdminProductsLocally(term, adminProductsCache).length} resultado(s) para "${term.trim()}".`
                : `Mostrando ${adminProductsCache.length} producto(s).`;
        }
    } catch (error) {
        console.error(error);
        list.innerHTML = `<tr><td colspan="6" class="text-error">Error de conexión.</td></tr>`;
    }
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
            product.nombreProveedor
        ]
            .filter(Boolean)
            .map(normalizeAdminSearchValue)
            .join(' ');

        return tokens.every((token) => haystack.includes(token));
    });
}

function renderAdminProductRows(products) {
    const list = document.getElementById('products-list');
    if (!list) return;

    window.allProducts = products;

    if (!products.length) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center;">No se encontraron productos.</td></tr>`;
        return;
    }

    list.innerHTML = products.map((product, index) => `
        <tr>
            <td><code>${product.codigoBarras}</code></td>
            <td>
                <strong>${product.nombreProducto}</strong>
                ${product.esPesable ? '<span class="badge badge-warning" style="font-size: 0.65rem; margin-left: 0.5rem">Pesable</span>' : ''}
            </td>
            <td><span class="badge badge-info">${product.nombreCategoria || 'Sin Cat.'}</span></td>
            <td>
                <div style="font-size: 0.8rem">Venta: <strong>$${formatAdminCurrency(product.precioDetalle)}</strong></div>
                <div style="font-size: 0.75rem; color: var(--text-muted)">Costo: $${formatAdminCurrency(product.precioCosto)}</div>
            </td>
            <td><span style="font-size: 0.85rem">${product.nombreProveedor || '-'}</span></td>
            <td style="text-align: right">
                <button class="btn btn-ghost btn-sm" onclick="openProductFormByIndex(${index})">✏️</button>
                <button class="btn btn-ghost btn-sm text-error" onclick="deleteProduct(${product.id_producto})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function showMovementError(message) {
    const normalizedMessage = String(message || 'No se pudo completar la operación').toLowerCase();
    const looksLikeStockError = normalizedMessage.includes('stock') || normalizedMessage.includes('insuf') || normalizedMessage.includes('existenc');

    if (looksLikeStockError) {
        Toast.fire({ icon: 'error', title: message || 'No hay stock suficiente' });
        return;
    }

    Swal.fire('Error', message || 'No se pudo completar la operación', 'error');
}

function openProductFormByIndex(index) {
    const product = window.allProducts[index];
    openProductForm(product);
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
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group" style="grid-column: span 2">
                <label>Nombre del Producto</label>
                <input type="text" id="p-name" class="form-control" value="${product?.nombreProducto || ''}" placeholder="Ej: Aceite Maravilla 1L">
            </div>
            <div class="form-group">
                <label>Código de Barras</label>
                <input type="text" id="p-code" class="form-control" value="${product?.codigoBarras || ''}" placeholder="780...">
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem;">
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
                <label>Categoría</label>
                <select id="p-category" class="form-control">
                    <option value="">Seleccionar Categoría</option>
                    ${categories.map(c => `<option value="${c.id_categoria}" ${product?.id_categoria === c.id_categoria ? 'selected' : ''}>${c.nombreCategoria}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Proveedor</label>
                <select id="p-supplier" class="form-control">
                    <option value="">Seleccionar Proveedor</option>
                    ${suppliers.map(s => `<option value="${s.id_proveedor}" ${product?.id_proveedor === s.id_proveedor ? 'selected' : ''}>${s.nombreProveedor}</option>`).join('')}
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
            id_categoria: document.getElementById('p-category').value ? parseInt(document.getElementById('p-category').value, 10) : null,
            id_proveedor: document.getElementById('p-supplier').value ? parseInt(document.getElementById('p-supplier').value, 10) : null,
            esPesable: document.getElementById('p-pesable').checked
        };

        if (!data.nombreProducto || !data.codigoBarras) {
            Swal.fire('Error', 'Nombre y Código son obligatorios', 'error');
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
            loadAdminProductTable(document.getElementById('products-search')?.value || '');
        } else {
            Swal.fire('Error', response.data?.error || response.error || 'No se pudo procesar', 'error');
        }
    });
}

async function deleteProduct(id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: '¡No podrás revertir esto!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff8a43',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
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
        loadAdminProductTable(document.getElementById('products-search')?.value || '');
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
            <input type="text" id="mov-product-search" class="form-control" placeholder="Escribe nombre o código">
            <input type="hidden" id="mov-product-id">
        </div>
        <div id="mov-product-results" style="display:grid; gap:0.5rem; margin-bottom:1rem;"></div>
        <div id="mov-product-selected" class="text-muted" style="margin-bottom:1rem;">Sin producto seleccionado</div>
        <div class="form-group">
            <label>Sucursal de Destino</label>
            <select id="mov-branch" class="form-control">
                ${branches.map(b => `<option value="${b.id_sucursal}">${b.nombreSucursal}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Cantidad a Ingresar</label>
            <input type="number" id="mov-qty" class="form-control" placeholder="0" step="1">
        </div>
        <div class="form-group">
            <label>Número de Factura / Guía</label>
            <input type="text" id="mov-invoice" class="form-control" placeholder="Ej: FAC-1234">
        </div>
    `;

    showModal('Ingreso de Mercadería (Compras)', content, async () => {
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
            Swal.fire('Error', 'Cantidad inválida', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: '/productos/ingreso',
            method: 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: 'Ingreso registrado con éxito' });
            closeModal();
            loadAdminProductTable(document.getElementById('products-search')?.value || '');
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
            <input type="text" id="tra-product-search" class="form-control" placeholder="Escribe nombre o código">
            <input type="hidden" id="tra-product-id">
        </div>
        <div id="tra-product-results" style="display:grid; gap:0.5rem; margin-bottom:1rem;"></div>
        <div id="tra-product-selected" class="text-muted" style="margin-bottom:1rem;">Sin producto seleccionado</div>
        <div class="form-group">
            <label>Sucursal de Destino</label>
            <select id="tra-dest" class="form-control">
                ${branches.map(b => `<option value="${b.id_sucursal}">${b.nombreSucursal}</option>`).join('')}
            </select>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            * El origen será tu sucursal actual asignada.
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
            Swal.fire('Error', 'Cantidad inválida', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: '/productos/traslado',
            method: 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: 'Traslado realizado con éxito' });
            closeModal();
            loadAdminProductTable(document.getElementById('products-search')?.value || '');
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

            const response = await fetchAdminProducts(term, 12);
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
