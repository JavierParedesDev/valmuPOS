async function renderLogistics() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">Centro de Logística</h2>
                    <p class="text-gray-400 text-sm font-medium">Control de flotas, rutas de entrega y liquidación de recaudación</p>
                </div>
                <button class="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-orange-600 hover:border-orange-100 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm" onclick="renderLogistics()">
                    <i class="bi bi-arrow-clockwise text-lg"></i> Actualizar Flujo
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 sticky-container">
                <!-- MAIN: DISPATCH HISTORY -->
                <div class="lg:col-span-8 space-y-6">
                    <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
                        <div class="px-8 py-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                            <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Monitoreo de Envíos</h3>
                            <div class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>
                        
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-gray-50">
                                        <th class="px-8 py-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Referencia</th>
                                        <th class="px-8 py-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Importe</th>
                                        <th class="px-8 py-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Transportista</th>
                                        <th class="px-8 py-5 text-[9px] font-black text-gray-300 uppercase tracking-widest">Despachado</th>
                                        <th class="px-8 py-5 text-right text-[9px] font-black text-gray-300 uppercase tracking-widest">Acción / Estado</th>
                                    </tr>
                                </thead>
                                <tbody id="log-despachos-list" class="divide-y divide-gray-50">
                                    <tr><td colspan="5" class="px-8 py-20 text-center text-gray-300 animate-pulse uppercase text-[10px] font-black items-center"><i class="bi bi-truck-flatbed text-3xl block mb-2"></i>Sincronizando rutas...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- SIDE: CARRIERS -->
                <div class="lg:col-span-4 space-y-6">
                    <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch h-full flex flex-col">
                        <div class="px-8 py-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                            <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Flota Activa</h3>
                            <button class="h-9 px-4 rounded-xl bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center gap-2" onclick="logisticsOpenAddCarrier()">
                                <i class="bi bi-plus-lg"></i> AGREGAR
                            </button>
                        </div>
                        <div id="log-transportes-list" class="p-8 space-y-4 max-h-[600px] overflow-y-auto">
                            <div class="text-center py-10 opacity-20">
                                <i class="bi bi-person-badge text-4xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- INFO BOX -->
                    <div class="bg-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-100 relative overflow-hidden">
                        <div class="absolute -right-10 -bottom-10 h-40 w-40 bg-white/10 rounded-full blur-3xl"></div>
                        <h4 class="text-lg font-black mb-2 uppercase tracking-tighter leading-tight relative z-10">Cierre de Ruta</h4>
                        <p class="text-orange-100 text-[11px] font-medium leading-relaxed relative z-10">El estado <b>FINALIZADO</b> confirma que el transportista entregó la recaudación y liquidó el despacho.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    void logisticsLoadData();
}

