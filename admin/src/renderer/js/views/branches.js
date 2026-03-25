const ADMIN_BRANCH_INVENTORY_LIMIT = 25;
const adminBranchInventoryPagination = {
    page: 1,
    branchId: null,
    branchName: ''
};

function formatBranchStock(item) {
    const quantity = Number(item?.cantidad || 0);
    return item?.esPesable
        ? `${quantity.toFixed(3)} Kg`
        : `${Math.round(quantity).toLocaleString('es-CL')} unidades`;
}

async function renderBranches() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar">
            <h2><span class="icon">📍</span> Gestion de Sucursales</h2>
        </div>
        <div class="branch-overview-grid">
            <div class="glass-panel branch-hero-card">
                <span class="settings-overline">Red de sucursales</span>
                <h3>Controla inventario por punto de venta.</h3>
                <p>Revisa rapido cada sede, abre su inventario y ajusta stock sin salir del mismo modulo.</p>
            </div>
            <div class="glass-panel branch-metric-card">
                <span class="settings-overline">Resumen</span>
                <strong id="branches-total">--</strong>
                <p class="text-muted">Sucursales activas disponibles para operacion.</p>
            </div>
        </div>
        <div id="branches-container" class="branch-card-grid mt-4">
            <div class="loader">Cargando sucursales...</div>
        </div>
    `;

    try {
        const response = await apiRequest({
            endpoint: '/sucursales',
            method: 'GET',
            token
        });

        const container = document.getElementById('branches-container');
        const totalElement = document.getElementById('branches-total');
        if (!container) return;

        if (!response.ok) {
            container.innerHTML = `<p class="text-error">Error: ${response.data?.error || response.error || 'Error'}</p>`;
            if (totalElement) totalElement.textContent = '--';
            return;
        }

        const branches = Array.isArray(response.data) ? response.data : [];
        if (totalElement) totalElement.textContent = branches.length.toLocaleString('es-CL');

        if (!branches.length) {
            container.innerHTML = `<div class="glass-panel branch-empty-state">No hay sucursales registradas.</div>`;
            return;
        }

        container.innerHTML = branches.map((branch) => `
            <article class="glass-panel branch-card-v2">
                <div class="branch-card-top">
                    <div>
                        <span class="settings-overline">Sucursal</span>
                        <h3>${branch.nombreSucursal}</h3>
                    </div>
                    <span class="badge badge-info branch-id-badge">ID ${branch.id_sucursal}</span>
                </div>
                <p class="branch-address">${branch.direccion || 'Sin direccion registrada'}</p>
                <div class="branch-card-footer">
                    <span class="branch-status-pill">Operativa</span>
                    <button class="btn btn-primary btn-sm" onclick="renderBranchInventory(${branch.id_sucursal}, '${String(branch.nombreSucursal).replace(/'/g, "\\'")}')">
                        Ver inventario
                    </button>
                </div>
            </article>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

