let dashboardRefreshTimer = null;

async function renderDashboard() {
    if (dashboardRefreshTimer) {
        clearInterval(dashboardRefreshTimer);
        dashboardRefreshTimer = null;
    }
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const user = getCurrentUser();
    const isBodeguero = user && Number(user.id_rol) === 3;

    contentArea.innerHTML = `
        <div class="dashboard-v2-container" style="padding: 0.5rem 0;">
            <!-- Welcome Section -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold tracking-tight text-gray-900">Panel de Control</h2>
                <p class="text-gray-500 text-sm mt-1">${isBodeguero ? 'Resumen de inventario y stock crítico.' : 'Bienvenido de nuevo. Aquí tienes el rendimiento de tu negocio hoy.'}</p>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${isBodeguero ? 'hidden' : ''}">
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

                <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${isBodeguero ? 'hidden' : ''}">
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

            <div class="grid grid-cols-12 gap-6 ${isBodeguero ? 'hidden' : ''}">
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

            <!-- New Row: Critical Stock -->
            <div class="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                                <th style="text-align: right;">Stock Actual</th>
                            </tr>
                        </thead>
                        <tbody id="dashboard-low-stock-list">
                            <tr><td colspan="3" class="text-center py-10 text-gray-400 italic">No hay alertas de stock</td></tr>
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
    const today = new Date();
    const hoyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    try {
        // 1. Fetch data
        const [prodRes, salesRes, branchRes] = await Promise.all([
            apiRequest({ endpoint: '/productos?limit=2000', token }),
            apiRequest({ endpoint: '/ventas', token }),
            apiRequest({ endpoint: '/sucursales', token })
        ]);

        const products = Array.isArray(prodRes?.data) ? prodRes.data : [];
        const sales = Array.isArray(salesRes?.data) ? salesRes.data : (Array.isArray(salesRes) ? salesRes : []);
        const branches = Array.isArray(branchRes?.data) ? branchRes.data : [];

        // 2. Calculations
        const productMap = {};
        products.forEach(p => {
            productMap[p.id_producto] = { costo: Number(p.precioCosto) || 0, stock: 0 };
        });

        let totalValue = 0;
        let productsWithLowStock = 0;

        const inventoryPromises = branches.map(b => apiRequest({ endpoint: `/productos/inventario?id_sucursal=${b.id_sucursal}`, token }));
        const invResults = await Promise.all(inventoryPromises);

        invResults.forEach(res => {
            const stockItems = Array.isArray(res?.data) ? res.data : [];
            stockItems.forEach(item => {
                const stock = Number(item.stockActual || 0);
                if (productMap[item.id_producto]) {
                    productMap[item.id_producto].stock += stock;
                    totalValue += (stock * productMap[item.id_producto].costo);
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
                const stock = parseFloat(item.stockActual || item.cantidad || 0);
                if (stock >= 0 && stock <= lowStockThreshold) {
                    criticalItems.push({
                        ...item,
                        branchName: branch.nombreSucursal,
                        stock
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
            last7Days.push(d.toISOString().slice(0, 10));
        }
        const salesByDay = last7Days.reduce((acc, date) => ({ ...acc, [date]: 0 }), {});

        sales.forEach(s => {
            const rawDate = (s.fecha_venta || s.fechaVenta || s.created_at || '');
            if (!rawDate) return;

            // Robust UTC-aware parsing
            let normalizedDate = rawDate;
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate)) {
                normalizedDate = rawDate.replace(' ', 'T') + 'Z'; // Force UTC
            } else if (/^\d{2}-\d{2}-\d{4}/.test(rawDate)) {
                const p = rawDate.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
                normalizedDate = `${p[3]}-${p[2]}-${p[1]}T00:00:00Z`;
            }

            const dateObj = new Date(normalizedDate);
            if (isNaN(dateObj.getTime())) return;

            const date = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
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

        if (salesEl) salesEl.textContent = `$${todaySales.toLocaleString('es-CL')}`;
        if (countEl) countEl.textContent = `${todayCount} tickets registrados`;
        if (profitEl) profitEl.textContent = `$${Math.round(todayProfit).toLocaleString('es-CL')}`;
        if (inventoryEl) inventoryEl.textContent = `$${Math.round(totalValue).toLocaleString('es-CL')}`;
        if (lowStockEl) lowStockEl.textContent = productsWithLowStock;

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
                            <p class="text-sm font-bold text-gray-800">Folio ${s.folio || s.folioDocumento || '#' + (s.id_venta || s.ticket_id)}</p>
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
                            ${item.esPesable ? item.stock.toFixed(3) : Math.round(item.stock)} 
                            <small class="font-normal opacity-50">${item.esPesable ? 'Kg' : 'un.'}</small>
                        </span>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="3" class="text-center py-10 text-gray-400 italic">Inventario saludable • No hay alertas</td></tr>';
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

    window.salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Ventas Diarias',
                data: data,
                backgroundColor: 'rgba(249, 115, 22, 0.8)',
                hoverBackgroundColor: 'rgba(234, 88, 12, 1)',
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 24
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
                        label: (ctx) => ` $${ctx.raw.toLocaleString('es-CL')}`
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
                        callback: (v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)
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
