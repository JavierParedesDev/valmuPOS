const FINANZAS_PER_PAGE = 20;
const FINANZAS_TIMEZONE = 'America/Santiago';

function getChileFinanceDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return new Intl.DateTimeFormat('sv-SE', { timeZone: FINANZAS_TIMEZONE }).format(date);
}
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
let finanzasUsuariosMap = {};

function finanzasNormalizarMetodoPago(venta = {}) {
    return String(
        venta.medio_pago
        || venta.medioPago
        || venta.metodo_pago
        || venta.metodoPago
        || venta.payment_method
        || venta.forma_pago
        || venta.formaPago
        || ''
    ).trim().toLowerCase();
}

function finanzasEsMetodoTarjeta(metodoPago = '') {
    return metodoPago.includes('debito')
        || metodoPago.includes('crédito')
        || metodoPago.includes('credito')
        || metodoPago.includes('tarjeta');
}

function finanzasObtenerNombreCajero(venta = {}) {
    const userId = Number(venta.id_usuario || venta.idUsuario || venta.id_vendedor || 0);
    const usuario = finanzasUsuariosMap[userId];
    if (usuario) {
        return usuario.nombreCompleto
            || usuario.nombre
            || usuario.nombreUsuario
            || usuario.username
            || `Usuario #${userId}`;
    }
    return userId > 0 ? `Usuario #${userId}` : 'Sin cajero';
}

