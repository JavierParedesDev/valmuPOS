const ADMIN_BRANCH_INVENTORY_LIMIT = 15;
const adminBranchInventoryPagination = {
    page: 1,
    branchId: null,
    branchName: '',
    inventorySearch: '',
    branchSearch: '',
    isBodegueroView: false
};

function formatBranchStock(item) {
    const quantity = Number(item?.stockActual ?? item?.cantidad ?? 0);
    return item?.esPesable
        ? `${quantity.toFixed(3)} Kg`
        : `${Math.round(quantity).toLocaleString('es-CL')} un.`;
}

async function renderBranches() {
    if (isBodeguero()) {
        await renderAssignedBranchInventory();
        return;
    }

    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Gestión de Sucursales</h2>
            <button class="btn btn-primary" onclick="/* nueva sucursal - pendiente */">+ Nueva Sucursal</button>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="table-shell">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="w-16">ID</th>
                            <th>Nombre</th>
                            <th>Dirección</th>
                            <th>Estado</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="branches-container">
                        <tr><td colspan="5" class="text-center py-4 text-gray-500 italic">Cargando sucursales...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const response = await apiRequest({ endpoint: '/sucursales', token });
        const container = document.getElementById('branches-container');
        const totalElement = document.getElementById('branches-total');
        if (!container) return;

        const branches = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        window.allBranches = branches;

        if (!branches.length) {
            container.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400">No hay sucursales configuradas</td></tr>`;
            return;
        }

        renderBranchCards();
    } catch (e) {
        document.getElementById('branches-container').innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500 font-medium">Error al cargar datos: ${e.message}</td></tr>`;
    }
}

async function renderAssignedBranchInventory() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const assignedBranchId = getActiveBranchId();
    const assignedBranchName = getActiveBranchName();

    if (!assignedBranchId) {
        contentArea.innerHTML = `
            <div class="glass-panel">
                <h2>Mi sucursal</h2>
                <p class="text-muted">Tu usuario no tiene una sucursal asignada. Pidele al administrador que configure ese dato para habilitar esta vista.</p>
            </div>
        `;
        return;
    }

    if (assignedBranchName) {
        await renderBranchInventory(assignedBranchId, assignedBranchName, 1, { isBodegueroView: true });
        return;
    }

    try {
        const token = getAuthToken();
        const response = await apiRequest({ endpoint: '/sucursales', token });
        const branches = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        const assignedBranch = branches.find((branch) => Number(branch.id_sucursal) === assignedBranchId);
        await renderBranchInventory(assignedBranchId, assignedBranch?.nombreSucursal || 'Sucursal asignada', 1, { isBodegueroView: true });
    } catch (_error) {
        await renderBranchInventory(assignedBranchId, 'Sucursal asignada', 1, { isBodegueroView: true });
    }
}

