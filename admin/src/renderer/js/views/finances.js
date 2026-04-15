const FINANZAS_PER_PAGE = 20;
// Utility to parse localized numeric strings (e.g. "1.234.567" or "1.234,56")
function parseNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    if (s === '') return 0;
    // remove currency symbols and spaces
    s = s.replace(/[^0-9.,-]/g, '');
    if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
        s = s.replace(/\./g, ''); // remove thousand dots
        s = s.replace(/,/g, '.'); // comma -> decimal
    } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
        s = s.replace(/,/g, '.');
    } else {
        const parts = s.split('.');
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            s = s.replace(/\./g, '');
        }
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}
let finanzasState = {
    page: 1,
    ventas: [],
    filtered: [],
    filtroFecha: '',
    filtroBusqueda: ''
};

let financesRefreshTimer = null;

async function renderFinances() {
    if (financesRefreshTimer) {
        clearInterval(financesRefreshTimer);
        financesRefreshTimer = null;
    }
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
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" id="fin-include-all" checked />
                        <span class="text-[12px]">Incluir ventas de todas las cajas</span>
                    </label>
                    <button class="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-orange-600 hover:border-orange-100 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm" onclick="finanzasCargarVentas()">
                        <i class="bi bi-arrow-clockwise text-lg"></i> Sincronizar Datos
                    </button>
                </div>
            </div>

            <!-- KPI TILES (Mini-cards horizontales para 768px) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Replaced: show only today's total amount -->
                <div class="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4">
                        <div class="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl shadow-inner">
                            <i class="bi bi-cash-stack"></i>
                        </div>
                        <div>
                            <span class="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-1">Monto total (hoy)</span>
                            <div class="text-3xl font-black text-gray-900" id="fin-hoy-total">$0</div>
                            <div class="text-[10px] text-gray-400 font-medium">Total ventas del día</div>
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

            <!-- Monthly chart & KPIs row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="col-span-2 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
                    <h4 class="font-bold text-gray-700 mb-2">Ventas por Mes (últimos 12 meses)</h4>
                    <div style="height:220px;"><canvas id="fin-month-chart"></canvas></div>
                </div>
                <div class="col-span-1 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm flex flex-col justify-center items-center">
                    <div class="text-sm text-gray-400 uppercase font-black tracking-widest">Promedio diario (mes seleccionado)</div>
                    <div id="fin-mes-avg" class="text-3xl font-black text-gray-900 mt-3">$0</div>
                    <div class="text-[12px] text-gray-500 mt-1">(monto / días del mes)</div>
                </div>
            </div>

            <!-- FILTERS & TABLE -->
            <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch h-full flex flex-col">
                <div class="p-8 border-b border-gray-50 flex flex-wrap items-center gap-6 justify-between bg-gray-50/30">
                    <div class="flex items-center gap-4">
                        <div class="relative group">
                            <i class="bi bi-calendar-range absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                            <!-- Start with empty filters by default -->
                            <input type="date" id="fin-filtro-fecha" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-48 transition-all" value="" oninput="finanzasAplicarFiltros()">
                        </div>
                        <div class="relative group">
                            <i class="bi bi-calendar2-week absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                            <input type="month" id="fin-filtro-mes" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-44 transition-all" value="" onchange="finanzasAplicarFiltros()">
                        </div>
                        <div class="relative group">
                            <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                            <input type="text" id="fin-busqueda" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-72 transition-all" placeholder="Buscar folio, cliente..." oninput="finanzasAplicarFiltros()">
                        </div>
                <button class="h-11 px-4 text-[10px] font-black text-gray-400 hover:text-orange-600 uppercase tracking-widest transition-colors" onclick="
                    document.getElementById('fin-filtro-fecha').value='';
                    document.getElementById('fin-filtro-mes').value='';
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
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Sucursal</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Importe</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Método Pago</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Fecha/Hora</th>
                            </tr>
                        </thead>
                        <tbody id="fin-ventas-list" class="divide-y divide-gray-50">
                            <tr><td colspan="4" class="px-8 py-20 text-center text-gray-300 animate-pulse">Consultando base de datos...</td></tr>
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

    // Polling cada 60 segundos
    financesRefreshTimer = setInterval(() => {
        if (currentPage === 'finances') {
            void finanzasCargarVentas();
        } else {
            clearInterval(financesRefreshTimer);
            financesRefreshTimer = null;
        }
    }, 60000);
}

// Mapa de sucursales para mostrar nombres en vez de IDs
let finanzasSucursalesMap = {};