function finanzasRenderDesgloseCajeros() {
    const container = document.getElementById('fin-cashier-breakdown');
    if (!container) return;

    const agrupado = finanzasState.filtered.reduce((acc, venta) => {
        const userId = Number(venta.id_usuario || venta.idUsuario || venta.id_vendedor || 0);
        const key = userId > 0 ? String(userId) : 'sin_usuario';
        const metodoPago = finanzasNormalizarMetodoPago(venta);
        const monto = parseNumber(venta.total || venta.monto_total || venta.monto || 0);

        if (!acc[key]) {
            acc[key] = {
                userId,
                nombre: finanzasObtenerNombreCajero(venta),
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0,
                otros: 0,
                total: 0,
                cantidad: 0
            };
        }

        const pagoEfectivo = parseNumber(venta.pago_efectivo || 0);
        const pagoTarjeta = parseNumber(venta.pago_tarjeta || 0);
        const pagoTransferencia = parseNumber(venta.pago_transferencia || 0);

        if (pagoEfectivo > 0 || pagoTarjeta > 0 || pagoTransferencia > 0) {
            acc[key].efectivo += pagoEfectivo;
            acc[key].tarjeta += pagoTarjeta;
            acc[key].transferencia += pagoTransferencia;
            
            // Any remaining total that wasn't captured in the 3 main fields goes to "otros"
            const totalCapturado = pagoEfectivo + pagoTarjeta + pagoTransferencia;
            acc[key].otros += Math.max(0, monto - totalCapturado);
        } else {
            // Fallback for old sales or sales without detailed breakdown fields
            if (metodoPago.includes('efectivo')) {
                acc[key].efectivo += monto;
            } else if (finanzasEsMetodoTarjeta(metodoPago)) {
                acc[key].tarjeta += monto;
            } else if (metodoPago.includes('transfer')) {
                acc[key].transferencia += monto;
            } else {
                acc[key].otros += monto;
            }
        }

        acc[key].total += monto;
        acc[key].cantidad += 1;
        return acc;
    }, {});

    const rows = Object.values(agrupado).sort((a, b) => b.total - a.total);

    if (!rows.length) {
        container.innerHTML = `
            <div class="px-8 py-10 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest">
                No hay ventas para desglosar con los filtros actuales
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b border-gray-50">
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Cajero</th>
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] text-right">Efectivo</th>
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] text-right">Tarjeta</th>
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] text-right">Transferencia</th>
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] text-right">Otros</th>
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] text-right">Total</th>
                        <th class="px-8 py-5 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] text-right">Ventas</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${rows.map((row) => `
                        <tr class="hover:bg-gray-50/50 transition-colors">
                            <td class="px-8 py-4">
                                <div class="font-black text-gray-900 text-sm">${row.nombre}</div>
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${row.userId > 0 ? `#${row.userId}` : 'Sin ID'}</div>
                            </td>
                            <td class="px-8 py-4 text-right font-black text-emerald-600">$${Math.round(row.efectivo).toLocaleString('es-CL')}</td>
                            <td class="px-8 py-4 text-right font-black text-sky-600">$${Math.round(row.tarjeta).toLocaleString('es-CL')}</td>
                            <td class="px-8 py-4 text-right font-black text-violet-600">$${Math.round(row.transferencia).toLocaleString('es-CL')}</td>
                            <td class="px-8 py-4 text-right font-black text-gray-400">$${Math.round(row.otros).toLocaleString('es-CL')}</td>
                            <td class="px-8 py-4 text-right font-black text-gray-900">$${Math.round(row.total).toLocaleString('es-CL')}</td>
                            <td class="px-8 py-4 text-right text-sm font-bold text-gray-500">${row.cantidad}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function renderFinances() {
    if (financesRefreshTimer) {
        clearInterval(financesRefreshTimer);
        financesRefreshTimer = null;
    }
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const hoy = getChileFinanceDateKey(new Date());

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">Panel de Finanzas</h2>
                    <p class="text-gray-400 text-sm font-medium">Análisis de recaudación y auditoría de transacciones</p>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2 bg-white border border-orange-100 rounded-2xl p-1 shadow-sm">
                        <input type="number" id="fin-audit-amount" class="pl-4 py-2 bg-transparent text-xs font-black w-24 outline-none" placeholder="Monto" value="9000">
                        <button class="px-4 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-colors shadow-sm" onclick="finanzasAuditarMonto()">
                            <i class="bi bi-search"></i> Buscar Descuadre
                        </button>
                    </div>
                    <label class="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" id="fin-include-all" checked />
                        <span class="text-[12px]">Incluir ventas de todas las cajas</span>
                    </label>
                    <button class="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-red-600 hover:border-red-100 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm" onclick="finanzasExportarPDF()">
                        <i class="bi bi-file-earmark-pdf text-lg"></i> Exportar PDF
                    </button>
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
                            <div class="mt-2">
                                <span class="text-[9px] font-black text-green-700 uppercase tracking-widest block mb-1">Efectivo filtrado</span>
                                <div class="text-xl font-black text-green-700" id="fin-hoy-efectivo">$0</div>
                                <div class="text-[10px] text-gray-400 font-medium">Total efectivo según filtros</div>
                            </div>
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

            <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-orange-500/10">
                <div class="p-8 border-b border-gray-50 bg-gray-50/30">
                    <h3 class="text-xl font-black text-gray-900 tracking-tight">Desglose por Cajero</h3>
                    <p class="text-gray-400 text-sm font-medium mt-1">Montos por usuario según los filtros activos del panel.</p>
                </div>
                <div id="fin-cashier-breakdown">
                    <div class="px-8 py-10 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest">Preparando desglose...</div>
                </div>
            </div>

            <!-- FILTERS & TABLE -->
            <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch h-full flex flex-col">
                <div class="p-8 border-b border-gray-50 flex flex-wrap items-center gap-6 justify-between bg-gray-50/30">
                    <div class="flex items-center gap-4 flex-wrap">
                        <div class="relative group">
                            <i class="bi bi-calendar-range absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
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
                        <div class="relative group">
                            <i class="bi bi-shop absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <select id="fin-filtro-sucursal" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-44 transition-all" onchange="finanzasAplicarFiltros()">
                                <option value="">Todas las sucursales</option>
                            </select>
                        </div>
                        <div class="relative group">
                            <i class="bi bi-wallet2 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <select id="fin-filtro-medio" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-44 transition-all" onchange="finanzasAplicarFiltros()">
                                <option value="">Todos los medios</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="transfer">Transferencia</option>
                            </select>
                        </div>
                        <div class="relative group">
                            <i class="bi bi-person absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <select id="fin-filtro-cajero" class="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold shadow-sm focus:border-orange-200 outline-none w-48 transition-all" onchange="finanzasAplicarFiltros()">
                                <option value="">Todos los cajeros</option>
                            </select>
                        </div>
                        <button class="h-11 px-4 text-[10px] font-black text-gray-400 hover:text-orange-600 uppercase tracking-widest transition-colors" onclick="
                            document.getElementById('fin-filtro-fecha').value='';
                            document.getElementById('fin-filtro-mes').value='';
                            document.getElementById('fin-busqueda').value='';
                            document.getElementById('fin-filtro-sucursal').value='';
                            document.getElementById('fin-filtro-medio').value='';
                            document.getElementById('fin-filtro-cajero').value='';
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

async function finanzasCargarUsuarios() {
    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: '/auth/usuarios', token });
        const usuarios = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        finanzasUsuariosMap = usuarios.reduce((acc, usuario) => {
            const id = Number(usuario.id_usuario || usuario.id || 0);
            if (id > 0) acc[id] = usuario;
            return acc;
        }, {});

        // Llenar el filtro de cajeros
        const select = document.getElementById('fin-filtro-cajero');
        if (select) {
            const sortedUsers = Object.values(finanzasUsuariosMap).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            select.innerHTML = '<option value="">Todos los cajeros</option>' +
                sortedUsers.map(u => {
                    const nombre = u.nombreCompleto || u.nombre || u.username || `Usuario #${u.id_usuario}`;
                    return `<option value="${u.id_usuario || u.id}">${nombre}</option>`;
                }).join('');
        }
    } catch (error) {
        console.warn('No se pudieron cargar usuarios para el desglose de cajeros:', error);
        finanzasUsuariosMap = {};
    }
}

