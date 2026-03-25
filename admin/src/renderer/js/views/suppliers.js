const ADMIN_SUPPLIER_LIMIT = 25;
const adminSupplierPagination = {
    page: 1
};
let adminExpandedSupplierId = null;

async function renderSuppliers() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar">
            <h2><span class="icon">🏢</span> Gestion de Proveedores</h2>
            <button class="btn btn-primary" onclick="openSupplierForm()">+ Nuevo Proveedor</button>
        </div>
        <div class="glass-panel mt-4">
            <div class="table-shell product-table-shell">
                <table class="data-table product-data-table">
                    <thead>
                        <tr>
                            <th>RUT</th>
                            <th>Proveedor</th>
                            <th>Contacto</th>
                            <th>Direccion</th>
                        </tr>
                    </thead>
                    <tbody id="suppliers-list">
                        <tr><td colspan="5">Cargando proveedores...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination-bar">
                <div class="pagination-summary" id="suppliers-pagination-summary">Preparando paginacion...</div>
                <div class="pagination-actions">
                    <button class="btn btn-ghost btn-sm" id="suppliers-prev-page">Anterior</button>
                    <button class="btn btn-ghost btn-sm" id="suppliers-next-page">Siguiente</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('suppliers-prev-page')?.addEventListener('click', () => {
        if (adminSupplierPagination.page <= 1) return;
        adminSupplierPagination.page -= 1;
        renderSupplierRows();
    });

    document.getElementById('suppliers-next-page')?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil((window.allSuppliers?.length || 0) / ADMIN_SUPPLIER_LIMIT));
        if (adminSupplierPagination.page >= totalPages) return;
        adminSupplierPagination.page += 1;
        renderSupplierRows();
    });

    try {
        const response = await apiRequest({
            endpoint: '/proveedores',
            method: 'GET',
            token
        });

        const list = document.getElementById('suppliers-list');
        if (!list) return;

        if (!response.ok) {
            list.innerHTML = `<tr><td colspan="5" class="text-error">Error: ${response.data?.error || response.error || 'No autorizado'}</td></tr>`;
            return;
        }

        window.allSuppliers = Array.isArray(response.data) ? response.data : [];
        adminSupplierPagination.page = 1;
        renderSupplierRows();
    } catch (error) {
        console.error(error);
        const list = document.getElementById('suppliers-list');
        if (list) {
            list.innerHTML = `<tr><td colspan="5" class="text-error">Error de conexion.</td></tr>`;
        }
    }
}

