let dashboardRefreshTimer = null;
const DASHBOARD_LIVE_REFRESH_MS = 8000;
let dashboardInventoryRefreshListenerBound = false;
const ADMIN_TIMEZONE = 'America/Santiago';

function isWeightedDashboardProduct(value) {
    return value === true || value === 1 || value === '1';
}

function bindDashboardInventoryRefreshListener() {
    if (dashboardInventoryRefreshListenerBound) return;

    window.addEventListener('valmu:inventory-changed', () => {
        if (currentPage !== 'dashboard' || !isBodeguero()) {
            return;
        }

        void hydrateBodegueroDashboard();
    });

    dashboardInventoryRefreshListenerBound = true;
}

function normalizeBodegaLookupValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function formatBodegaLookupStock(quantity, esPesable) {
    const numericValue = Number(quantity || 0);
    return isWeightedDashboardProduct(esPesable)
        ? `${numericValue.toFixed(3)} Kg`
        : `${Math.round(numericValue).toLocaleString('es-CL')} un.`;
}

function parseInventoryStockValue(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const rawValue = String(value).trim();
    if (!rawValue) return 0;

    const cleanedValue = rawValue.replace(/[^0-9.,-]/g, '');
    if (!cleanedValue) return 0;

    const hasComma = cleanedValue.includes(',');
    const hasDot = cleanedValue.includes('.');

    let normalizedValue = cleanedValue;

    if (hasComma && hasDot) {
        if (cleanedValue.lastIndexOf(',') > cleanedValue.lastIndexOf('.')) {
            normalizedValue = cleanedValue.replace(/\./g, '').replace(/,/g, '.');
        } else {
            normalizedValue = cleanedValue.replace(/,/g, '');
        }
    } else if (hasComma) {
        normalizedValue = cleanedValue.replace(/,/g, '.');
    }

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatBodegaLookupPrice(value) {
    const numericValue = Number(value || 0);
    return `$${Math.round(numericValue).toLocaleString('es-CL')}`;
}

function renderBodegaLookupResults(term = '') {
    const container = document.getElementById('bodega-lookup-results');
    const status = document.getElementById('bodega-lookup-status');
    if (!container || !status) return;

    const normalizedTerm = normalizeBodegaLookupValue(term);
    if (!normalizedTerm) {
        status.textContent = 'Escanea con pistola o escribe nombre/código para consultar stock.';
        container.innerHTML = '<div class="text-sm text-gray-400">Aún no hay búsqueda activa.</div>';
        return;
    }

    const catalog = Array.isArray(window.bodegaLookupCatalog) ? window.bodegaLookupCatalog : [];
    const branchMatrix = window.bodegaLookupBranchMatrix instanceof Map ? window.bodegaLookupBranchMatrix : new Map();
    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);

    const matches = catalog
        .map((product) => {
            const normalizedName = normalizeBodegaLookupValue(product?.nombreProducto);
            const normalizedCode = normalizeBodegaLookupValue(product?.codigoBarras);
            const haystack = [normalizedName, normalizedCode].filter(Boolean).join(' ');
            if (!tokens.every((token) => haystack.includes(token))) return null;

            let score = 0;
            if (normalizedCode === normalizedTerm) score += 100;
            if (normalizedName === normalizedTerm) score += 80;
            if (normalizedCode.startsWith(normalizedTerm)) score += 30;
            if (normalizedName.startsWith(normalizedTerm)) score += 20;

            return { product, score };
        })
        .filter(Boolean)
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return String(left.product?.nombreProducto || '').localeCompare(String(right.product?.nombreProducto || ''), 'es', { sensitivity: 'base' });
        })
        .slice(0, 8);

    if (!matches.length) {
        status.textContent = `Sin resultados para "${term}".`;
        container.innerHTML = '<div class="text-sm text-red-500 font-medium">No se encontró ningún producto con ese nombre o código.</div>';
        return;
    }

    status.textContent = `${matches.length} coincidencia(s) encontradas para "${term}".`;
    container.innerHTML = matches.map(({ product }) => {
        const stockEntries = (branchMatrix.get(Number(product.id_producto)) || []).sort((left, right) =>
            String(left.branchName || '').localeCompare(String(right.branchName || ''), 'es', { sensitivity: 'base' })
        );
        const detailPrice = Number(product?.precioDetalle ?? product?.precio ?? 0);
        const wholesalePrice = Number(product?.precioMayor ?? 0);
        const offerPrice = Number(product?.precioOferta ?? 0);
        const priceCards = [
            `
                <div class="rounded-xl px-3 py-2 border border-orange-100 bg-orange-50/70">
                    <div class="text-[10px] uppercase tracking-widest text-gray-400 font-black">Precio venta</div>
                    <div class="text-sm font-black text-orange-700">${formatBodegaLookupPrice(detailPrice)}</div>
                </div>
            `
        ];

        if (wholesalePrice > 0) {
            priceCards.push(`
                <div class="rounded-xl px-3 py-2 border border-blue-100 bg-blue-50/80">
                    <div class="text-[10px] uppercase tracking-widest text-gray-400 font-black">Mayorista</div>
                    <div class="text-sm font-black text-blue-700">${formatBodegaLookupPrice(wholesalePrice)}</div>
                </div>
            `);
        }

        if (offerPrice > 0) {
            priceCards.push(`
                <div class="rounded-xl px-3 py-2 border border-pink-100 bg-pink-50/80">
                    <div class="text-[10px] uppercase tracking-widest text-gray-400 font-black">Oferta</div>
                    <div class="text-sm font-black text-pink-700">${formatBodegaLookupPrice(offerPrice)}</div>
                </div>
            `);
        }

        return `
            <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <div class="font-black text-gray-900">${product.nombreProducto}</div>
                        <div class="text-[11px] text-gray-400 font-mono">${product.codigoBarras || 'Sin código'}</div>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${isWeightedDashboardProduct(product.esPesable) ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}">
                        ${isWeightedDashboardProduct(product.esPesable) ? 'Pesable' : 'Unidad'}
                    </span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    ${priceCards.join('')}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${stockEntries.length ? stockEntries.map((entry) => `
                        <div class="rounded-xl px-3 py-2 border ${Number(entry.stock || 0) > 0 ? 'border-emerald-100 bg-emerald-50/70' : 'border-red-100 bg-red-50/70'}">
                            <div class="text-[10px] uppercase tracking-widest text-gray-400 font-black">${entry.branchName}</div>
                            <div class="text-sm font-black ${Number(entry.stock || 0) > 0 ? 'text-emerald-700' : 'text-red-700'}">${formatBodegaLookupStock(entry.stock, entry.esPesable)}</div>
                        </div>
                    `).join('') : '<div class="text-sm text-gray-400">Sin stock registrado en sucursales.</div>'}
                </div>
            </div>
        `;
    }).join('');
}

