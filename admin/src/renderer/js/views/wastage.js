let mermasState = {
    selectedBranchId: null,
    products: []
};

async function renderMermas() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    const activeBranchId = getActiveBranchId();
    const activeBranchName = getActiveBranchName();
    const bodegueroMode = isBodeguero() && activeBranchId;

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">Control de Mermas</h2>
                    <p class="text-gray-400 text-sm font-medium">${bodegueroMode ? `Registro operativo de perdidas para ${activeBranchName || 'tu sucursal'}.` : 'Gestión de pérdidas, roturas y auditoría de inventario crítico'}</p>
                </div>
                <div id="mermas-branch-container" class="w-full md:w-80 ${bodegueroMode ? 'hidden' : ''}">
                    <div class="relative group">
                        <i class="bi bi-shop absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                        <select id="mermas-branch-select" class="w-full pl-12 pr-10 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all appearance-none cursor-pointer" onchange="mermasCambiarSucursal(this.value)">
                            <option value="">Desconectado...</option>
                        </select>
                        <i class="bi bi-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"></i>
                    </div>
                </div>
            </div>

            <div id="mermas-empty-state" class="bg-white rounded-[3rem] border border-dashed border-gray-200 p-24 text-center">
                <div class="inline-flex h-20 w-20 items-center justify-center rounded-[2rem] bg-orange-50 text-orange-600 mb-6 text-3xl shadow-inner">
                    <i class="bi bi-geo-fill"></i>
                </div>
                <h3 class="text-xl font-black text-gray-900 uppercase tracking-tighter">Origen de Datos No Seleccionado</h3>
                <p class="text-gray-400 max-w-sm mx-auto mt-3 text-sm font-medium">${bodegueroMode ? 'Estamos preparando el inventario de tu sucursal para comenzar el registro de mermas.' : 'Seleccione una sucursal en el menú superior para cargar el inventario y comenzar el registro de mermas.'}</p>
            </div>

            <div id="mermas-main-area" class="hidden space-y-8">
                <!-- ALERTS PANEL -->
                <div id="mermas-alerts-panel" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Dinámico: Bajo Stock -->
                </div>

                <!-- SEARCH CARD -->
                <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 max-w-3xl">
                    <h4 class="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Buscador de Inventario</h4>
                    <div class="relative group">
                        <i class="bi bi-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors text-lg"></i>
                        <input type="text" id="mermas-search" class="w-full pl-14 pr-6 py-5 bg-gray-50/50 border border-gray-100 rounded-[1.5rem] text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all focus:ring-4 focus:ring-orange-50" placeholder="Escriba el nombre del producto o escanee código de barras..." oninput="mermasFiltrar()">
                    </div>
                </div>

                <!-- RESULTS TABLE -->
                <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch">
                    <div class="px-8 py-6 border-b border-gray-50 bg-gray-50/30">
                        <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Sugerencias de Ajuste</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead>
                                <tr class="border-b border-gray-50">
                                    <th class="px-8 py-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Identificación</th>
                                    <th class="px-8 py-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Existencia Actual</th>
                                    <th class="px-8 py-5 text-right text-[9px] font-black text-gray-300 uppercase tracking-widest">Operación</th>
                                </tr>
                            </thead>
                            <tbody id="mermas-list" class="divide-y divide-gray-50">
                                <tr><td colspan="3" class="px-8 py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest animate-pulse"><i class="bi bi-search text-3xl block mb-2"></i>Esperando parámetros de búsqueda...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    await mermasCargarSucursales();

    if (bodegueroMode) {
        mermasState.selectedBranchId = activeBranchId;
        await mermasCambiarSucursal(String(activeBranchId));
    }
}

async function mermasCargarSucursales() {
    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: '/sucursales', token });
        const assignedBranchId = getActiveBranchId();
        const branches = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        const availableBranches = isBodeguero() && assignedBranchId
            ? branches.filter((branch) => Number(branch.id_sucursal) === assignedBranchId)
            : branches;
        const select = document.getElementById('mermas-branch-select');
        if (select) {
            select.innerHTML = '<option value="">Seleccionar Sucursal...</option>' +
                availableBranches.map(b => `<option value="${b.id_sucursal}">${b.nombreSucursal}</option>`).join('');

            if (isBodeguero() && assignedBranchId) {
                select.value = String(assignedBranchId);
            }
        }
    } catch (_) {
        const select = document.getElementById('mermas-branch-select');
        if (select) select.innerHTML = '<option value="">Error de Conexión</option>';
    }
}