async function finanzasCargarSucursales() {
    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: '/sucursales', token });
        const sucursales = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        finanzasSucursalesMap = {};
        // Solo agregar una vez cada sucursal por su ID numérico
        sucursales.forEach(s => {
            const id = s.id_sucursal || s.id;
            if (id != null && !finanzasSucursalesMap.hasOwnProperty(id)) {
                finanzasSucursalesMap[id] = s.nombreSucursal || s.nombre || 'Sucursal ' + id;
            }
        });
        // Llenar el filtro de sucursales solo con los IDs numéricos únicos
        const select = document.getElementById('fin-filtro-sucursal');
        if (select) {
            select.innerHTML = '<option value="">Todas las sucursales</option>' +
                Object.entries(finanzasSucursalesMap).map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join('');
        }
    } catch (e) {
        console.warn('No se pudieron cargar sucursales para mapeo:', e);
    }
}

async function finanzasCargarVentas() {
    const token = getAuthToken();
    try {
        // Primero cargar sucursales para tener el mapa de nombres
        await Promise.all([
            finanzasCargarSucursales(),
            finanzasCargarUsuarios()
        ]);

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

    const sucursal = document.getElementById('fin-filtro-sucursal')?.value || '';
    const sucursalLabel = document.getElementById('fin-filtro-sucursal')?.selectedOptions?.[0]?.textContent?.trim() || '';
    const medio = document.getElementById('fin-filtro-medio')?.value || '';
    const cajeroId = document.getElementById('fin-filtro-cajero')?.value || '';

    finanzasState.filtered = finanzasState.ventas.filter((v) => {
        // 1. Filtro de Estado: Excluir solo ventas anuladas/canceladas para máxima compatibilidad
        const estado = (v.estado || '').toString().trim().toLowerCase();
        if (estado === 'anulada' || estado === 'cancelada') return false;

        const fechaVentaFull = (v.fecha_venta || v.created_at || v.fechaVenta || '').slice(0, 19);
        const fechaVenta = fechaVentaFull.slice(0, 10);
        const fechaMes = fechaVentaFull.slice(0, 7);

        if (fecha && fechaVenta !== fecha) return false;
        if (mes && fechaMes !== mes) return false;

        if (busq) {
            const haystack = [v.folio, v.numero_ticket, v.ticket_id, v.nombre_cliente, v.nombreCliente, v.cliente].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(busq)) return false;
        }

        // 2. Filtro de Sucursal: Detección robusta de ID o Nombre
        if (sucursal) {
            const idSuc = v.id_sucursal || v.sucursal_id || v.branchId || v.idSucursal || v.Sucursal?.id_sucursal || v.Sucursal?.id;
            const nombreSuc = (v.nombre_sucursal || v.nombreSucursal || v.Sucursal?.nombreSucursal || v.Sucursal?.nombre || v.sucursal || '').toString().trim().toLowerCase();

            const matchId = idSuc != null && String(idSuc) === String(sucursal);
            const matchNombre = sucursalLabel && nombreSuc && (
                nombreSuc === sucursalLabel.toLowerCase() ||
                sucursalLabel.toLowerCase().includes(nombreSuc) ||
                nombreSuc.includes(sucursalLabel.toLowerCase())
            );

            if (!matchId && !matchNombre) return false;
        }

        if (medio) {
            const metodoPago = finanzasNormalizarMetodoPago(v);
            const pagoTarjeta = parseNumber(v.pago_tarjeta || 0);
            const pagoTransferencia = parseNumber(v.pago_transferencia || 0);
            const pagoEfectivo = parseNumber(v.pago_efectivo || 0);

            if (medio === 'tarjeta') {
                if (!finanzasEsMetodoTarjeta(metodoPago) && pagoTarjeta <= 0) return false;
            } else if (medio === 'efectivo') {
                if (!metodoPago.includes('efectivo') && pagoEfectivo <= 0) return false;
            } else if (medio === 'transfer') {
                if (!metodoPago.includes('transfer') && pagoTransferencia <= 0) return false;
            } else {
                if (!metodoPago.includes(medio)) return false;
            }
        }

        // 3. Filtro de Cajero
        if (cajeroId) {
            const idVentaUser = Number(v.id_usuario || v.idUsuario || v.id_vendedor || 0);
            if (String(idVentaUser) !== String(cajeroId)) return false;
        }

        return true;
    });

    finanzasState.page = 1;
    finanzasRenderTabla();
    finanzasActualizarEfectivoHoy();
    finanzasRenderDesgloseCajeros();

}