function bindBodegaLookup() {
    const input = document.getElementById('bodega-lookup-input');
    if (!input) return;

    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            renderBodegaLookupResults(input.value);
        }, 180);
    });

    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        renderBodegaLookupResults(input.value);
    });

    input.focus();
}

function formatDashboardMoney(value) {
    return `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;
}

function getChileDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return new Intl.DateTimeFormat('sv-SE', { timeZone: ADMIN_TIMEZONE }).format(date);
}

function parseDashboardDateValue(rawDate) {
    const value = String(rawDate || '').trim();
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return new Date(value.replace(' ', 'T'));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T12:00:00`);
    }

    if (/^\d{2}-\d{2}-\d{4}/.test(value)) {
        const p = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
        if (p) {
            return new Date(`${p[3]}-${p[2]}-${p[1]}T12:00:00`);
        }
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveApiData(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (payload?.data && typeof payload.data === 'object') return payload.data;
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') return payload;
    return null;
}

function renderAdminSalesSplitCards(target, metrics = {}) {
    if (!target) return;

    const caja = metrics?.caja || {};
    const despacho = metrics?.despacho || {};

    target.innerHTML = `
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <p class="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500">Caja</p>
                        <h3 class="text-xl font-black text-gray-900">Total caja de sucursales</h3>
                    </div>
                    <div class="h-11 w-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-xl shadow-md">
                        <i class="bi bi-shop"></i>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="rounded-xl border border-orange-100 bg-white px-4 py-3">
                        <span class="text-[10px] uppercase tracking-widest font-black text-gray-400">SII</span>
                        <strong class="block text-lg font-black text-gray-900 mt-1">${formatDashboardMoney(caja.ventasSII)}</strong>
                        <small class="block text-[11px] text-gray-400 mt-1">Solo caja</small>
                    </div>
                    <div class="rounded-xl border border-orange-100 bg-white px-4 py-3">
                        <span class="text-[10px] uppercase tracking-widest font-black text-gray-400">Internas</span>
                        <strong class="block text-lg font-black text-gray-900 mt-1">${formatDashboardMoney(caja.ventasInternas)}</strong>
                        <small class="block text-[11px] text-gray-400 mt-1">Solo caja</small>
                    </div>
                    <div class="rounded-xl border border-orange-100 bg-white px-4 py-3">
                        <span class="text-[10px] uppercase tracking-widest font-black text-gray-400">Ganancia</span>
                        <strong class="block text-lg font-black text-emerald-600 mt-1">${formatDashboardMoney(caja.gananciaNeta)}</strong>
                        <small class="block text-[11px] text-gray-400 mt-1">Solo caja</small>
                    </div>
                </div>
            </div>
            <div class="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <p class="text-[11px] font-black uppercase tracking-[0.2em] text-sky-500">Despacho</p>
                        <h3 class="text-xl font-black text-gray-900">Ventas por transporte</h3>
                    </div>
                    <div class="h-11 w-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-xl shadow-md">
                        <i class="bi bi-truck"></i>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="rounded-xl border border-sky-100 bg-white px-4 py-3">
                        <span class="text-[10px] uppercase tracking-widest font-black text-gray-400">SII</span>
                        <strong class="block text-lg font-black text-gray-900 mt-1">${formatDashboardMoney(despacho.ventasSII)}</strong>
                        <small class="block text-[11px] text-gray-400 mt-1">Despacho + en ruta</small>
                    </div>
                    <div class="rounded-xl border border-sky-100 bg-white px-4 py-3">
                        <span class="text-[10px] uppercase tracking-widest font-black text-gray-400">Internas</span>
                        <strong class="block text-lg font-black text-gray-900 mt-1">${formatDashboardMoney(despacho.ventasInternas)}</strong>
                        <small class="block text-[11px] text-gray-400 mt-1">Despacho + en ruta</small>
                    </div>
                    <div class="rounded-xl border border-sky-100 bg-white px-4 py-3">
                        <span class="text-[10px] uppercase tracking-widest font-black text-gray-400">Ganancia</span>
                        <strong class="block text-lg font-black text-emerald-600 mt-1">${formatDashboardMoney(despacho.gananciaNeta)}</strong>
                        <small class="block text-[11px] text-gray-400 mt-1">Despacho + en ruta</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAdminBranchSplitTable(target, rows = []) {
    if (!target) return;

    target.innerHTML = rows.length ? rows.map((row) => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3">
                <div class="font-bold text-gray-900">${row.nombreSucursal || 'Sucursal'}</div>
                <div class="text-[10px] text-gray-400">ID ${row.id_sucursal || '-'}</div>
            </td>
            <td class="py-3 text-right font-semibold text-orange-700">${formatDashboardMoney(row.ventasSIICaja)}</td>
            <td class="py-3 text-right font-semibold text-orange-700">${formatDashboardMoney(row.ventasInternasCaja)}</td>
            <td class="py-3 text-right font-semibold text-emerald-600">${formatDashboardMoney(row.gananciaCaja)}</td>
            <td class="py-3 text-right font-semibold text-sky-700">${formatDashboardMoney(row.ventasSIIDespacho)}</td>
            <td class="py-3 text-right font-semibold text-sky-700">${formatDashboardMoney(row.ventasInternasDespacho)}</td>
            <td class="py-3 text-right font-semibold text-emerald-600">${formatDashboardMoney(row.gananciaDespacho)}</td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="text-center py-10 text-gray-400 italic">No hay ventas registradas para hoy.</td></tr>';
}

async function renderDashboard() {
    bindDashboardInventoryRefreshListener();
    if (dashboardRefreshTimer) {
        clearInterval(dashboardRefreshTimer);
        dashboardRefreshTimer = null;
    }
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const user = getCurrentUser();
    const isBodeguero = Boolean(user) && window.isBodeguero ? window.isBodeguero() : Number(user?.id_rol) === 3;
    const assignedBranchName = getActiveBranchName();

    // Vista diferente para Bodeguero vs Admin
    if (isBodeguero) {
        contentArea.innerHTML = `
            <div class="dashboard-v2-container" style="padding: 0.5rem 0;">
                <!-- Header Bodeguero -->
                <div class="mb-6">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xl shadow-lg">
                            <i class="bi bi-box-seam"></i>
                        </div>
                        <div>
                            <h2 class="text-2xl font-black tracking-tight text-gray-900">Panel de Bodega</h2>
                            <p class="text-gray-400 text-sm">${assignedBranchName ? `Operando en <strong class="text-orange-600">${assignedBranchName}</strong>` : 'Gestión de inventario'}</p>
                        </div>
                    </div>
                </div>

                <!-- Acciones Rápidas -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <button class="group bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-left text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" onclick="window.adminNavigateToPage('products')">
                        <div class="flex items-center justify-between mb-3">
                            <div class="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                                <i class="bi bi-box-arrow-in-down"></i>
                            </div>
                            <i class="bi bi-arrow-right text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
                        </div>
                        <h3 class="text-base font-bold">Registrar Ingreso</h3>
                        <p class="text-xs text-white/70 mt-1">Carga factura y suma stock</p>
                    </button>
                    <button class="group bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-5 text-left text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" onclick="openTransferForm()">
                        <div class="flex items-center justify-between mb-3">
                            <div class="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                                <i class="bi bi-arrow-left-right"></i>
                            </div>
                            <i class="bi bi-arrow-right text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
                        </div>
                        <h3 class="text-base font-bold">Trasladar Stock</h3>
                        <p class="text-xs text-white/70 mt-1">Mover entre sucursales</p>
                    </button>
                    <button class="group bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-left text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" onclick="window.adminNavigateToPage('wastage')">
                        <div class="flex items-center justify-between mb-3">
                            <div class="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                                <i class="bi bi-trash3"></i>
                            </div>
                            <i class="bi bi-arrow-right text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
                        </div>
                        <h3 class="text-base font-bold">Declarar Mermas</h3>
                        <p class="text-xs text-white/70 mt-1">Roturas y vencimientos</p>
                    </button>
                    <button class="group bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-left text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" onclick="window.adminNavigateToPage('branches')">
                        <div class="flex items-center justify-between mb-3">
                            <div class="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                                <i class="bi bi-clipboard-check"></i>
                            </div>
                            <i class="bi bi-arrow-right text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
                        </div>
                        <h3 class="text-base font-bold">Revisar Inventario</h3>
                        <p class="text-xs text-white/70 mt-1">Ajustar stock sucursal</p>
                    </button>
                </div>

                <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between gap-4">
                        <div>
                            <h3 class="font-bold text-gray-900 flex items-center gap-2">
                                <i class="bi bi-upc-scan text-sky-600"></i>
                                Consultador de Productos
                            </h3>
                            <p class="text-xs text-gray-500 mt-1">Compatible con escáner tipo pistola: escanea o escribe el código y presiona Enter.</p>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="flex flex-col lg:flex-row gap-3 mb-3">
                            <input type="text" id="bodega-lookup-input" class="form-control" placeholder="Escanear o buscar por nombre/código de barras">
                            <button class="btn btn-primary" type="button" onclick="renderBodegaLookupResults(document.getElementById('bodega-lookup-input')?.value || '')">Consultar</button>
                        </div>
                        <p id="bodega-lookup-status" class="text-xs text-gray-500 mb-4">Preparando catálogo para consulta...</p>
                        <div id="bodega-lookup-results" class="grid gap-3">
                            <div class="text-sm text-gray-400">Cargando productos para consulta...</div>
                        </div>
                    </div>
                </div>

                <!-- Stats Grid Bodeguero -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Productos</span>
                            <div class="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <i class="bi bi-boxes"></i>
                            </div>
                        </div>
                        <h3 id="stat-bodega-total-productos" class="text-2xl font-black text-gray-900">-</h3>
                        <p class="text-xs text-gray-400 mt-1">En inventario</p>
                    </div>
                    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stock Crítico</span>
                            <div class="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                <i class="bi bi-exclamation-triangle"></i>
                            </div>
                        </div>
                        <h3 id="stat-low-stock" class="text-2xl font-black text-red-600">0</h3>
                        <p class="text-xs text-red-400 mt-1 font-medium">Requieren reposición</p>
                    </div>
                    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mermas Mes</span>
                            <div class="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                <i class="bi bi-graph-down"></i>
                            </div>
                        </div>
                        <h3 id="stat-bodega-mermas-mes" class="text-2xl font-black text-amber-600">0</h3>
                        <p class="text-xs text-gray-400 mt-1">Registradas este mes</p>
                    </div>
                </div>

                <!-- Tabla Stock Crítico -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-red-50/30">
                        <h3 class="font-bold text-gray-900 flex items-center gap-2">
                            <i class="bi bi-exclamation-triangle text-red-500"></i>
                            Productos con Stock Crítico
                        </h3>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requieren Reposición</span>
                    </div>
                    <div class="table-shell" style="max-height: 350px; overflow-y: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Sucursal</th>
                                    <th style="text-align: right;">Stock</th>
                                    <th style="text-align: center;">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="dashboard-low-stock-list">
                                <tr><td colspan="4" class="text-center py-10 text-gray-400 italic">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        void hydrateBodegueroDashboard();

        dashboardRefreshTimer = setInterval(() => {
            if (currentPage === 'dashboard') {
                void hydrateBodegueroDashboard();
            } else {
                clearInterval(dashboardRefreshTimer);
                dashboardRefreshTimer = null;
            }
        }, DASHBOARD_LIVE_REFRESH_MS);

        return;
    }

    // Vista Admin (original)
    contentArea.innerHTML = `
        <div class="dashboard-v2-container" style="padding: 0.5rem 0;">
            <!-- Welcome Section -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold tracking-tight text-gray-900">Panel de Control</h2>
                <p class="text-gray-500 text-sm mt-1">Bienvenido de nuevo. Aquí tienes el rendimiento de tu negocio hoy.</p>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ventas Hoy</span>
                        <div class="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                            <i class="bi bi-currency-dollar"></i>
                        </div>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="stat-sales-today" class="text-2xl font-bold text-gray-900">$0</h3>
                    </div>
                    <p id="stat-sales-count" class="text-xs text-gray-400 mt-1">Cero transacciones</p>
                </div>

                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilidad bruta</span>
                        <div class="h-8 w-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                            <i class="bi bi-graph-up-arrow"></i>
                        </div>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="stat-profit-today" class="text-2xl font-bold text-gray-900">$0</h3>
                    </div>
                    <p class="text-xs text-green-500 mt-1 font-medium italic">Margen real estimado</p>
                </div>

                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inversion Stock</span>
                        <div class="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                            <i class="bi bi-safe2"></i>
                        </div>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="stat-inventory-value" class="text-2xl font-bold text-gray-900">$0</h3>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">Valorizacion segun costo</p>
                </div>

                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Critico</span>
                        <div class="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                            <i class="bi bi-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="stat-low-stock" class="text-2xl font-bold text-gray-900">0</h3>
                    </div>
                    <p class="text-xs text-red-400 mt-1 font-medium">Requiere reposicion pronto</p>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-6">
                <!-- Main Chart -->
                <div class="col-span-12 lg:col-span-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="font-bold text-gray-900">Tendencia Semanal</h3>
                        <div class="flex gap-2">
                            <span class="flex items-center gap-1 text-[10px] text-gray-400"><span class="w-2 h-2 rounded-full bg-orange-500"></span>Ventas ($)</span>
                        </div>
                    </div>
                    <div style="height: 300px; position: relative;">
                        <canvas id="dashboard-sales-chart"></canvas>
                    </div>
                </div>

                <!-- Recent Activity List -->
                <div class="col-span-12 lg:col-span-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
                    <h3 class="font-bold text-gray-900 mb-6">Ultimas Ventas</h3>
                    <div class="flex-1 overflow-y-auto pr-1" style="max-height: 320px;" id="dashboard-recent-list">
                        <div class="flex flex-col gap-4">
                            <!-- Items populated JS -->
                             <p class="text-center text-gray-400 text-sm py-10">Cargando actividad...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div class="flex items-center justify-between gap-3 mb-5">
                    <div>
                        <h3 class="font-bold text-gray-900">Reporte Separado por Canal</h3>
                        <p class="text-sm text-gray-500 mt-1">Resumen diferenciado entre ventas de caja y ventas por despacho.</p>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Admin</span>
                </div>
                <div id="dashboard-sales-split-cards">
                    <div class="text-sm text-gray-400">Cargando resumen por canal...</div>
                </div>
            </div>

            <div class="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between gap-3">
                    <div>
                        <h3 class="font-bold text-gray-900">Detalle por Sucursal</h3>
                        <p class="text-sm text-gray-500 mt-1">Separación de Casa Matriz, Bodega y despacho dentro de cada sucursal.</p>
                    </div>
                </div>
                <div class="table-shell" style="max-height: 320px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Sucursal</th>
                                <th style="text-align: right;">Caja SII</th>
                                <th style="text-align: right;">Caja Internas</th>
                                <th style="text-align: right;">Caja Ganancia</th>
                                <th style="text-align: right;">Despacho SII</th>
                                <th style="text-align: right;">Despacho Internas</th>
                                <th style="text-align: right;">Despacho Ganancia</th>
                            </tr>
                        </thead>
                        <tbody id="dashboard-branch-split-list">
                            <tr><td colspan="7" class="text-center py-10 text-gray-400 italic">Cargando resumen por sucursal...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- New Row: Critical Stock -->
            <div class="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-red-50/30">
                    <h3 class="font-bold text-gray-900 flex items-center gap-2">
                        <i class="bi bi-exclamation-triangle text-red-500"></i>
                        Productos con Stock Crítico
                    </h3>
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requieren Reposición</span>
                </div>
                <div class="table-shell" style="max-height: 300px; overflow-y: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Sucursal</th>
                                <th style="text-align: right;">Stock</th>
                                <th style="text-align: center;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="dashboard-low-stock-list">
                            <tr><td colspan="4" class="text-center py-10 text-gray-400 italic">No hay alertas de stock</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    void hydrateDashboard();

    // Polling cada 60 segundos para historial "en vivo"
    dashboardRefreshTimer = setInterval(() => {
        if (currentPage === 'dashboard') {
            void hydrateDashboard();
        } else {
            clearInterval(dashboardRefreshTimer);
            dashboardRefreshTimer = null;
        }
    }, 60000);
}

async function hydrateDashboard() {
    const token = getAuthToken();
    const hoyStr = getChileDateKey(new Date());
    const bodegueroMode = isBodeguero();
    const activeBranchId = getActiveBranchId();

    try {
        const [kpisRes, branchSalesRes] = await Promise.all([
            apiRequest({ endpoint: '/reportes/kpis-diarios', token }),
            apiRequest({ endpoint: '/reportes/ventas-por-sucursal', token })
        ]);

        const splitMetrics = resolveApiData(kpisRes) || {};
        const branchSplitRows = resolveApiData(branchSalesRes) || [];

        // Helper: parse localized numbers like "9.215.063.872" or "1,234.56"
        const parseNumber = (v) => {
            if (v === null || v === undefined) return 0;
            if (typeof v === 'number') return v;
            let s = String(v).trim();
            if (s === '') return 0;
            // remove currency symbols and spaces
            s = s.replace(/[^0-9.,-]/g, '');
            // If contains both dot and comma, assume dot is thousand and comma decimal (e.g. "1.234,56")
            if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
                s = s.replace(/\./g, ''); // remove thousand dots
                s = s.replace(/,/g, '.'); // comma -> decimal
            } else if (s.indexOf(',') !== -1 && s.indexOf('.') === -1) {
                // only comma present, assume decimal separator
                s = s.replace(/,/g, '.');
            } else {
                // only dots or only digits: remove thousand separators if any (common in locales using dots)
                // e.g. "1.000" could be 1000 or 1.0; best-effort: if there are more than 1 digit after last dot assume thousand separators
                const parts = s.split('.');
                if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                    // treat dots as thousand separators
                    s = s.replace(/\./g, '');
                }
            }
            const n = parseFloat(s);
            return Number.isFinite(n) ? n : 0;
        };
        // 1. Fetch data
        const [prodRes, salesRes, branchRes] = await Promise.all([
            // request a sufficiently large product page to avoid truncation; API should ideally support pagination
            apiRequest({ endpoint: '/productos?limit=10000', token }),
            apiRequest({ endpoint: '/ventas?all=true&limit=100000', token }),
            apiRequest({ endpoint: '/sucursales', token })
        ]);

        const products = Array.isArray(prodRes?.data) ? prodRes.data : [];
        const sales = Array.isArray(salesRes?.data) ? salesRes.data : (Array.isArray(salesRes) ? salesRes : []);
        const allBranches = Array.isArray(branchRes?.data) ? branchRes.data : [];
        const branches = bodegueroMode && activeBranchId
            ? allBranches.filter((branch) => Number(branch.id_sucursal) === Number(activeBranchId))
            : allBranches;

        // 2. Calculations
        const productMap = {};
        products.forEach(p => {
            productMap[p.id_producto] = { costo: parseNumber(p.precioCosto) || 0, stock: 0 };
        });

        let totalValue = 0;
        let productsWithLowStock = 0;

        const inventoryPromises = branches.map(b => apiRequest({ endpoint: `/productos/inventario?id_sucursal=${b.id_sucursal}`, token }));
        const invResults = await Promise.all(inventoryPromises);

        invResults.forEach(res => {
            const stockItems = Array.isArray(res?.data) ? res.data : [];
            stockItems.forEach(item => {
                const stock = parseNumber(item.stockActual || item.cantidad || item.stock || 0);
                const prodKey = item.id_producto;
                // Prefer costo/price from inventory item if provided, otherwise fall back to product master data
                const itemCosto = parseNumber(item.precioCosto || item.precio || item.costo || 0) || (productMap[prodKey] ? productMap[prodKey].costo : 0);
                if (productMap[prodKey]) {
                    productMap[prodKey].stock += stock;
                    totalValue += (stock * itemCosto);
                } else {
                    // If product not found in master list, still include its valuation using itemCosto
                    totalValue += (stock * itemCosto);
                }
            });
        });

        // Count low stock globally
        const lowStockThreshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
        const criticalItems = [];

        invResults.forEach((res, index) => {
            const branch = branches[index];
            const stockItems = Array.isArray(res?.data) ? res.data : [];
            stockItems.forEach(item => {
                const stock = parseNumber(item.stockActual || item.cantidad || item.stock || 0);
                if (stock >= 0 && stock <= lowStockThreshold) {
                    criticalItems.push({
                        ...item,
                        id_sucursal: branch.id_sucursal,
                        branchName: branch.nombreSucursal,
                        stock,
                        esPesable: isWeightedDashboardProduct(item?.esPesable)
                    });
                }
            });
        });

        productsWithLowStock = criticalItems.length;

        let todaySales = 0;
        let todayProfit = 0;
        let todayCount = 0;

        // Last 7 days aggregation for chart
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(12, 0, 0, 0);
            last7Days.push(getChileDateKey(d));
        }
        const salesByDay = last7Days.reduce((acc, date) => ({ ...acc, [date]: 0 }), {});

        sales.forEach(s => {
            const rawDate = (s.fecha_venta || s.fechaVenta || s.created_at || '');
            if (!rawDate) return;

            const dateObj = parseDashboardDateValue(rawDate);
            if (!dateObj) return;

            const date = getChileDateKey(dateObj);
            const total = Number(s.total || s.monto_total || 0);

            if (salesByDay[date] !== undefined) {
                salesByDay[date] += total;
            }

            if (date === hoyStr && (s.estado || s.status || '').toLowerCase() !== 'anulada') {
                todaySales += total;
                todayCount++;
                const cost = Number(s.costo_total) || (total * 0.78); // Estimate if not present
                todayProfit += (total - cost);
            }
        });

        // 3. UI Update
        const salesEl = document.getElementById('stat-sales-today');
        const countEl = document.getElementById('stat-sales-count');
        const profitEl = document.getElementById('stat-profit-today');
        const inventoryEl = document.getElementById('stat-inventory-value');
        const lowStockEl = document.getElementById('stat-low-stock');
        const splitCards = document.getElementById('dashboard-sales-split-cards');
        const branchSplitTable = document.getElementById('dashboard-branch-split-list');

        if (salesEl) salesEl.textContent = `$${todaySales.toLocaleString('es-CL')}`;
        if (countEl) countEl.textContent = `${todayCount} tickets registrados`;
        if (profitEl) profitEl.textContent = `$${Math.round(todayProfit).toLocaleString('es-CL')}`;
        if (inventoryEl) {
            const fmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
            inventoryEl.textContent = `$${fmt.format(Math.round(totalValue))}`;
        }
        if (lowStockEl) lowStockEl.textContent = productsWithLowStock;
        renderAdminSalesSplitCards(splitCards, splitMetrics);
        renderAdminBranchSplitTable(branchSplitTable, Array.isArray(branchSplitRows) ? branchSplitRows : []);

        // Recent Sales List
        const recentList = document.getElementById('dashboard-recent-list');
        if (recentList) {
            const recent = sales.slice(0, 10);
            recentList.innerHTML = recent.length ? recent.map(s => `
                <div class="flex items-center justify-between group">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center border border-gray-100">
                            <i class="bi bi-receipt-cutoff"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">Ticket ${s.id_venta || s.folio || s.folioDocumento || s.id || '#'}</p>
                            <p class="text-[10px] text-gray-400">${(s.fecha_venta || s.fechaVenta || s.created_at || '').slice(11, 16)} • ${s.medio_pago || 'Efectivo'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-black text-gray-900">$${(Number(s.total || s.monto_total || 0)).toLocaleString('es-CL')}</p>
                        <span class="text-[9px] uppercase font-bold text-green-500">Completada</span>
                    </div>
                </div>
            `).join('') : '<p class="text-center text-gray-400 py-10">Sin ventas realizadas</p>';
        }

        // Critical Stock List
        const lowStockTbody = document.getElementById('dashboard-low-stock-list');
        if (lowStockTbody) {
            lowStockTbody.innerHTML = criticalItems.length ? criticalItems.map(item => `
                <tr class="hover:bg-red-50/20 transition-colors">
                    <td class="py-3">
                        <div class="font-bold text-gray-900">${item.nombreProducto}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${item.codigoBarras || 'S/C'}</div>
                    </td>
                    <td class="py-3 text-sm text-gray-600">${item.branchName}</td>
                    <td class="py-3 text-right">
                        <span class="px-2 py-0.5 rounded text-sm font-black text-red-600 bg-red-50 border border-red-100">
                            ${isWeightedDashboardProduct(item.esPesable) ? item.stock.toFixed(3) : Math.round(item.stock)} 
                            <small class="font-normal opacity-50">${isWeightedDashboardProduct(item.esPesable) ? 'Kg' : 'un.'}</small>
                        </span>
                    </td>
                    <td class="py-3 text-center">
                        <button class="btn btn-sm btn-dashboard-add-stock" 
                                style="background:#059669;color:#fff;padding:4px 10px;font-size:11px;"
                                data-id="${item.id_producto}" 
                                data-branch="${item.id_sucursal}"
                                data-name="${item.nombreProducto}"
                                data-pesable="${isWeightedDashboardProduct(item.esPesable) ? '1' : '0'}"
                                data-stock="${item.stock}"
                                title="Agregar stock">
                            <i class="bi bi-plus-lg"></i> Agregar
                        </button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="4" class="text-center py-10 text-gray-400 italic">Inventario saludable • No hay alertas</td></tr>';

            // Bind add stock buttons
            bindDashboardAddStockButtons();
        }

        // Initialize Chart
        initDashboardChart(last7Days, Object.values(salesByDay));

    } catch (error) {
        console.error('Error hydrating dashboard:', error);
    }
}

