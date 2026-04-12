const ADMIN_BRANCH_INVENTORY_LIMIT = 15;
const adminBranchInventoryPagination = {
    page: 1,
    branchId: null,
    branchName: '',
    inventorySearch: '',
    branchSearch: ''
};

function formatBranchStock(item) {
    const quantity = Number(item?.stockActual ?? item?.cantidad ?? 0);
    return item?.esPesable
        ? `${quantity.toFixed(3)} Kg`
        : `${Math.round(quantity).toLocaleString('es-CL')} un.`;
}

async function renderBranches() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">Gestión de Sucursales</h2>
                    <p class="text-gray-400 text-sm font-medium">Control operativo y auditoría de inventario multi-sede</p>
                </div>
                <div class="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm">
                    <div>
                        <span class="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-0.5">Sedes Activas</span>
                        <span id="branches-total" class="text-xl font-black text-gray-900 leading-none">--</span>
                    </div>
                    <div class="h-8 w-[1px] bg-gray-100 mx-2"></div>
                    <div class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>
            </div>

            <!-- SEARCH BAR -->
            <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 max-w-2xl">
                <div class="relative group">
                    <i class="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors text-lg"></i>
                    <input type="text" id="branches-search-input" class="w-full pl-14 pr-6 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all focus:ring-4 focus:ring-orange-50" placeholder="Filtrar sucursales por nombre o ubicación...">
                </div>
            </div>

            <!-- CARDS CONTAINER -->
            <div id="branches-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="col-span-full py-20 text-center text-gray-400 uppercase text-[10px] font-black tracking-widest animate-pulse">
                    <i class="bi bi-broadcast text-4xl block mb-4"></i> Localizando Puntos de Venta...
                </div>
            </div>
        </div>
    `;

    try {
        const response = await apiRequest({ endpoint: '/sucursales', token });
        const container = document.getElementById('branches-container');
        const totalElement = document.getElementById('branches-total');
        if (!container) return;

        const branches = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        if (totalElement) totalElement.textContent = branches.length;
        window.allBranches = branches;

        if (!branches.length) {
            container.innerHTML = `<div class="col-span-full py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest"><i class="bi bi-shop text-4xl block mb-4"></i>No hay sucursales configuradas</div>`;
            return;
        }

        renderBranchCards();
        document.getElementById('branches-search-input')?.addEventListener('input', (e) => {
            adminBranchInventoryPagination.branchSearch = e.target.value.trim().toLowerCase();
            renderBranchCards();
        });
    } catch (e) {
        document.getElementById('branches-container').innerHTML = `<div class="col-span-full py-20 text-center text-red-400 font-black uppercase text-xs">Error de Sincronización: ${e.message}</div>`;
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
        container.innerHTML = `<div class="col-span-full py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest">Sin resultados para la búsqueda</div>`;
        return;
    }

    container.innerHTML = filtered.map(b => `
        <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all p-8 group relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl"></div>
            
            <div class="relative z-10 flex flex-col h-full">
                <div class="flex justify-between items-start mb-6">
                    <div class="h-14 w-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-inner border border-orange-100">
                        <i class="bi bi-building"></i>
                    </div>
                    <span class="px-3 py-1 rounded-full bg-gray-900 text-[9px] font-black text-white uppercase tracking-widest">SITE ID: ${b.id_sucursal}</span>
                </div>
                
                <h3 class="text-xl font-black text-gray-900 mb-2 leading-tight">${b.nombreSucursal}</h3>
                <div class="flex items-start gap-2 text-gray-400 mb-8 flex-grow">
                    <i class="bi bi-geo-alt-fill text-xs mt-0.5"></i>
                    <p class="text-xs font-medium leading-relaxed">${b.direccion || 'Ubicación no especificada en el sistema'}</p>
                </div>

                <div class="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
                    <div class="flex items-center gap-2">
                        <div class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span class="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">OPERATIVA</span>
                    </div>
                    <button class="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-50 text-gray-500 hover:bg-orange-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest group/btn shadow-inner" 
                            onclick="renderBranchInventory(${b.id_sucursal}, '${b.nombreSucursal.replace(/'/g, "\\'")}')">
                        <i class="bi bi-layers-fill text-sm"></i> Ver Inventario
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function renderBranchInventory(branchId, branchName, page = 1) {
    const contentArea = document.getElementById('content-area');
    adminBranchInventoryPagination.page = Math.max(1, page);
    adminBranchInventoryPagination.branchId = branchId;
    adminBranchInventoryPagination.branchName = branchName;
    adminBranchInventoryPagination.inventorySearch = '';

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex items-center gap-6">
                <button class="h-14 w-14 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-gray-900 hover:border-gray-200 transition-all shadow-sm active:scale-90" onclick="renderBranches()">
                    <i class="bi bi-arrow-left text-2xl"></i>
                </button>
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">${branchName}</h2>
                    <p class="text-gray-400 text-sm font-medium">Análisis detallado de stock y ajustes de inventario</p>
                </div>
            </div>

            <!-- TABLE CONTAINER -->
            <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch h-full flex flex-col">
                <div class="p-8 border-b border-gray-50 bg-gray-50/30 flex flex-wrap items-center gap-6 justify-between">
                    <div class="relative group max-w-md w-full">
                        <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                        <input type="text" id="branch-stock-search-input" class="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none transition-all" placeholder="Buscar producto en esta sede...">
                    </div>
                    <div id="branch-pagination-summary" class="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-4 py-1.5 rounded-full">--</div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-50">
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Producto</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Identificador</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Nivel de Stock</th>
                                <th class="px-8 py-5 text-right text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Gestión</th>
                            </tr>
                        </thead>
                        <tbody id="branch-stock-list" class="divide-y divide-gray-50">
                            <tr><td colspan="4" class="px-8 py-20 text-center text-gray-300 animate-pulse uppercase text-[10px] font-black">Consultando existencias...</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="px-8 py-6 bg-gray-50/50 flex items-center justify-end gap-3">
                    <button class="h-11 px-6 rounded-xl bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-orange-600 transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none" id="branch-prev-page">Anterior</button>
                    <button class="h-11 px-6 rounded-xl bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-orange-600 transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none" id="branch-next-page">Siguiente</button>
                </div>
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
        list.innerHTML = `<tr><td colspan="4" class="px-8 py-32 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest leading-loose">No hay productos que coincidan</td></tr>`;
        updateBranchInventoryPaginationUi(0);
        return;
    }

    const start = (adminBranchInventoryPagination.page - 1) * ADMIN_BRANCH_INVENTORY_LIMIT;
    const slice = filtered.slice(start, start + ADMIN_BRANCH_INVENTORY_LIMIT);

    list.innerHTML = slice.map(item => {
        const qty = Number(item.stockActual || item.cantidad || 0);
        const lowStock = qty <= 5;

        return `
            <tr class="group hover:bg-gray-50/50 transition-colors">
                <td class="px-8 py-4">
                    <div class="font-black text-gray-700 text-sm tracking-tight">${item.nombreProducto}</div>
                </td>
                <td class="px-8 py-4">
                    <span class="font-mono text-[10px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-lg uppercase">${item.codigoBarras || 'SIN CÓDIGO'}</span>
                </td>
                <td class="px-8 py-4">
                    <div class="inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${lowStock ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}">
                        <div class="h-1.5 w-1.5 rounded-full bg-current ${lowStock ? 'animate-pulse' : ''}"></div>
                        <span class="text-[10px] font-black uppercase tracking-tighter">${formatBranchStock(item)}</span>
                    </div>
                </td>
                <td class="px-8 py-4 text-right">
                    <button class="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-orange-600 hover:border-orange-100 hover:bg-white transition-all font-black text-[9px] uppercase tracking-widest ml-auto" 
                            onclick="openAdjustmentFormByProductId(${item.id_producto}, ${adminBranchInventoryPagination.branchId}, '${adminBranchInventoryPagination.branchName.replace(/'/g, "\\'")}')">
                        <i class="bi bi-sliders text-sm"></i> Ajustar Stock
                    </button>
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
        summary.textContent = total ? `PÁGINA ${page} DE ${totalPages} • ${total} ÍTEMS` : 'PÁGINA VACÍA';
    }

    document.getElementById('branch-prev-page').disabled = page <= 1;
    document.getElementById('branch-next-page').disabled = page >= totalPages;
}

function openAdjustmentFormByProductId(productId, branchId, branchName) {
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
            renderBranchInventory(branchId, branchName, adminBranchInventoryPagination.page);
        } else {
            Swal.fire('Error', res.data?.error || 'No se pudo actualizar', 'error');
        }
    });
}