async function mermasCambiarSucursal(branchId) {
    const mainArea = document.getElementById('mermas-main-area');
    const emptyState = document.getElementById('mermas-empty-state');

    if (!branchId) {
        mainArea?.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        return;
    }

    mermasState.selectedBranchId = branchId;
    mainArea?.classList.remove('hidden');
    emptyState?.classList.add('hidden');

    const tbody = document.getElementById('mermas-list');
    tbody.innerHTML = '<tr><td colspan="3" class="px-8 py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Inventario...</td></tr>';

    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: `/productos/inventario?id_sucursal=${branchId}`, token });
        mermasState.products = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        mermasActualizarAlertas();
        mermasFiltrar();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="px-8 py-20 text-center text-red-400 font-black uppercase text-xs">Fallo en la sincronización: ${e.message}</td></tr>`;
    }
}

function mermasActualizarAlertas() {
    const alertsPanel = document.getElementById('mermas-alerts-panel');
    if (!alertsPanel) return;

    const threshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
    const criticalProducts = mermasState.products.filter(p => parseFloat(p.stockActual || p.cantidad || 0) <= threshold);

    if (criticalProducts.length === 0) {
        alertsPanel.innerHTML = `
            <div class="col-span-full bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 flex items-center gap-4">
                <div class="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                    <i class="bi bi-shield-check text-xl"></i>
                </div>
                <div>
                    <h5 class="text-emerald-900 font-black text-sm uppercase tracking-tight">Stock Saludable</h5>
                    <p class="text-emerald-600 text-[10px] font-bold">No se detectan productos bajo el umbral crítico de ${threshold} unidades.</p>
                </div>
            </div>
        `;
        return;
    }

    alertsPanel.innerHTML = `
        <div class="col-span-full md:col-span-1 bg-red-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-red-100 relative overflow-hidden">
            <div class="absolute -right-6 -bottom-6 h-32 w-32 bg-white/10 rounded-full blur-2xl"></div>
            <div class="relative z-10">
                <span class="text-[9px] font-black text-red-200 uppercase tracking-widest block mb-1">Alertas de Stock</span>
                <h4 class="text-3xl font-black mb-2 tracking-tighter">${criticalProducts.length}</h4>
                <p class="text-red-100 text-[10px] font-bold uppercase tracking-widest">Productos Críticos</p>
                <button class="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all" onclick="mermasVerAlertas()">Ver Listado</button>
            </div>
        </div>
        
        <div class="col-span-full md:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 flex flex-col justify-center">
             <div class="flex items-center gap-4">
                 <div class="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl">
                    <i class="bi bi-gear-fill"></i>
                 </div>
                 <div>
                    <h5 class="text-gray-900 font-black text-sm uppercase tracking-tight">Configuración de Alertas</h5>
                    <p class="text-gray-400 text-[10px] font-medium italic">Actualmente notificando bajo las ${threshold} unidades. Puede ajustar este valor en Configuración.</p>
                 </div>
             </div>
        </div>
    `;
}

function mermasVerAlertas() {
    const threshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
    const searchInput = document.getElementById('mermas-search');
    if (searchInput) {
        searchInput.value = ''; // Limpiar para ver todos los críticos si filtráramos por lógica de stock
        // Forzamos un filtrado especial para críticos en la tabla principal
        const tbody = document.getElementById('mermas-list');
        const critical = mermasState.products.filter(p => parseFloat(p.stockActual || p.cantidad || 0) <= threshold);
        mermasRenderList(critical);
    }
}

function mermasFiltrar() {
    const query = (document.getElementById('mermas-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('mermas-list');
    if (!tbody) return;

    if (!query) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-8 py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest opacity-50"><i class="bi bi-search text-3xl block mb-2"></i>Busca un producto para registrar mermas</td></tr>';
        return;
    }

    const filtered = mermasState.products.filter(p =>
        (p.nombreProducto || '').toLowerCase().includes(query) ||
        (p.codigoBarras || '').toLowerCase().includes(query)
    ).slice(0, 10);

    mermasRenderList(filtered);
}

function mermasRenderList(list) {
    const tbody = document.getElementById('mermas-list');
    if (!tbody) return;

    const threshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);

    tbody.innerHTML = list.length ? list.map(p => {
        const stock = parseFloat(p.stockActual || p.cantidad || 0);
        const isCritical = stock <= threshold;
        const formattedStock = p.esPesable ? stock.toFixed(3) : Math.round(stock).toString();

        return `
            <tr class="group hover:bg-gray-50/50 transition-colors">
                <td class="px-8 py-5">
                    <div class="flex items-center gap-4">
                        <div class="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                            <i class="bi bi-hash"></i>
                        </div>
                        <div>
                            <div class="font-black text-gray-900 text-sm tracking-tighter uppercase flex items-center gap-2">
                                ${p.nombreProducto}
                                ${isCritical ? `<span class="px-2 py-0.5 rounded-md bg-red-100 text-red-600 text-[8px] font-black tracking-widest">CRÍTICO</span>` : ''}
                            </div>
                            <div class="text-[10px] text-gray-400 font-bold tracking-widest opacity-60 uppercase">${p.codigoBarras || 'SIN CÓDIGO'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <div class="inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${isCritical ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}">
                        <span class="text-xs font-black tracking-tighter">${formattedStock}</span>
                        <span class="text-[9px] font-bold opacity-50 uppercase">${p.esPesable ? 'Kg' : 'un.'}</span>
                    </div>
                </td>
                <td class="px-8 py-5 text-right">
                    <button class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white hover:bg-black transition-all font-black text-[9px] uppercase tracking-widest ml-auto shadow-lg shadow-gray-200 active:scale-95" 
                            onclick="mermasAbrirAjuste(${p.id_producto})">
                        <i class="bi bi-dash-circle-fill"></i> Registrar Merma
                    </button>
                </td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="3" class="px-8 py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest leading-loose">No se encontraron productos coincidentes</td></tr>';
}