function initDashboardChart(labels, data) {
    const ctx = document.getElementById('dashboard-sales-chart');
    if (!ctx) return;

    // Destroy existing if any? Chart.js manages it but renderer reload might need it.
    if (window.salesChartInstance) window.salesChartInstance.destroy();

    const displayLabels = labels.map(l => {
        const d = new Date(l + 'T12:00:00');
        return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
    });

    // Ensure data are numbers and safe
    const numericData = Array.isArray(data) ? data.map(d => Number(d) || 0) : [];
    const numberFormatter = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

    window.salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Ventas Diarias',
                data: numericData,
                backgroundColor: 'rgba(249, 115, 22, 0.8)',
                hoverBackgroundColor: 'rgba(234, 88, 12, 1)',
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 10,
                    titleFont: { size: 12 },
                    bodyFont: { size: 14, weight: 'bold' },
                    callbacks: {
                        label: (ctx) => ` $${numberFormatter.format(Number(ctx.raw) || 0)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6', drawBorder: false },
                    ticks: {
                        color: '#9ca3af',
                        font: { size: 10 },
                        callback: (v) => '$' + numberFormatter.format(Number(v) || 0)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af', font: { size: 10 } }
                }
            }
        }
    });
}

function bindDashboardAddStockButtons() {
    document.querySelectorAll('.btn-dashboard-add-stock').forEach(btn => {
        btn.addEventListener('click', async () => {
            const productId = parseInt(btn.dataset.id, 10);
            const branchId = parseInt(btn.dataset.branch, 10);
            const productName = btn.dataset.name;
            const esPesable = btn.dataset.pesable === '1';
            const currentStock = parseFloat(btn.dataset.stock) || 0;

            const { value: cantidad } = await Swal.fire({
                title: 'Agregar Stock',
                html: `
                    <div style="text-align:left;">
                        <p class="text-sm text-gray-600 mb-3"><strong>${productName}</strong></p>
                        <p class="text-xs text-gray-400 mb-4">Stock actual: <strong>${esPesable ? currentStock.toFixed(3) + ' Kg' : Math.round(currentStock) + ' un.'}</strong></p>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Cantidad a agregar</label>
                        <input id="swal-cantidad" type="number" class="swal2-input" 
                               placeholder="${esPesable ? 'Ej: 5.500' : 'Ej: 20'}" 
                               min="0" step="${esPesable ? '0.001' : '1'}" 
                               style="width:100%;margin:0;">
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-plus-lg"></i> Agregar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#059669',
                preConfirm: () => {
                    const val = document.getElementById('swal-cantidad').value;
                    const num = parseFloat(val);
                    if (!val || isNaN(num) || num <= 0) {
                        Swal.showValidationMessage('Ingresa una cantidad válida mayor a 0');
                        return false;
                    }
                    return num;
                }
            });

            if (cantidad) {
                const token = getAuthToken();
                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';

                try {
                    // Calcular nueva cantidad total (stock actual + cantidad a agregar)
                    const nuevaCantidad = currentStock + cantidad;

                    console.log('Enviando ajuste:', { id_producto: productId, id_sucursal: branchId, nuevaCantidad, motivoAjuste: 'SOBRANTE' });

                    const res = await apiRequest({
                        endpoint: '/productos/inventario',
                        method: 'PUT',
                        body: {
                            id_producto: productId,
                            id_sucursal: branchId,
                            nuevaCantidad: nuevaCantidad,
                            motivoAjuste: 'SOBRANTE'
                        },
                        token
                    });

                    console.log('Respuesta:', res);

                    if (res.ok || res.mensaje || res.message || (res && !res.error)) {
                        Toast.fire({
                            icon: 'success',
                            title: `+${esPesable ? cantidad.toFixed(3) + ' Kg' : cantidad + ' un.'} agregados`
                        });

                        // Refresh dashboard data según el rol
                        if (isBodeguero()) {
                            void hydrateBodegueroDashboard();
                        } else {
                            void hydrateDashboard();
                        }
                    } else {
                        throw new Error(res.error || res.data?.error || 'Error al actualizar');
                    }

                } catch (error) {
                    console.error('Error adding stock:', error);
                    Toast.fire({ icon: 'error', title: error.message || 'Error al agregar stock' });
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        });
    });
}

