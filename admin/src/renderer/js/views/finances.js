const FINANZAS_PER_PAGE = 20;
let finanzasState = {
    page: 1,
    ventas: [],
    filtered: [],
    filtroFecha: '',
    filtroBusqueda: ''
};

async function renderFinances() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const hoy = new Date().toISOString().slice(0, 10);

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">Panel de Finanzas</h2>
                    <p class="text-gray-400 text-sm font-medium">Análisis de recaudación y auditoría de transacciones</p>
                </div>
                <button class="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-orange-600 hover:border-orange-100 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm" onclick="renderFinances()">
                    <i class="bi bi-arrow-clockwise text-lg"></i> Sincronizar Datos
                </button>
            </div>

            <!-- KPI TILES (Mini-cards horizontales para 768px) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4">
                        <div class="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl shadow-inner">
                            <i class="bi bi-calendar-event"></i>
                        </div>
                        <div>
                            <span class="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-1">Cierre Hoy</span>
                            <div class="text-2xl font-black text-gray-900" id="fin-hoy-total">$0</div>
                            <div class="text-[10px] text-emerald-500 font-bold" id="fin-hoy-count">0 tickets</div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4">
                        <div class="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner">
                            <i class="bi bi-graph-up-arrow"></i>
                        </div>
                        <div>
                            <span class="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-1">Total Mes</span>
                            <div class="text-2xl font-black text-gray-900" id="fin-mes-total">$0</div>
                            <div class="text-[10px] text-indigo-500 font-bold" id="fin-mes-count">0 tickets</div>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4">
                        <div class="h-12 w-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-xl shadow-lg shadow-gray-200">
                            <i class="bi bi-database-fill-check"></i>
                        </div>
                        <div>
                            <span class="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-1">Acumulado Histórico</span>
                            <div class="text-2xl font-black text-gray-900" id="fin-total">$0</div>
                            <div class="text-[10px] text-gray-400 font-bold" id="fin-total-count">0 registros</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- FILTERS & TABLE -->
            <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch h-full flex flex-col">
                <div class="p-8 border-b border-gray-50 flex flex-wrap items-center gap-6 justify-between bg-gray-50/30">
                    <div class="flex items-center gap-4">
                        <div class="relative group">
                            <i class="bi bi-calendar-range absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                            <input type="date" id="fin-filtro-fecha" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-48 transition-all" value="${hoy}" oninput="finanzasAplicarFiltros()">
                        </div>
                        <div class="relative group">
                            <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                            <input type="text" id="fin-busqueda" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-72 transition-all" placeholder="Buscar folio, cliente..." oninput="finanzasAplicarFiltros()">
                        </div>
                        <button class="h-11 px-4 text-[10px] font-black text-gray-400 hover:text-orange-600 uppercase tracking-widest transition-colors" onclick="
                            document.getElementById('fin-filtro-fecha').value='';
                            document.getElementById('fin-busqueda').value='';
                            finanzasAplicarFiltros()">
                            Limpiar Filtros
                        </button>
                    </div>
                    <div id="fin-resumen-filtro" class="px-6 py-2 bg-gray-900 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-gray-200/50"></div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-50">
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Folio</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Tipo</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Identidad Cliente</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Sucursal</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Importe</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Medio</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Fecha/Hora</th>
                                <th class="px-8 py-5 text-right text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Status</th>
                            </tr>
                        </thead>
                        <tbody id="fin-ventas-list" class="divide-y divide-gray-50">
                            <tr><td colspan="8" class="px-8 py-20 text-center text-gray-300 animate-pulse">Consultando base de datos...</td></tr>
                        </tbody>
                    </table>
                </div>

                <!-- PAGINATION -->
                <div class="px-8 py-6 bg-gray-50/50 flex items-center justify-between">
                    <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest" id="fin-pagination-summary">--</div>
                    <div class="flex gap-3">
                        <button class="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 hover:text-orange-600 transition-all shadow-sm active:scale-90 disabled:opacity-30 disabled:pointer-events-none" id="fin-prev" onclick="finanzasPaginar(-1)">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                        <button class="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-500 hover:text-orange-600 transition-all shadow-sm active:scale-90 disabled:opacity-30 disabled:pointer-events-none" id="fin-next" onclick="finanzasPaginar(1)">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    await finanzasCargarVentas();
}

async function finanzasCargarVentas() {
    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: '/ventas', token });
        const data = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);

        finanzasState.ventas = data;
        finanzasState.page = 1;
        finanzasAplicarFiltros();
        finanzasActualizarKPIs();
    } catch (e) {
        const tbody = document.getElementById('fin-ventas-list');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-20 text-red-400 font-black uppercase text-xs">Error de Sincronización: ${e.message}</td></tr>`;
    }
}

function finanzasAplicarFiltros() {
    const fecha = document.getElementById('fin-filtro-fecha')?.value || '';
    const busq = (document.getElementById('fin-busqueda')?.value || '').toLowerCase();

    finanzasState.filtroFecha = fecha;
    finanzasState.filtroBusqueda = busq;

    finanzasState.filtered = finanzasState.ventas.filter((v) => {
        const fechaVenta = (v.fecha_venta || v.created_at || '').slice(0, 10);
        if (fecha && fechaVenta !== fecha) return false;
        if (busq) {
            const haystack = [v.folio, v.numero_ticket, v.ticket_id, v.nombre_cliente, v.nombreCliente, v.cliente].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(busq)) return false;
        }
        return true;
    });

    finanzasState.page = 1;
    finanzasRenderTabla();
}