async function finanzasCargarSucursales() {
    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: '/sucursales', token });
        const sucursales = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        finanzasSucursalesMap = {};
        sucursales.forEach(s => {
            // Mapear tanto por id_sucursal como por string
            const id = s.id_sucursal || s.id;
            finanzasSucursalesMap[id] = s.nombreSucursal || s.nombre || 'Sucursal ' + id;
            finanzasSucursalesMap[String(id)] = s.nombreSucursal || s.nombre || 'Sucursal ' + id;
        });
    } catch (e) {
        console.warn('No se pudieron cargar sucursales para mapeo:', e);
    }
}

async function finanzasCargarVentas() {
    const token = getAuthToken();
    try {
        // Primero cargar sucursales para tener el mapa de nombres
        await finanzasCargarSucursales();

        // If the UI requests to include all cashiers, try calling the API with a query param
        const includeAll = document.getElementById('fin-include-all')?.checked;
        let endpoint = '/ventas';
        if (includeAll) endpoint = '/ventas?all=true&limit=100000';

        // Try the constructed endpoint. If it fails (404 or unsupported), fall back to /ventas
        let response;
        try {
            response = await apiRequest({ endpoint, token });
        } catch (err) {
            // fallback to default endpoint
            response = await apiRequest({ endpoint: '/ventas', token });
        }

        // Normalize API response to an array. Some backends return { data: [...] },
        // or { data: { data: [...] } } (paginated), or { ventas: [...] }.
        const extractArray = (r) => {
            if (!r) return [];
            if (Array.isArray(r)) return r;
            if (Array.isArray(r.data)) return r.data;
            if (Array.isArray(r.data?.data)) return r.data.data;
            if (Array.isArray(r.ventas)) return r.ventas;
            if (Array.isArray(r.items)) return r.items;
            return [];
        };

        const data = extractArray(response);

        finanzasState.ventas = data || [];
        finanzasState.page = 1;
        finanzasAplicarFiltros();
        finanzasActualizarKPIs();
    } catch (e) {
        const tbody = document.getElementById('fin-ventas-list');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-20 text-red-400 font-black uppercase text-xs">Error de Sincronización: ${e.message}</td></tr>`;
    }
}