// Dashboard específico para Bodeguero
async function hydrateBodegueroDashboard() {
    const token = getAuthToken();
    const activeBranchId = getActiveBranchId();

    try {
        // Obtener sucursales y filtrar por la asignada
        const branchRes = await apiRequest({ endpoint: '/sucursales', token });
        const allBranches = Array.isArray(branchRes?.data) ? branchRes.data : [];
        const branches = activeBranchId
            ? allBranches.filter((branch) => Number(branch.id_sucursal) === Number(activeBranchId))
            : allBranches;
        const lookupBranches = allBranches;

        // Obtener inventario
        const inventoryPromises = branches.map(b =>
            apiRequest({ endpoint: `/productos/inventario?id_sucursal=${b.id_sucursal}`, token })
        );
        const invResults = await Promise.all(inventoryPromises);
        const lookupInventoryPromises = lookupBranches.map((branch) =>
            apiRequest({ endpoint: `/productos/inventario?id_sucursal=${branch.id_sucursal}`, token })
        );
        const lookupInventoryResults = await Promise.all(lookupInventoryPromises);
        const productRes = await apiRequest({ endpoint: '/productos?limit=10000&page=1&offset=0', token });
        const lookupCatalog = Array.isArray(productRes?.data) ? productRes.data : [];
        const lookupMatrix = new Map();

        lookupInventoryResults.forEach((res, index) => {
            const branch = lookupBranches[index];
            const stockItems = Array.isArray(res?.data) ? res.data : [];

            stockItems.forEach((item) => {
                const productId = Number(item?.id_producto);
                if (!productId) return;

                const currentEntries = lookupMatrix.get(productId) || [];
                currentEntries.push({
                    id_sucursal: branch?.id_sucursal,
                    branchName: branch?.nombreSucursal || 'Sucursal',
                    stock: parseInventoryStockValue(item.stockActual ?? item.cantidad ?? item.stock ?? 0),
                    esPesable: isWeightedDashboardProduct(item?.esPesable)
                });
                lookupMatrix.set(productId, currentEntries);
            });
        });

        window.bodegaLookupCatalog = lookupCatalog;
        window.bodegaLookupBranchMatrix = lookupMatrix;

        // Contar productos y stock crítico
        const lowStockThreshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
        const criticalItems = [];
        let totalProductos = 0;

        invResults.forEach((res, index) => {
            const branch = branches[index];
            const stockItems = Array.isArray(res?.data) ? res.data : [];
            totalProductos += stockItems.length;

            stockItems.forEach(item => {
                const stock = parseInventoryStockValue(item.stockActual ?? item.cantidad ?? item.stock ?? 0);
                if (stock >= 0 && stock <= lowStockThreshold) {
                    criticalItems.push({
                        ...item,
                        id_sucursal: branch.id_sucursal,
                        branchName: branch.nombreSucursal,
                        stock
                    });
                }
            });
        });

        // Actualizar stats
        const statTotalProductos = document.getElementById('stat-bodega-total-productos');
        const statLowStock = document.getElementById('stat-low-stock');
        const statMermasMes = document.getElementById('stat-bodega-mermas-mes');

        if (statTotalProductos) statTotalProductos.textContent = totalProductos.toLocaleString('es-CL');
        if (statLowStock) statLowStock.textContent = criticalItems.length;

        // Intentar obtener mermas del mes
        try {
            const mermasRes = await apiRequest({ endpoint: '/productos/mermas', token, silentNonJson: true });
            const mermas = Array.isArray(mermasRes?.data) ? mermasRes.data : (Array.isArray(mermasRes) ? mermasRes : []);

            const now = new Date();
            const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const mermasMes = mermas.filter(m => {
                const fecha = String(m.fechaMov || m.fecha || m.created_at || '').slice(0, 7);
                const tipo = String(m.tipoMovimiento || m.tipo || '').toUpperCase();
                return fecha === mesActual && tipo === 'MERMA';
            }).length;

            if (statMermasMes) statMermasMes.textContent = mermasMes;
        } catch (_e) {
            if (statMermasMes) statMermasMes.textContent = '-';
        }

        // Renderizar tabla de stock crítico
        const lowStockTbody = document.getElementById('dashboard-low-stock-list');
        if (lowStockTbody) {
            lowStockTbody.innerHTML = criticalItems.length ? criticalItems.map(item => `
                <tr class="hover:bg-red-50/20 transition-colors">
                    <td class="py-3">
                        <div class="font-bold text-gray-900">${item.nombreProducto}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${item.codigoBarras || 'S/C'}</div>
                    </td>
                    <td class="py-3 text-sm text-gray-600">${item.branchName}</td>
                    <td class="py-3 text-right">
                        <span class="px-2 py-0.5 rounded text-sm font-black text-red-600 bg-red-50 border border-red-100">
                            ${isWeightedDashboardProduct(item.esPesable) ? item.stock.toFixed(3) : Math.round(item.stock)} 
                            <small class="font-normal opacity-50">${isWeightedDashboardProduct(item.esPesable) ? 'Kg' : 'un.'}</small>
                        </span>
                    </td>
                    <td class="py-3 text-center">
                        <button class="btn btn-sm btn-dashboard-add-stock" 
                                style="background:#059669;color:#fff;padding:4px 10px;font-size:11px;"
                                data-id="${item.id_producto}" 
                                data-branch="${item.id_sucursal}"
                                data-name="${item.nombreProducto}"
                                data-pesable="${isWeightedDashboardProduct(item.esPesable) ? '1' : '0'}"
                                data-stock="${item.stock}"
                                title="Agregar stock">
                            <i class="bi bi-plus-lg"></i> Agregar
                        </button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="4" class="text-center py-10 text-gray-400 italic">Inventario saludable • No hay alertas</td></tr>';

            bindDashboardAddStockButtons();
        }

        bindBodegaLookup();
        renderBodegaLookupResults(document.getElementById('bodega-lookup-input')?.value || '');

    } catch (error) {
        console.error('Error hydrating bodeguero dashboard:', error);
    }
}