function renderSupplierRows() {
    const list = document.getElementById('suppliers-list');
    if (!list) return;

    const suppliers = Array.isArray(window.allSuppliers) ? window.allSuppliers : [];
    if (!suppliers.length) {
        list.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay proveedores registrados.</td></tr>`;
        updateSupplierPaginationUi(0);
        return;
    }

    const page = Math.max(1, adminSupplierPagination.page);
    const start = (page - 1) * ADMIN_SUPPLIER_LIMIT;
    const pagedSuppliers = suppliers.slice(start, start + ADMIN_SUPPLIER_LIMIT);

    list.innerHTML = pagedSuppliers.map((supplier) => {
        const isExpanded = adminExpandedSupplierId === supplier.id_proveedor;
        return `
            <tr class="product-row-compact product-row-clickable ${isExpanded ? 'is-expanded' : ''}"
                role="button" tabindex="0"
                aria-expanded="${isExpanded ? 'true' : 'false'}"
                onclick="toggleSupplierActions(${supplier.id_proveedor})"
                onkeydown="handleSupplierRowKeydown(event, ${supplier.id_proveedor})"
            >
                <td class="product-code-cell" data-label="RUT"><code>${supplier.rutProveedor || '-'}</code></td>
                <td class="product-name-cell" data-label="Proveedor">
                    <div class="product-name-stack">
                        <strong>${supplier.nombreProveedor}</strong>
                        <span class="product-row-hint">${isExpanded ? 'Ocultar opciones' : 'Toca para ver opciones'}</span>
                    </div>
                </td>
                <td class="product-supplier-cell" data-label="Contacto">
                    <div>${supplier.email || 'Sin email'}</div>
                    <div class="product-cost-line">${supplier.telefono || 'Sin telefono'}</div>
                </td>
                <td class="product-supplier-cell" data-label="Direccion">${supplier.direccion || 'Sin direccion'}</td>
            </tr>
            <tr class="product-action-row ${isExpanded ? 'is-expanded' : ''}">
                <td colspan="4" class="product-action-row-cell">
                    <div class="product-actions-panel">
                        <div class="product-actions-panel-copy">
                            <strong>Opciones para ${supplier.nombreProveedor}</strong>
                            <span>Selecciona una accion para ver, editar o eliminar este proveedor.</span>
                        </div>
                        <div class="product-actions-cell">
                            <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="previewSupplierById(${supplier.id_proveedor}, event)">Ver</button>
                            <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openSupplierFormById(${supplier.id_proveedor}, event)">Editar</button>
                            <button class="btn btn-ghost btn-sm text-error product-action-btn" type="button" onclick="deleteSupplier(${supplier.id_proveedor}, event)">Borrar</button>
                        </div>
                    </div>
                </td>    
            </tr>
        `;
    }).join('');

    updateSupplierPaginationUi(suppliers.length);
}

function toggleSupplierActions(supplierId) {
    adminExpandedSupplierId = adminExpandedSupplierId === supplierId ? null : supplierId;
    renderSupplierRows();
}

function handleSupplierRowKeydown(event, supplierId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleSupplierActions(supplierId);
}

function updateSupplierPaginationUi(totalItems) {
    const summary = document.getElementById('suppliers-pagination-summary');
    const prevButton = document.getElementById('suppliers-prev-page');
    const nextButton = document.getElementById('suppliers-next-page');
    const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_SUPPLIER_LIMIT));
    const page = Math.min(adminSupplierPagination.page, totalPages);
    adminSupplierPagination.page = page;
    const start = totalItems === 0 ? 0 : ((page - 1) * ADMIN_SUPPLIER_LIMIT) + 1;
    const end = Math.min(page * ADMIN_SUPPLIER_LIMIT, totalItems);

    if (summary) {
        summary.textContent = totalItems
            ? `Mostrando ${start}-${end} de ${totalItems} proveedor(es).`
            : 'Sin proveedores registrados.';
    }

    if (prevButton) prevButton.disabled = page <= 1;
    if (nextButton) nextButton.disabled = page >= totalPages || totalItems === 0;
}

function getSupplierById(id) {
    return (window.allSuppliers || []).find((supplier) => supplier.id_proveedor === id);
}

function previewSupplierById(id, event) {
    event?.stopPropagation?.();
    const supplier = getSupplierById(id);
    if (!supplier) return;

    Swal.fire({
        html: `
            <div class="product-preview-header">
                <div class="preview-icon">🏢</div>
                <div class="preview-title-stack">
                    <span class="preview-overline">Detalles del Proveedor</span>
                    <h3 class="preview-title">${supplier.nombreProveedor || 'Proveedor'}</h3>
                </div>
            </div>
            <div class="preview-card-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <div class="preview-info-card">
                    <span class="preview-label">RUT</span>
                    <strong class="preview-value">${supplier.rutProveedor || '-'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Telefono</span>
                    <strong class="preview-value">${supplier.telefono || 'Sin telefono'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Email</span>
                    <strong class="preview-value" style="word-break: break-all; font-size: 1.05rem;">${supplier.email || 'Sin email'}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Direccion</span>
                    <strong class="preview-value" style="font-size: 1.05rem;">${supplier.direccion || 'Sin direccion'}</strong>
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
        width: 720
    });
}

function openSupplierFormById(id, event) {
    event?.stopPropagation?.();
    const supplier = getSupplierById(id);
    if (!supplier) return;
    openSupplierForm(supplier);
}

function openSupplierForm(supplier = null) {
    const isEdit = !!supplier;
    const content = `
        <div class="form-group">
            <label>RUT del Proveedor</label>
            <input type="text" id="sup-rut" class="form-control" placeholder="12.345.678-9" value="${supplier?.rutProveedor || ''}">
        </div>
        <div class="form-group">
            <label>Nombre Comercial</label>
            <input type="text" id="sup-name" class="form-control" placeholder="Nombre de la empresa" value="${supplier?.nombreProveedor || ''}">
        </div>
        <div class="form-group">
            <label>Telefono</label>
            <input type="text" id="sup-phone" class="form-control" placeholder="+56 9 ..." value="${supplier?.telefono || ''}">
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="sup-email" class="form-control" placeholder="contacto@empresa.com" value="${supplier?.email || ''}">
        </div>
        <div class="form-group">
            <label>Direccion</label>
            <input type="text" id="sup-address" class="form-control" placeholder="Calle, Numero, Ciudad" value="${supplier?.direccion || ''}">
        </div>
    `;

    showModal(isEdit ? 'Editar Proveedor' : 'Crear Nuevo Proveedor', content, async () => {
        const data = {
            rutProveedor: document.getElementById('sup-rut').value,
            nombreProveedor: document.getElementById('sup-name').value,
            telefono: document.getElementById('sup-phone').value,
            email: document.getElementById('sup-email').value,
            direccion: document.getElementById('sup-address').value
        };

        if (!data.rutProveedor || !data.nombreProveedor) {
            Swal.fire('Error', 'RUT y Nombre son obligatorios', 'error');
            return;
        }

        const token = getAuthToken();
        const response = await apiRequest({
            endpoint: isEdit ? `/proveedores/${supplier.id_proveedor}` : '/proveedores',
            method: isEdit ? 'PUT' : 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: isEdit ? 'Proveedor actualizado' : 'Proveedor creado con exito' });
            closeModal();
            renderSuppliers();
        } else {
            Swal.fire('Error', response.data?.error || response.error || 'No se pudo procesar', 'error');
        }
    });
}

async function deleteSupplier(id, event) {
    event?.stopPropagation?.();
    const result = await Swal.fire({
        title: 'Estas seguro?',
        text: 'No podras revertir esto.',
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
        endpoint: `/proveedores/${id}`,
        method: 'DELETE',
        token
    });

    if (response.ok) {
        Toast.fire({ icon: 'success', title: 'Proveedor eliminado' });
        renderSuppliers();
    } else {
        Swal.fire('Error', response.data?.error || response.error || 'No se pudo eliminar', 'error');
    }
}