function finanzasActualizarEfectivoHoy() {
    const hoy = getChileFinanceDateKey(new Date());
    const sucursal = document.getElementById('fin-filtro-sucursal')?.value || '';
    const sucursalLabel = document.getElementById('fin-filtro-sucursal')?.selectedOptions?.[0]?.textContent?.trim() || '';
    const medioFiltro = document.getElementById('fin-filtro-medio')?.value || '';

    let total = 0;
    finanzasState.ventas.forEach((v) => {
        // Estado
        const estado = (v.estado || '').toString().trim().toLowerCase();
        if (estado === 'anulada' || estado === 'cancelada') return;

        // Fecha (Solo HOY)
        const fechaVenta = (v.fecha_venta || v.created_at || v.fechaVenta || '').slice(0, 10);
        if (fechaVenta !== hoy) return;

        // Sucursal
        if (sucursal) {
            const idSuc = v.id_sucursal || v.sucursal_id || v.branchId || v.idSucursal || v.Sucursal?.id_sucursal || v.Sucursal?.id;
            const nombreSuc = (v.nombre_sucursal || v.nombreSucursal || v.Sucursal?.nombreSucursal || v.Sucursal?.nombre || v.sucursal || '').toString().trim().toLowerCase();

            const matchId = idSuc != null && String(idSuc) === String(sucursal);
            const matchNombre = sucursalLabel && nombreSuc && (
                nombreSuc === sucursalLabel.toLowerCase() ||
                sucursalLabel.toLowerCase().includes(nombreSuc) ||
                nombreSuc.includes(sucursalLabel.toLowerCase())
            );
            if (!matchId && !matchNombre) return;
        }

        // Medio de pago (Si hay filtro, aplicarlo; si no, sumar todo lo del día filtrado por sucursal)
        const metodoPago = (v.medio_pago || v.medioPago || v.metodo_pago || v.metodoPago || v.payment_method || v.forma_pago || v.formaPago || '').toLowerCase();
        if (medioFiltro) {
            if (medioFiltro === 'tarjeta') {
                if (!(metodoPago.includes('debito') || metodoPago.includes('crédito') || metodoPago.includes('credito') || metodoPago.includes('tarjeta'))) return;
            } else {
                if (!metodoPago.includes(medioFiltro)) return;
            }
        }

        total += parseNumber(v.total || v.monto_total || v.monto || 0);
    });
    const el = document.getElementById('fin-hoy-efectivo');
    if (el) el.textContent = `$${Math.round(total).toLocaleString('es-CL')}`;
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
            const metodoPago = v.medio_pago || v.medioPago || v.metodo_pago || v.metodoPago || v.payment_method || v.forma_pago || v.formaPago || '—';
            const idSuc = v.id_sucursal || v.sucursal_id || v.branchId;
            const sucursal = v.nombre_sucursal || v.nombreSucursal || v.Sucursal?.nombreSucursal || finanzasSucursalesMap[idSuc] || 'Sin asignar';

            return `
                <tr class="group hover:bg-orange-50/50 cursor-pointer transition-colors" onclick="finanzasVerDetalleVenta(${v.id_venta})">
                    <td class="px-8 py-4 text-sm font-bold text-gray-700">${sucursal}</td>
                    <td class="px-8 py-4 font-black text-gray-900 text-base">$${monto.toLocaleString('es-CL')}</td>
                    <td class="px-8 py-4">
                         <div class="flex flex-col gap-0.5">
                            <div class="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                                <i class="bi bi-wallet2 text-gray-300"></i> ${metodoPago.toUpperCase()}
                            </div>
                            ${(parseNumber(v.pago_efectivo) > 0 || parseNumber(v.pago_tarjeta) > 0 || parseNumber(v.pago_transferencia) > 0) ? `
                                <div class="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 opacity-80">
                                    ${parseNumber(v.pago_efectivo) > 0 ? `<span class="text-[9px] font-black text-green-600 bg-green-50 px-1 rounded">EF: $${parseNumber(v.pago_efectivo).toLocaleString('es-CL')}</span>` : ''}
                                    ${parseNumber(v.pago_tarjeta) > 0 ? `<span class="text-[9px] font-black text-blue-600 bg-blue-50 px-1 rounded">TRJ: $${parseNumber(v.pago_tarjeta).toLocaleString('es-CL')}</span>` : ''}
                                    ${parseNumber(v.pago_transferencia) > 0 ? `<span class="text-[9px] font-black text-purple-600 bg-purple-50 px-1 rounded">TRF: $${parseNumber(v.pago_transferencia).toLocaleString('es-CL')}</span>` : ''}
                                </div>
                            ` : ''}
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
    const hoy = getChileFinanceDateKey(new Date());
    const mes = hoy.slice(0, 7);
    const selectedMonth = document.getElementById('fin-filtro-mes')?.value || '';

    let montoHoy = 0, countHoy = 0, montoMes = 0, countMes = 0, montoTotal = 0;
    finanzasState.ventas.forEach((v) => {
        const estado = (v.estado || '').toString().trim().toLowerCase();
        if (estado === 'anulada' || estado === 'cancelada') return;
        const monto = parseNumber(v.total || v.monto_total || v.monto || 0);
        const fechaFull = (v.fecha_venta || v.created_at || v.fechaVenta || '').slice(0, 19);
        const fecha = fechaFull.slice(0, 10);
        const fechaMes = fechaFull.slice(0, 7);
        montoTotal += monto;
        if (fecha === hoy) { montoHoy += monto; countHoy++; }
        const filterMonth = selectedMonth || mes;
        if (fechaMes === filterMonth) { montoMes += monto; countMes++; }
    });

    const fmt = (n) => `$${Math.round(n).toLocaleString('es-CL')}`;
    if (document.getElementById('fin-hoy-total')) document.getElementById('fin-hoy-total').textContent = fmt(montoHoy);
    if (document.getElementById('fin-mes-total')) document.getElementById('fin-mes-total').textContent = fmt(montoMes);
    if (document.getElementById('fin-mes-count')) document.getElementById('fin-mes-count').textContent = `${countMes} Tickets`;
    if (document.getElementById('fin-total')) document.getElementById('fin-total').textContent = fmt(montoTotal);
    if (document.getElementById('fin-total-count')) document.getElementById('fin-total-count').textContent = `${finanzasState.ventas.length} Transacciones`;

    const monthToCompute = selectedMonth || mes;
    if (monthToCompute) {
        const [y, m] = monthToCompute.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const avg = daysInMonth > 0 ? Math.round(montoMes / daysInMonth) : 0;
        const avgEl = document.getElementById('fin-mes-avg');
        if (avgEl) avgEl.textContent = fmt(avg);
    }

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

async function finanzasVerDetalleVenta(idVenta) {
    if (!idVenta) return;

    try {
        Swal.fire({
            title: 'Cargando detalle...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const token = getAuthToken();
        const apiRes = await apiRequest({ endpoint: `/ventas/${idVenta}`, token });

        if (!apiRes || !apiRes.ok || !apiRes.data || !apiRes.data.cabecera) {
            throw new Error(apiRes?.error || 'No se pudo encontrar la venta');
        }

        const { cabecera, productos, pagos } = apiRes.data;
        const total = parseNumber(cabecera.total || 0);

        Swal.fire({
            title: null,
            width: '600px',
            customClass: {
                popup: 'custom-swal-popup'
            },
            html: `
                <div class="product-preview-header">
                    <div class="preview-icon"><i class="bi bi-receipt"></i></div>
                    <div class="preview-title-stack">
                        <span class="preview-overline">Detalle de Venta #${idVenta}</span>
                        <h2 class="preview-title">${cabecera.folioDocumento || 'Ticket de Venta'}</h2>
                    </div>
                </div>

                <div class="space-y-4 text-left">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Fecha</span>
                            <div class="text-sm font-bold text-gray-900">${new Date(cabecera.fechaVenta).toLocaleString('es-CL')}</div>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Cajero</span>
                            <div class="text-sm font-bold text-gray-900">${cabecera.nombreCajero || 'Cajero General'}</div>
                        </div>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Cliente</span>
                        <div class="text-sm font-bold text-gray-900">${cabecera.nombreCliente || 'Cliente General'} ${cabecera.rut_cliente ? `(${cabecera.rut_cliente})` : ''}</div>
                    </div>

                    <div class="border border-gray-100 rounded-2xl overflow-hidden mt-6">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-gray-900 text-white">
                                <tr>
                                    <th class="px-4 py-2 uppercase font-black tracking-widest">Producto</th>
                                    <th class="px-4 py-2 uppercase font-black tracking-widest text-right">Cant.</th>
                                    <th class="px-4 py-2 uppercase font-black tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${productos.map(p => `
                                    <tr>
                                        <td class="px-4 py-3 font-bold text-gray-700">${p.nombreProducto}</td>
                                        <td class="px-4 py-3 font-bold text-gray-900 text-right">${p.cantidadVenta}</td>
                                        <td class="px-4 py-3 font-black text-gray-900 text-right">$${parseNumber(p.subtotalLinea).toLocaleString('es-CL')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot class="bg-orange-50 font-black">
                                <tr>
                                    <td colspan="2" class="px-4 py-3 text-orange-800">TOTAL</td>
                                    <td class="px-4 py-3 text-orange-900 text-right text-lg">$${total.toLocaleString('es-CL')}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Metodos de Pago</span>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${pagos.map(pag => `
                                <span class="bg-white px-3 py-1 rounded-full text-xs font-black text-indigo-700 shadow-sm border border-indigo-100">${pag.metodoPago}: $${parseNumber(pag.montoPago).toLocaleString('es-CL')}</span>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-8">
                    <button class="px-6 py-3 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-900 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm" onclick="Swal.close()">Cerrar</button>
                    <button class="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-orange-600 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-gray-200" id="btn-imprimir-ticket">
                        <i class="bi bi-printer-fill text-lg"></i> Imprimir Ticket
                    </button>
                </div>
            `,
            showConfirmButton: false,
            didOpen: () => {
                const btnPrint = document.getElementById('btn-imprimir-ticket');
                if (btnPrint) {
                    btnPrint.addEventListener('click', () => {
                        finanzasImprimirTicket({ cabecera, productos, pagos });
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error al ver detalle:', error);
        Swal.fire('Error', 'No se pudo cargar el detalle de la venta', 'error');
    }
}

async function finanzasImprimirTicket(ventaData) {
    const { cabecera, productos, pagos } = ventaData;

    // Preparar el payload para el printer_receipt.py
    const payload = {
        printerName: 'Predeterminada del sistema',
        printerPaper: '80mm',
        receipt: {
            documentType: cabecera.tipoDoc || 'TICKET DE VENTA',
            saleId: cabecera.id_venta,
            dateLabel: new Date(cabecera.fechaVenta).toLocaleString('es-CL'),
            customerLabel: cabecera.nombreCliente || 'Cliente General',
            paymentMethod: pagos.map(p => p.metodoPago).join(' + '),
            total: parseNumber(cabecera.total),
            subtotal: parseNumber(cabecera.subtotal) || parseNumber(cabecera.total),
            iva: parseNumber(cabecera.iva) || 0,
            lineItems: productos.map(p => ({
                name: p.nombreProducto,
                quantityLabel: p.cantidadVenta,
                unitPrice: parseNumber(p.precioVenta),
                subtotal: parseNumber(p.subtotalLinea)
            })),
            footerMessage: 'Gracias por su compra'
        }
    };

    try {
        Swal.fire({
            title: 'Imprimiendo...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const result = await window.electronAPI.printReceipt(payload);

        if (result && result.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Ticket enviado a la impresora',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } else {
            throw new Error(result?.error || 'Error desconocido al imprimir');
        }
    } catch (error) {
        console.error('Error al imprimir:', error);
        Swal.fire('Error de impresion', error.message, 'error');
    }
}
async function finanzasAuditarMonto() {
    const targetInput = document.getElementById('fin-audit-amount');
    const target = Math.abs(parseNumber(targetInput?.value || 0));
    if (target <= 0) {
        Swal.fire('Error', 'Ingresa un monto válido para buscar.', 'warning');
        return;
    }

    const ventas = finanzasState.filtered;
    const matches = [];

    // 1. Single sales that match exactly in total or in a breakdown field
    ventas.forEach(v => {
        const total = parseNumber(v.total || v.monto_total || 0);
        const card = parseNumber(v.pago_tarjeta || 0);
        const cash = parseNumber(v.pago_efectivo || 0);
        const transfer = parseNumber(v.pago_transferencia || 0);

        if (total === target || card === target || cash === target || transfer === target) {
            matches.push({
                type: 'individual',
                ventas: [v],
                detail: `Venta #${v.id_venta || v.id} coincide exactamente con el monto.`
            });
        }
    });

    // 2. Pairs of sales that sum up to target
    for (let i = 0; i < ventas.length; i++) {
        for (let j = i + 1; j < ventas.length; j++) {
            const v1 = ventas[i];
            const v2 = ventas[j];
            const total1 = parseNumber(v1.total || v1.monto_total || 0);
            const total2 = parseNumber(v2.total || v2.monto_total || 0);

            if (total1 + total2 === target) {
                matches.push({
                    type: 'par',
                    ventas: [v1, v2],
                    detail: `La suma de las ventas #${v1.id_venta || v1.id} y #${v2.id_venta || v2.id} da el monto buscado.`
                });
            }
            
            // Also check card portions for pairs
            const card1 = parseNumber(v1.pago_tarjeta || 0);
            const card2 = parseNumber(v2.pago_tarjeta || 0);
            if (card1 > 0 && card2 > 0 && card1 + card2 === target) {
                matches.push({
                    type: 'par_tarjeta',
                    ventas: [v1, v2],
                    detail: `La suma de los pagos con TARJETA de las ventas #${v1.id_venta || v1.id} y #${v2.id_venta || v2.id} da el monto buscado.`
                });
            }
        }
    }

    if (matches.length === 0) {
        Swal.fire({
            title: 'Sin coincidencias',
            text: `No se encontraron ventas individuales ni pares que sumen exactly $${target.toLocaleString('es-CL')}.`,
            icon: 'info',
            confirmButtonColor: '#f97316'
        });
        return;
    }

    const html = `
        <div class="text-left space-y-4 max-h-[60vh] overflow-auto pr-2">
            <div class="flex items-center justify-between">
                <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Se encontraron ${matches.length} coincidencia(s)</p>
                <div class="text-[9px] font-black bg-gray-100 px-2 py-0.5 rounded-full text-gray-400">BUSCANDO EN ${ventas.length} VENTAS FILTRADAS</div>
            </div>
            ${matches.map((m, idx) => `
                <div class="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[9px] font-black uppercase">${m.type}</span>
                        <strong class="text-sm text-gray-900">$${target.toLocaleString('es-CL')}</strong>
                    </div>
                    <p class="text-xs text-gray-600 mb-3">${m.detail}</p>
                    <div class="space-y-1">
                        ${m.ventas.map(v => {
                            const fecha = v.fecha_venta || v.created_at || v.fechaVenta || '';
                            const dateStr = fecha ? new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) : '—';
                            const timeStr = fecha ? new Date(fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
                            const cajero = finanzasObtenerNombreCajero(v);
                            return `
                                <div class="flex flex-col gap-1 bg-white p-3 rounded-xl border border-orange-100/50">
                                    <div class="flex items-center justify-between">
                                        <span class="font-black text-gray-900 text-xs">Venta #${v.id_venta || v.id}</span>
                                        <span class="font-black text-orange-600 text-sm">$${(parseNumber(v.total || v.monto_total || 0)).toLocaleString('es-CL')}</span>
                                    </div>
                                    <div class="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                        <span><i class="bi bi-person-fill"></i> ${cajero}</span>
                                        <span><i class="bi bi-clock"></i> ${dateStr} ${timeStr}</span>
                                    </div>
                                    <button class="mt-1 w-full py-1 bg-gray-50 text-blue-600 hover:bg-blue-50 rounded-lg font-black uppercase text-[9px] transition-colors" onclick="Swal.close(); finanzasVerDetalleVenta(${v.id_venta || v.id})">
                                        Ver detalle de productos
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    Swal.fire({
        title: 'Auditoría de Descuadre',
        html: html,
        width: '500px',
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#111827'
    });
}

async function finanzasExportarPDF() {
    const { filtered } = finanzasState;
    if (!filtered.length) {
        Swal.fire('Atención', 'No hay datos para exportar con los filtros actuales.', 'info');
        return;
    }

    try {
        Swal.fire({
            title: 'Generando PDF...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Paisaje para más columnas
        
        const fechaFiltro = document.getElementById('fin-filtro-fecha')?.value || 'Hoy';
        const sucursalFiltro = document.getElementById('fin-filtro-sucursal')?.selectedOptions?.[0]?.textContent?.trim() || 'Todas';
        const cajeroFiltro = document.getElementById('fin-filtro-cajero')?.selectedOptions?.[0]?.textContent?.trim() || 'Todos';

        // Estilos y Logo
        doc.setFontSize(22);
        doc.setTextColor(249, 115, 22); // Orange 500
        doc.text('VALMU ECOSYSTEM', 14, 20);
        
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39); // Gray 900
        doc.text('Reporte de Auditoría de Ventas', 14, 30);
        
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128); // Gray 500
        doc.text(`Fecha: ${fechaFiltro} | Sucursal: ${sucursalFiltro} | Cajero: ${cajeroFiltro}`, 14, 38);
        doc.text(`Generado el: ${new Date().toLocaleString('es-CL')}`, 14, 44);

        // Totales en el PDF
        const totalMonto = filtered.reduce((s, v) => s + parseNumber(v.total || v.monto_total || 0), 0);
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text(`Total Recaudado: $${totalMonto.toLocaleString('es-CL')}`, 280, 44, { align: 'right' });

        const head = [['ID', 'Fecha/Hora', 'Sucursal', 'Cajero', 'Medio Pago', 'Desglose (EF/TRJ/TRF)', 'Total']];
        const body = filtered.map(v => {
            const fecha = v.fecha_venta || v.created_at || v.fechaVenta || '';
            const dateStr = fecha ? new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
            
            const ef = parseNumber(v.pago_efectivo || 0);
            const trj = parseNumber(v.pago_tarjeta || 0);
            const trf = parseNumber(v.pago_transferencia || 0);
            
            let desglose = '';
            if (ef > 0) desglose += `EF: $${ef.toLocaleString('es-CL')} `;
            if (trj > 0) desglose += `TRJ: $${trj.toLocaleString('es-CL')} `;
            if (trf > 0) desglose += `TRF: $${trf.toLocaleString('es-CL')}`;
            
            return [
                v.id_venta || v.id || '—',
                dateStr,
                v.nombre_sucursal || v.sucursal || '—',
                finanzasObtenerNombreCajero(v),
                finanzasNormalizarMetodoPago(v).toUpperCase(),
                desglose || 'S/D',
                `$${parseNumber(v.total || v.monto_total || 0).toLocaleString('es-CL')}`
            ];
        });

        doc.autoTable({
            startY: 50,
            head: head,
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [17, 24, 39], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { top: 50 },
            styles: { fontSize: 8, cellPadding: 3 }
        });

        const fileName = `reporte_ventas_${fechaFiltro.replace(/-/g, '')}_${new Date().getTime()}.pdf`;
        doc.save(fileName);
        Swal.close();
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        Swal.fire('Error', 'No se pudo generar el PDF. Revisa la consola.', 'error');
    }
}