async function logisticsLoadData() {
    const token = getAuthToken();

    try {
        const despRes = await apiRequest({ endpoint: '/despachos', token });
        const despachos = Array.isArray(despRes) ? despRes : (Array.isArray(despRes?.data) ? despRes.data : []);

        const tbody = document.getElementById('log-despachos-list');
        if (tbody) {
            tbody.innerHTML = despachos.length ? despachos.map(d => {
                const status = (d.estado || d.estadoDespacho || '').trim().toUpperCase();
                const isEntregado = status === 'ENTREGADO' || status === 'FINALIZADO';
                const isEnRuta = status === 'EN_RUTA';
                const totalMonto = Number(d.total || 0).toLocaleString('es-CL');
                const idDespacho = d.id || d.id_despacho;

                return `
                    <tr class="group hover:bg-gray-50/50 transition-colors">
                        <td class="px-8 py-5">
                            <div class="flex items-center gap-3">
                                <div class="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                    <i class="bi bi-hash"></i>
                                </div>
                                <span class="font-black text-gray-900 text-sm tracking-tighter">${d.venta || '#' + idDespacho}</span>
                            </div>
                        </td>
                        <td class="px-8 py-5 font-black text-gray-700">$${totalMonto}</td>
                        <td class="px-8 py-5">
                            <div class="flex flex-col">
                                <span class="text-xs font-black text-gray-800 tracking-tight">${d.transporte || d.nombreTransporte || 'PARTICULAR'}</span>
                                <span class="text-[9px] text-orange-600 font-black uppercase tracking-widest opacity-60">${d.patenteTransporte || '—'}</span>
                            </div>
                        </td>
                        <td class="px-8 py-5">
                            <div class="text-[10px] font-bold text-gray-400">
                                ${d.fecha ? new Date(d.fecha).toLocaleDateString('es-CL') : 'PENDIENTE'}<br>
                                <span class="text-[9px] font-medium opacity-50">${d.fecha ? new Date(d.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>
                        </td>
                        <td class="px-8 py-5 text-right">
                            <div class="flex items-center justify-end gap-3">
                                <span class="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-tighter ${isEntregado ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}">
                                    ${status || 'PENDIENTE'}
                                </span>
                                ${isEnRuta ? `
                                    <button class="h-9 px-4 rounded-xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 active:scale-95" 
                                            onclick="logisticsFinalizeDispatch(${idDespacho})">
                                        FINALIZAR RUTA
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('') : '<tr><td colspan="5" class="px-8 py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest opacity-50"><i class="bi bi-clipboard-x text-4xl block mb-2"></i>Sin envíos registrados</td></tr>';
        }
    } catch (_) {
        const tbody = document.getElementById('log-despachos-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="px-8 py-20 text-center text-red-400 font-black uppercase text-xs">Error de Sincronización</td></tr>';
    }

    try {
        const transRes = await apiRequest({ endpoint: '/despachos/transportes', token });
        const transportes = Array.isArray(transRes) ? transRes : (Array.isArray(transRes?.data) ? transRes.data : []);

        const list = document.getElementById('log-transportes-list');
        if (list) {
            list.innerHTML = transportes.length ? transportes.map(t => `
                <div class="flex items-center justify-between p-5 rounded-[2rem] bg-gray-50/50 border border-gray-100 hover:border-orange-200 hover:bg-orange-50/20 transition-all group">
                    <div class="flex items-center gap-4">
                        <div class="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-gray-400 group-hover:text-orange-600 transition-colors">
                            <i class="bi bi-person-badge text-xl"></i>
                        </div>
                        <div>
                            <p class="font-black text-gray-900 leading-none mb-1 text-sm">${t.nombreTransporte}</p>
                            <div class="flex items-center gap-2">
                                <span class="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md tracking-widest uppercase">${t.patenteTransporte || 'NO-REG'}</span>
                                <span class="h-1 w-1 rounded-full bg-gray-300"></span>
                                <span class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ID: ${t.id_transporte}</span>
                            </div>
                        </div>
                    </div>
                    <button class="h-10 w-10 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center" 
                            onclick="logisticsDeleteCarrier(${t.id_transporte})">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            `).join('') : '<div class="text-center py-10 text-gray-300 font-black uppercase text-[10px] tracking-widest">No hay transportistas</div>';
        }
    } catch (_) {
        const list = document.getElementById('log-transportes-list');
        if (list) list.innerHTML = '<p class="text-red-500 text-center py-4 font-black uppercase text-[10px]">Error de Carga</p>';
    }
}

function logisticsOpenAddCarrier() {
    const content = `
        <div class="space-y-6 py-4">
            <div class="form-group">
                <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">NOMBRE DEL OPERADOR / EMPRESA</label>
                <div class="relative">
                    <i class="bi bi-person absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="carrier-name" class="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all" placeholder="Ej: Transportes Valmu S.A.">
                </div>
            </div>
            <div class="form-group">
                <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">PATENTE VEHÍCULO</label>
                <div class="relative">
                    <i class="bi bi-truck absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="carrier-plate" class="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all uppercase" placeholder="Ej: ABCD-12">
                </div>
            </div>
        </div>
    `;

    showModal('Registrar Transportista', content, async () => {
        const nombreTransporte = document.getElementById('carrier-name').value.trim();
        const patenteTransporte = document.getElementById('carrier-plate').value.trim();

        if (!nombreTransporte || !patenteTransporte) {
            Swal.fire('Error', 'Todos los campos son obligatorios', 'warning');
            return;
        }

        const token = getAuthToken();
        const res = await apiRequest({
            endpoint: '/despachos/transportes',
            method: 'POST',
            body: { nombreTransporte, patenteTransporte },
            token
        });

        if (res.id_transporte || res.mensaje) {
            Toast.fire({ icon: 'success', title: 'Transportista registrado' });
            closeModal();
            renderLogistics();
        } else {
            Swal.fire('Error', res.error || 'No se pudo guardar', 'error');
        }
    });
}

async function logisticsDeleteCarrier(id) {
    const confirm = await Swal.fire({
        title: '¿Eliminar transportista?',
        text: 'Esta acción no se puede deshacer si no contiene despachos asociados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000000',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        customClass: {
            container: 'premium-swal-container',
            popup: 'premium-red-popup',
            confirmButton: 'premium-red-button'
        }
    });

    if (confirm.isConfirmed) {
        const token = getAuthToken();
        const res = await apiRequest({
            endpoint: `/despachos/transportes/${id}`,
            method: 'DELETE',
            token
        });

        if (res.mensaje && !res.error) {
            Toast.fire({ icon: 'success', title: 'Eliminado correctamente' });
            renderLogistics();
        } else {
            Swal.fire('Error', res.error || 'No se pudo eliminar', 'error');
        }
    }
}

async function logisticsFinalizeDispatch(id) {
    const confirm = await Swal.fire({
        title: '¿Finalizar Despacho?',
        text: 'Confirma que el transportista ha rendido el dinero y la entrega fue exitosa.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ea580c',
        confirmButtonText: 'Sí, finalizar ruta',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'rounded-[2.5rem]',
            confirmButton: 'rounded-2xl px-8 py-3 font-black text-[10px] uppercase tracking-widest',
            cancelButton: 'rounded-2xl px-8 py-3 font-black text-[10px] uppercase tracking-widest'
        }
    });

    if (confirm.isConfirmed) {
        const token = getAuthToken();
        const res = await apiRequest({
            endpoint: `/despachos/${id}/estado`,
            method: 'PUT',
            body: { estado: 'FINALIZADO' },
            token
        });

        if (res.mensaje || !res.error) {
            Toast.fire({ icon: 'success', title: 'Despacho finalizado' });
            renderLogistics();
        } else {
            Swal.fire('Error', res.error || 'No se pudo actualizar el estado', 'error');
        }
    }
}