function finanzasAplicarFiltros() {
    const fecha = document.getElementById('fin-filtro-fecha')?.value || '';
    const mes = document.getElementById('fin-filtro-mes')?.value || '';
    const busq = (document.getElementById('fin-busqueda')?.value || '').toLowerCase();

    finanzasState.filtroFecha = fecha;
    finanzasState.filtroBusqueda = busq;

    finanzasState.filtered = finanzasState.ventas.filter((v) => {
        const fechaVentaFull = (v.fecha_venta || v.created_at || v.fechaVenta || '').slice(0, 19);
        const fechaVenta = fechaVentaFull.slice(0, 10);
        const fechaMes = fechaVentaFull.slice(0, 7);
        if (fecha && fechaVenta !== fecha) return false;
        if (mes && fechaMes !== mes) return false;
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

    // Robust sum: support different numeric formats / field names
    const parseNumber = (val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        let s = String(val).trim().replace(/[^0-9.,-]/g, '');
        if (s === '') return 0;
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
            s = s.replace(/\./g, '').replace(/,/g, '.');
        } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
            s = s.replace(/,/g, '.');
        } else {
            const parts = s.split('.');
            if (parts.length > 1 && parts[parts.length - 1].length === 3) s = s.replace(/\./g, '');
        }
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
    };

    const montoFiltrado = filtered.reduce((sum, v) => sum + (parseNumber(v.total) || parseNumber(v.monto_total) || parseNumber(v.monto) || 0), 0);
    if (resumenFiltro) {
        resumenFiltro.textContent = total ? `$${montoFiltrado.toLocaleString('es-CL')}` : '';
        resumenFiltro.style.display = total ? 'block' : 'none';
    }

    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-32 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest leading-loose"><i class="bi bi-search text-4xl block mb-4 opacity-10"></i>No hay registros para los filtros aplicados</td></tr>`;
    } else {
        tbody.innerHTML = slice.map((v) => {
            const monto = parseNumber(v.total || v.monto_total || v.monto || 0);
            const fecha = v.fecha_venta || v.created_at || v.fechaVenta || '';
            // Extraer método de pago con múltiples alias
            const metodoPago = v.medio_pago || v.medioPago || v.metodo_pago || v.metodoPago || v.payment_method || v.forma_pago || v.formaPago || '—';
            // Extraer nombre de sucursal: primero intenta campos con nombre, si no usa el mapa por id_sucursal
            const idSuc = v.id_sucursal || v.sucursal_id || v.branchId;
            const sucursal = v.nombre_sucursal || v.nombreSucursal || v.Sucursal?.nombreSucursal || finanzasSucursalesMap[idSuc] || 'Sin asignar';

            return `
                <tr class="group hover:bg-gray-50/50 transition-colors">
                    <td class="px-8 py-4 text-sm font-bold text-gray-700">${sucursal}</td>
                    <td class="px-8 py-4 font-black text-gray-900 text-base">$${monto.toLocaleString('es-CL')}</td>
                    <td class="px-8 py-4">
                         <div class="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                            <i class="bi bi-wallet2 text-gray-300"></i> ${metodoPago}
                         </div>
                    </td>
                    <td class="px-8 py-4">
                        <div class="text-[10px] font-bold text-gray-400">
                            ${fecha ? new Date(fecha).toLocaleDateString('es-CL') : '—'}<br>
                            <span class="text-[9px] font-medium opacity-50">${fecha ? new Date(fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
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

function initFinancesMonthChart(labels, data) {
    const ctx = document.getElementById('fin-month-chart');
    if (!ctx) return;
    if (window.finMonthChart) window.finMonthChart.destroy();
    const displayLabels = labels.map(l => {
        const [y, m] = l.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        return d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
    });
    const numberFormatter = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
    window.finMonthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Ventas por mes',
                data: data.map(d => Math.round(Number(d) || 0)),
                backgroundColor: 'rgba(59,130,246,0.85)',
                borderRadius: 6,
                maxBarThickness: 36
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `$${numberFormatter.format(Number(ctx.raw) || 0)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => '$' + numberFormatter.format(Number(v) || 0),
                        color: '#9ca3af'
                    },
                    grid: { color: '#f3f4f6' }
                },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

function finanzasActualizarKPIs() {
    const hoy = new Date().toISOString().slice(0, 10);
    const mes = new Date().toISOString().slice(0, 7);
    const selectedMonth = document.getElementById('fin-filtro-mes')?.value || '';

    let montoHoy = 0, countHoy = 0, montoMes = 0, countMes = 0, montoTotal = 0;
    finanzasState.ventas.forEach((v) => {
        const estado = (v.estado || '').toUpperCase();
        if (estado === 'ANULADA' || estado === 'CANCELADA') return;
        const monto = parseNumber(v.total || v.monto_total || v.monto || 0);
        const fechaFull = (v.fecha_venta || v.created_at || v.fechaVenta || '').slice(0, 19);
        const fecha = fechaFull.slice(0, 10);
        const fechaMes = fechaFull.slice(0, 7);
        montoTotal += monto;
        if (fecha === hoy) { montoHoy += monto; countHoy++; }
        // If a month filter is selected, use it as the month to show; otherwise use current month
        const filterMonth = selectedMonth || mes;
        if (fechaMes === filterMonth) { montoMes += monto; countMes++; }
    });

    const fmt = (n) => `$${Math.round(n).toLocaleString('es-CL')}`;
    if (document.getElementById('fin-hoy-total')) document.getElementById('fin-hoy-total').textContent = fmt(montoHoy);
    if (document.getElementById('fin-mes-total')) document.getElementById('fin-mes-total').textContent = fmt(montoMes);
    if (document.getElementById('fin-mes-count')) document.getElementById('fin-mes-count').textContent = `${countMes} Tickets`;
    if (document.getElementById('fin-total')) document.getElementById('fin-total').textContent = fmt(montoTotal);
    if (document.getElementById('fin-total-count')) document.getElementById('fin-total-count').textContent = `${finanzasState.ventas.length} Transacciones`;

    // Average per day for the selected month
    const monthToCompute = selectedMonth || mes;
    if (monthToCompute) {
        const [y, m] = monthToCompute.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const avg = daysInMonth > 0 ? Math.round(montoMes / daysInMonth) : 0;
        const avgEl = document.getElementById('fin-mes-avg');
        if (avgEl) avgEl.textContent = fmt(avg);
    }

    // Draw monthly chart (last 12 months)
    try {
        const monthlyTotals = {};
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyTotals[key] = 0;
        }
        finanzasState.ventas.forEach((v) => {
            const estado = (v.estado || '').toUpperCase();
            if (estado === 'ANULADA' || estado === 'CANCELADA') return;
            const monto = parseNumber(v.total || v.monto_total || v.monto || 0);
            const fechaFull = (v.fecha_venta || v.created_at || v.fechaVenta || '').slice(0, 19);
            const fechaMes = fechaFull.slice(0, 7);
            if (monthlyTotals.hasOwnProperty(fechaMes)) monthlyTotals[fechaMes] += monto;
        });
        const labels = Object.keys(monthlyTotals);
        const data = labels.map(k => monthlyTotals[k]);
        initFinancesMonthChart(labels, data);
    } catch (err) {
        console.warn('Error initializing monthly chart', err);
    }
}