function finanzasRenderTabla() {
    const tbody = document.getElementById('fin-ventas-list');
    const summary = document.getElementById('fin-pagination-summary');
    const prevBtn = document.getElementById('fin-prev');
    const nextBtn = document.getElementById('fin-next');
    const resumenFiltro = document.getElementById('fin-resumen-filtro');

    const { filtered, page } = finanzasState;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / FINANZAS_PER_PAGE));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    finanzasState.page = safePage;

    const start = (safePage - 1) * FINANZAS_PER_PAGE;
    const slice = filtered.slice(start, start + FINANZAS_PER_PAGE);

    const montoFiltrado = filtered.reduce((sum, v) => sum + (Number(v.total) || Number(v.monto_total) || 0), 0);
    if (resumenFiltro) {
        resumenFiltro.textContent = total ? `$${montoFiltrado.toLocaleString('es-CL')}` : '';
        resumenFiltro.style.display = total ? 'block' : 'none';
    }

    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-8 py-32 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest leading-loose"><i class="bi bi-search text-4xl block mb-4 opacity-10"></i>No hay registros para los filtros aplicados</td></tr>`;
    } else {
        tbody.innerHTML = slice.map((v) => {
            const folio = v.folio || v.numero_ticket || v.ticket_id || v.numero_boleta || '—';
            const tipo = v.tipo_documento || v.tipo_venta || v.doc_type || 'Venta';
            const cliente = v.nombre_cliente || v.nombreCliente || 'Consumidor Final';
            const monto = Number(v.total || v.monto_total || 0);
            const fecha = v.fecha_venta || v.created_at || '';
            const status = (v.estado || 'ACTIVA').toUpperCase();
            const isAnulada = status === 'ANULADA' || status === 'CANCELADA';

            return `
                <tr class="group hover:bg-gray-50/50 transition-colors">
                    <td class="px-8 py-4 text-xs font-black text-gray-400">#${folio}</td>
                    <td class="px-8 py-4">
                        <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-lg">${tipo}</span>
                    </td>
                    <td class="px-8 py-4 font-black text-gray-700 text-sm tracking-tight">${cliente}</td>
                    <td class="px-8 py-4 text-xs font-bold text-gray-500">${v.nombre_sucursal || 'Central'}</td>
                    <td class="px-8 py-4 font-black text-gray-900 text-base">$${monto.toLocaleString('es-CL')}</td>
                    <td class="px-8 py-4">
                         <div class="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                            <i class="bi bi-wallet2 text-gray-300"></i> ${v.medio_pago || '—'}
                         </div>
                    </td>
                    <td class="px-8 py-4">
                        <div class="text-[10px] font-bold text-gray-400">
                            ${fecha ? new Date(fecha).toLocaleDateString('es-CL') : '—'}<br>
                            <span class="text-[9px] font-medium opacity-50">${fecha ? new Date(fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                    </td>
                    <td class="px-8 py-4 text-right">
                        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${isAnulada ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}">
                            <div class="h-1.5 w-1.5 rounded-full bg-current ${!isAnulada ? 'animate-pulse' : ''}"></div>
                            <span class="text-[10px] font-black uppercase tracking-tighter">${status}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (summary) summary.textContent = total ? `PÁGINA ${safePage} DE ${totalPages} • ${total} DOCUMENTOS` : 'BANDEJA VACÍA';
    if (prevBtn) prevBtn.disabled = safePage <= 1;
    if (nextBtn) nextBtn.disabled = safePage >= totalPages;
}

function finanzasPaginar(delta) {
    finanzasState.page += delta;
    finanzasRenderTabla();
}

function finanzasActualizarKPIs() {
    const hoy = new Date().toISOString().slice(0, 10);
    const mes = new Date().toISOString().slice(0, 7);

    let montoHoy = 0, countHoy = 0, montoMes = 0, countMes = 0, montoTotal = 0;
    finanzasState.ventas.forEach((v) => {
        const estado = (v.estado || '').toUpperCase();
        if (estado === 'ANULADA' || estado === 'CANCELADA') return;
        const monto = Number(v.total || v.monto_total || 0);
        const fecha = (v.fecha_venta || v.created_at || '').slice(0, 10);
        montoTotal += monto;
        if (fecha === hoy) { montoHoy += monto; countHoy++; }
        if (fecha.startsWith(mes)) { montoMes += monto; countMes++; }
    });

    const fmt = (n) => `$${n.toLocaleString('es-CL')}`;
    if (document.getElementById('fin-hoy-total')) document.getElementById('fin-hoy-total').textContent = fmt(montoHoy);
    if (document.getElementById('fin-hoy-count')) document.getElementById('fin-hoy-count').textContent = `${countHoy} Tickets`;
    if (document.getElementById('fin-mes-total')) document.getElementById('fin-mes-total').textContent = fmt(montoMes);
    if (document.getElementById('fin-mes-count')) document.getElementById('fin-mes-count').textContent = `${countMes} Tickets`;
    if (document.getElementById('fin-total')) document.getElementById('fin-total').textContent = fmt(montoTotal);
    if (document.getElementById('fin-total-count')) document.getElementById('fin-total-count').textContent = `${finanzasState.ventas.length} Transacciones`;
}