async function renderBranchInventory(branchId, branchName, page = 1) {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();
    adminBranchInventoryPagination.page = Math.max(1, page);
    adminBranchInventoryPagination.branchId = branchId;
    adminBranchInventoryPagination.branchName = branchName;

    contentArea.innerHTML = `
        <div class="action-bar">
            <div class="branch-inventory-header">
                <button class="btn btn-ghost btn-sm" onclick="renderBranches()">Volver</button>
                <div>
                    <h2><span class="icon">📦</span> Inventario: ${branchName}</h2>
                    <p class="text-muted branch-inventory-caption">Detalle completo del stock disponible en esta sucursal.</p>
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-ghost" onclick="renderBranchInventory(${branchId}, '${String(branchName).replace(/'/g, "\\'")}')">Actualizar</button>
            </div>
        </div>
        <div class="glass-panel mt-4">
            <div class="table-shell product-table-shell">
                <table class="data-table product-data-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Codigo</th>
                            <th>Stock actual</th>
                            <th style="text-align: right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="branch-stock-list">
                        <tr><td colspan="4">Cargando inventario...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination-bar">
                <div class="pagination-summary" id="branch-pagination-summary">Preparando paginacion...</div>
                <div class="pagination-actions">
                    <button class="btn btn-ghost btn-sm" id="branch-prev-page">Anterior</button>
                    <button class="btn btn-ghost btn-sm" id="branch-next-page">Siguiente</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('branch-prev-page')?.addEventListener('click', () => {
        if (adminBranchInventoryPagination.page <= 1) return;
        adminBranchInventoryPagination.page -= 1;
        renderBranchInventoryRows();
    });

    document.getElementById('branch-next-page')?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil((window.currentBranchStock?.length || 0) / ADMIN_BRANCH_INVENTORY_LIMIT));
        if (adminBranchInventoryPagination.page >= totalPages) return;
        adminBranchInventoryPagination.page += 1;
        renderBranchInventoryRows();
    });

    try {
        const response = await apiRequest({
            endpoint: `/productos/inventario?id_sucursal=${branchId}`,
            method: 'GET',
            token
        });

        const list = document.getElementById('branch-stock-list');
        if (!list) return;

        if (!response.ok) {
            list.innerHTML = `<tr><td colspan="4" class="text-error">Error: ${response.data?.error || response.error || 'Error'}</td></tr>`;
            return;
        }

        const stock = Array.isArray(response.data) ? response.data : [];
        window.currentBranchStock = stock;
        renderBranchInventoryRows();
    } catch (error) {
        console.error(error);
    }
}

function renderBranchInventoryRows() {
    const list = document.getElementById('branch-stock-list');
    if (!list) return;

    const stock = Array.isArray(window.currentBranchStock) ? window.currentBranchStock : [];
    if (!stock.length) {
        list.innerHTML = `<tr><td colspan="4" style="text-align: center">No hay productos con stock en esta sucursal</td></tr>`;
        updateBranchInventoryPaginationUi(0);
        return;
    }

    const page = Math.max(1, adminBranchInventoryPagination.page);
    const start = (page - 1) * ADMIN_BRANCH_INVENTORY_LIMIT;
    const pagedStock = stock.slice(start, start + ADMIN_BRANCH_INVENTORY_LIMIT);

    list.innerHTML = pagedStock.map((item) => `
        <tr class="product-row-compact">
            <td class="product-name-cell">
                <strong>${item.nombreProducto}</strong>
                ${item.esPesable ? '<span class="badge badge-warning product-inline-badge">Pesable</span>' : ''}
            </td>
            <td class="product-code-cell"><code>${item.codigoBarras}</code></td>
            <td class="product-prices-cell">
                <div class="product-price-line">${formatBranchStock(item)}</div>
                <div class="product-cost-line">${item.esPesable ? 'Control por peso' : 'Control por unidad'}</div>
            </td>
            <td class="product-actions-column">
                <div class="product-actions-cell">
                    <button class="btn btn-primary btn-sm product-action-btn" onclick="openAdjustmentFormByProductId(${item.id_producto}, ${adminBranchInventoryPagination.branchId}, '${String(adminBranchInventoryPagination.branchName).replace(/'/g, "\\'")}')">Ajustar</button>
                </div>
            </td>
        </tr>
    `).join('');

    updateBranchInventoryPaginationUi(stock.length);
}

function updateBranchInventoryPaginationUi(totalItems) {
    const summary = document.getElementById('branch-pagination-summary');
    const prevButton = document.getElementById('branch-prev-page');
    const nextButton = document.getElementById('branch-next-page');
    const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_BRANCH_INVENTORY_LIMIT));
    const page = Math.min(adminBranchInventoryPagination.page, totalPages);
    adminBranchInventoryPagination.page = page;
    const start = totalItems === 0 ? 0 : ((page - 1) * ADMIN_BRANCH_INVENTORY_LIMIT) + 1;
    const end = Math.min(page * ADMIN_BRANCH_INVENTORY_LIMIT, totalItems);

    if (summary) {
        summary.textContent = totalItems
            ? `Mostrando ${start}-${end} de ${totalItems} producto(s) en esta sucursal.`
            : 'Sin productos en esta sucursal.';
    }

    if (prevButton) prevButton.disabled = page <= 1;
    if (nextButton) nextButton.disabled = page >= totalPages || totalItems === 0;
}

function openAdjustmentFormByProductId(productId, branchId, branchName) {
    const item = (window.currentBranchStock || []).find((stockItem) => stockItem.id_producto === productId);
    if (!item) return;
    openAdjustmentForm(item, branchId, branchName);
}

function openAdjustmentForm(item, branchId, branchName) {
    const content = `
        <div class="adjustment-modal-shell">
            <div class="adjustment-summary-card">
                <div class="adjustment-summary-copy">
                    <span class="settings-overline">Producto seleccionado</span>
                    <h4>${item.nombreProducto}</h4>
                    <p>${item.codigoBarras || 'Sin codigo'} • ${item.esPesable ? 'Control por peso' : 'Control por unidades'}</p>
                </div>
                <span class="badge ${item.esPesable ? 'badge-warning' : 'badge-info'}">${formatBranchStock(item)}</span>
            </div>
            <div class="adjustment-form-grid">
                <div class="form-group">
                    <label>Producto</label>
                    <input type="text" class="form-control" value="${item.nombreProducto}" disabled>
                </div>
                <div class="form-group">
                    <label>Stock Actual</label>
                    <input type="text" class="form-control" value="${formatBranchStock(item)}" disabled>
                </div>
                <div class="form-group">
                    <label>Nueva Cantidad Fisica</label>
                    <input type="number" id="adj-qty" class="form-control" value="${item.esPesable ? item.cantidad : Math.round(item.cantidad)}" step="${item.esPesable ? '0.001' : '1'}">
                </div>
                <div class="form-group">
                    <label>Motivo del Ajuste</label>
                    <select id="adj-reason" class="form-control">
                        <option value="INVENTARIO_MANUAL">Correccion de Inventario</option>
                        <option value="MERMA_DANO">Merma por Dano</option>
                        <option value="MERMA_VENCIMIENTO">Vencimiento</option>
                        <option value="SOBRANTE">Sobrante encontrado</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    showModal('Ajuste Manual de Stock', content, async () => {
        const token = getAuthToken();
        const data = {
            id_producto: item.id_producto,
            id_sucursal: branchId,
            nuevaCantidad: parseFloat(document.getElementById('adj-qty').value),
            motivoAjuste: document.getElementById('adj-reason').value
        };

        if (Number.isNaN(data.nuevaCantidad) || data.nuevaCantidad < 0) {
            Swal.fire('Error', 'Cantidad invalida', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: '/productos/inventario',
            method: 'PUT',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: 'Stock ajustado correctamente' });
            closeModal();
            renderBranchInventory(branchId, branchName, adminBranchInventoryPagination.page);
        } else {
            Swal.fire('Error', response.data?.error || response.error || 'Error', 'error');
        }
    });
}