function renderBranchCards() {
    const container = document.getElementById('branches-container');
    if (!container) return;

    const branches = window.allBranches || [];
    const search = adminBranchInventoryPagination.branchSearch;
    const filtered = branches.filter(b =>
        b.nombreSucursal.toLowerCase().includes(search) ||
        (b.direccion || '').toLowerCase().includes(search)
    );

    if (!filtered.length) {
        container.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400">Sin resultados para la búsqueda</td></tr>`;
        return;
    }

    container.innerHTML = filtered.map(b => {
        const statusText = (b.operativa === false) ? 'INACTIVA' : 'OPERATIVA';
        const statusClass = (b.operativa === false) ? 'badge-danger' : 'badge-success';

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td><code class="text-gray-400">#${b.id_sucursal}</code></td>
                <td class="font-bold text-gray-900">${b.nombreSucursal}</td>
                <td class="text-gray-600">${b.direccion || 'Sin dirección'}</td>
                <td><span class="badge ${statusClass} uppercase text-[10px] font-bold">${statusText}</span></td>
                <td style="text-align: right;">
                    <div class="flex justify-end gap-2">
                        <button class="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors" 
                                onclick="renderBranchInventory(${b.id_sucursal}, '${b.nombreSucursal.replace(/'/g, "\\'")}')" title="Ver Inventario">
                            <i class="bi bi-layers-fill"></i>
                        </button>
                        <button class="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors" 
                                onclick="/* editar sucursal - pendiente */" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function renderBranchInventory(branchId, branchName, page = 1, options = {}) {
    const contentArea = document.getElementById('content-area');
    const isBodegueroView = Boolean(options?.isBodegueroView);
    adminBranchInventoryPagination.page = Math.max(1, page);
    adminBranchInventoryPagination.branchId = branchId;
    adminBranchInventoryPagination.branchName = branchName;
    adminBranchInventoryPagination.inventorySearch = '';
    adminBranchInventoryPagination.isBodegueroView = isBodegueroView;

    contentArea.innerHTML = `
        <div class="action-bar mb-6">
            <div class="flex items-center gap-4">
                <button class="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors ${isBodegueroView ? 'hidden' : ''}" onclick="renderBranches()">
                    <i class="bi bi-arrow-left text-lg"></i>
                </button>
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">${branchName}</h2>
                    <p class="text-gray-500 text-sm">Inventario de la sucursal</p>
                </div>
            </div>
            <div id="branch-pagination-summary" class="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">--</div>
        </div>

        <div class="mb-4">
            <input type="text" id="branch-stock-search-input" class="form-control max-w-md" placeholder="Buscar producto por nombre o código...">
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="table-shell">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Código</th>
                            <th>Stock</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="branch-stock-list">
                        <tr><td colspan="4" class="text-center py-4 text-gray-500 italic">Cargando inventario...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="px-4 py-3 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
                <button class="btn btn-ghost text-xs" id="branch-prev-page">Anterior</button>
                <button class="btn btn-ghost text-xs" id="branch-next-page">Siguiente</button>
            </div>
        </div>
    `;

    document.getElementById('branch-prev-page')?.addEventListener('click', () => {
        if (adminBranchInventoryPagination.page > 1) {
            adminBranchInventoryPagination.page--;
            renderBranchInventoryRows();
        }
    });

    document.getElementById('branch-next-page')?.addEventListener('click', () => {
        const total = getFilteredBranchStock().length;
        if (adminBranchInventoryPagination.page < Math.ceil(total / ADMIN_BRANCH_INVENTORY_LIMIT)) {
            adminBranchInventoryPagination.page++;
            renderBranchInventoryRows();
        }
    });

    document.getElementById('branch-stock-search-input')?.addEventListener('input', (e) => {
        adminBranchInventoryPagination.inventorySearch = e.target.value.toLowerCase();
        adminBranchInventoryPagination.page = 1;
        renderBranchInventoryRows();
    });

    try {
        const token = getAuthToken();
        const response = await apiRequest({ endpoint: `/productos/inventario?id_sucursal=${branchId}`, token });
        window.currentBranchStock = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        renderBranchInventoryRows();
    } catch (e) {
        document.getElementById('branch-stock-list').innerHTML = `<tr><td colspan="4" class="text-center py-20 text-red-500 font-black uppercase text-xs">Error de Sincronización: ${e.message}</td></tr>`;
    }
}

function renderBranchInventoryRows() {
    const list = document.getElementById('branch-stock-list');
    if (!list) return;

    const filtered = getFilteredBranchStock();
    const total = filtered.length;

    if (!total) {
        list.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-gray-400">No hay productos que coincidan</td></tr>`;
        updateBranchInventoryPaginationUi(0);
        return;
    }

    const start = (adminBranchInventoryPagination.page - 1) * ADMIN_BRANCH_INVENTORY_LIMIT;
    const slice = filtered.slice(start, start + ADMIN_BRANCH_INVENTORY_LIMIT);

    list.innerHTML = slice.map(item => {
        const qty = Number(item.stockActual || item.cantidad || 0);
        const lowStockThreshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
        const lowStock = qty <= lowStockThreshold;
        const stockClass = lowStock ? 'badge-danger' : 'badge-success';

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="font-bold text-gray-900">${item.nombreProducto}</td>
                <td><code class="text-gray-400">${item.codigoBarras || 'SIN CÓDIGO'}</code></td>
                <td><span class="badge ${stockClass} text-[10px] font-bold">${formatBranchStock(item)}</span></td>
                <td style="text-align: right;">
                    <div class="flex justify-end gap-2">
                        <button class="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors" 
                                onclick="openAdjustmentFormByProductId(${item.id_producto}, ${adminBranchInventoryPagination.branchId}, '${adminBranchInventoryPagination.branchName.replace(/'/g, "\\'")}', ${adminBranchInventoryPagination.isBodegueroView})" title="Ajustar Stock">
                            <i class="bi bi-sliders"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateBranchInventoryPaginationUi(total);
}

function getFilteredBranchStock() {
    const stock = window.currentBranchStock || [];
    const search = adminBranchInventoryPagination.inventorySearch;
    return search ? stock.filter(i =>
        i.nombreProducto.toLowerCase().includes(search) ||
        (i.codigoBarras || '').toLowerCase().includes(search)
    ) : stock;
}

function updateBranchInventoryPaginationUi(total) {
    const summary = document.getElementById('branch-pagination-summary');
    const totalPages = Math.max(1, Math.ceil(total / ADMIN_BRANCH_INVENTORY_LIMIT));
    const page = adminBranchInventoryPagination.page;

    if (summary) {
        summary.textContent = total ? `Página ${page} de ${totalPages} • ${total} productos` : 'Sin resultados';
    }

    document.getElementById('branch-prev-page').disabled = page <= 1;
    document.getElementById('branch-next-page').disabled = page >= totalPages;
}

function openAdjustmentFormByProductId(productId, branchId, branchName, stayInAssignedBranchView = false) {
    const item = (window.currentBranchStock || []).find(i => i.id_producto === productId);
    if (!item) return;

    const currentQty = Number(item.stockActual || item.cantidad || 0);

    const content = `
        <div class="space-y-6 py-4">
            <div class="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100 mb-8">
                 <div class="absolute -right-4 -bottom-4 h-24 w-24 bg-white/10 rounded-full blur-2xl"></div>
                 <span class="text-[9px] font-black text-indigo-200 uppercase tracking-widest block mb-1">MÓDULO DE AJUSTE</span>
                 <div class="text-xl font-black mb-1 uppercase tracking-tighter">${item.nombreProducto}</div>
                 <div class="text-indigo-100 text-xs font-medium">Existencia actual: <span class="font-black text-white ml-1">${formatBranchStock(item)}</span></div>
            </div>
            
            <div class="grid grid-cols-1 gap-6">
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">NUEVA CANTIDAD FÍSICA EN ESTANTE</label>
                    <div class="relative group">
                        <i class="bi bi-box-seam absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                        <input type="number" id="adj-qty" class="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-black shadow-sm focus:border-orange-200 outline-none transition-all" value="${item.esPesable ? currentQty : Math.round(currentQty)}" step="${item.esPesable ? '0.001' : '1'}">
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium mt-3 italic leading-relaxed">Nota: Esta acción sobrescribirá el stock actual por el valor ingresado. Úselo tras auditorías de conteo.</p>
                </div>
                
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">JUSTIFICACIÓN DEL AJUSTE</label>
                    <div class="relative group">
                        <i class="bi bi-chat-left-text absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                        <select id="adj-reason" class="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all appearance-none cursor-pointer">
                            <option value="INVENTARIO_MANUAL">Corrección de Inventario (Conteo)</option>
                            <option value="MERMA_DANO">Merma por Daño o Rotura</option>
                            <option value="MERMA_VENCIMIENTO">Vencimiento de Producto</option>
                            <option value="SOBRANTE">Sobrante encontrado</option>
                        </select>
                        <i class="bi bi-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                    </div>
                </div>
            </div>
        </div>
    `;

    showModal('Ajuste Maestro de Existencia', content, async () => {
        const token = getAuthToken();
        const nuevaCantidad = parseFloat(document.getElementById('adj-qty').value);

        if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
            Swal.fire('Error', 'Cantidad inválida', 'warning');
            return;
        }

        const data = {
            id_producto: item.id_producto,
            id_sucursal: branchId,
            nuevaCantidad: nuevaCantidad,
            motivoAjuste: document.getElementById('adj-reason').value
        };

        const res = await apiRequest({
            endpoint: '/productos/inventario',
            method: 'PUT',
            body: data,
            token
        });

        if (res.ok) {
            Toast.fire({ icon: 'success', title: 'Stock actualizado' });
            closeModal();
            renderBranchInventory(branchId, branchName, adminBranchInventoryPagination.page, { isBodegueroView: stayInAssignedBranchView });
        } else {
            Swal.fire('Error', res.data?.error || 'No se pudo actualizar', 'error');
        }
    });
}