function mermasAbrirAjuste(productId) {
    const p = mermasState.products.find(x => x.id_producto === productId);
    if (!p) return;

    const currentQty = parseFloat(p.stockActual || p.cantidad || 0);
    const formattedCurrent = p.esPesable ? currentQty.toFixed(3) : Math.round(currentQty).toString();

    const content = `
        <div class="space-y-6 py-4">
            <div class="bg-gray-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl mb-8">
                 <div class="absolute -right-4 -bottom-4 h-24 w-24 bg-white/5 rounded-full blur-2xl"></div>
                 <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">VISTA DE AUDITORÍA</span>
                 <div class="text-xl font-black mb-3 uppercase tracking-tighter leading-tight">${p.nombreProducto}</div>
                 <div class="flex items-center gap-2">
                    <span class="bg-orange-600 text-white px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase shadow-lg shadow-orange-900/20">${formattedCurrent} ${p.esPesable ? 'Kg' : 'un.'} En Existencia</span>
                 </div>
            </div>
            
            <div class="grid grid-cols-1 gap-8">
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex justify-between">
                        CANTIDAD A RESTAR DEL INVENTARIO
                        <span id="merma-preview-remain" class="text-emerald-500 font-black">Restante: —</span>
                    </label>
                    <div class="relative group">
                        <i class="bi bi-dash-circle absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors text-xl"></i>
                        <input type="number" id="merma-lost-qty" class="w-full pl-16 pr-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] text-3xl font-black text-red-600 shadow-inner outline-none focus:border-red-200 transition-all" placeholder="0.00" step="${p.esPesable ? '0.001' : '1'}" min="0">
                        <span class="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400 uppercase tracking-widest">${p.esPesable ? 'Kg' : 'un.'}</span>
                    </div>
                    <div class="mt-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 border-dashed flex items-start gap-3">
                        <i class="bi bi-info-circle-fill text-orange-400 mt-0.5"></i>
                        <p class="text-[10px] font-bold text-orange-800 leading-relaxed uppercase tracking-tight">El valor ingresado se restará del total actual. Use este campo solo para declarar pérdidas físicas.</p>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">MOTIVO DEL AJUSTE NEGATIVO</label>
                    <div class="relative group">
                        <i class="bi bi-shield-exclamation absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                        <select id="merma-reason" class="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all appearance-none cursor-pointer">
                            <option value="MERMA_ROTURA">Rotura o Daño de Empaque/Producto</option>
                            <option value="MERMA_VENCIMIENTO">Producto Caducado / Vencimiento</option>
                            <option value="MERMA_ROBO">Robo, Hurto o Extravío Interno</option>
                            <option value="OTRO">Diferencia de Inventario (Conteo)</option>
                        </select>
                        <i class="bi bi-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('merma-lost-qty');
        const preview = document.getElementById('merma-preview-remain');
        if (input && preview) {
            input.addEventListener('input', () => {
                const val = parseFloat(input.value) || 0;
                const remain = currentQty - val;
                const formattedRemain = p.esPesable ? remain.toFixed(3) : Math.round(remain);
                preview.textContent = `Restante: ${formattedRemain} ${p.esPesable ? 'Kg' : 'un.'}`;
                preview.classList.toggle('text-red-500', remain < 0);
                preview.classList.toggle('text-emerald-500', remain >= 0);
            });
            input.focus();
        }
    }, 100);

    showModal('Declaración de Merma', content, async () => {
        const token = getAuthToken();
        const discount = parseFloat(document.getElementById('merma-lost-qty').value);

        if (isNaN(discount) || discount <= 0) {
            Swal.fire('Atención', 'Ingresa una cantidad válida mayor a cero para declarar la merma.', 'warning');
            return;
        }

        const nuevaCantidad = currentQty - discount;
        if (nuevaCantidad < 0) {
            const confirm = await Swal.fire({
                title: '¿Generar Stock Negativo?',
                text: `Usted está declarando una pérdida mayor al stock actual (${formattedCurrent}). ¿Desea resetear la existencia a 0?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#000',
                confirmButtonText: 'Sí, ajustar a 0',
                cancelButtonText: 'Corregir'
            });
            if (!confirm.isConfirmed) return;
        }

        const data = {
            id_producto: productId,
            id_sucursal: mermasState.selectedBranchId,
            nuevaCantidad: Math.max(0, nuevaCantidad),
            motivoAjuste: document.getElementById('merma-reason').value
        };

        const res = await apiRequest({
            endpoint: '/productos/inventario',
            method: 'PUT',
            body: data,
            token
        });

        if (res.ok) {
            Toast.fire({ icon: 'success', title: 'Registro de merma finalizado' });
            closeModal();
            mermasCambiarSucursal(mermasState.selectedBranchId);
        } else {
            Swal.fire('Error', res.data?.error || 'Fallo al procesar el ajuste', 'error');
        }
    });
}
