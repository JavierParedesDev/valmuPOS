let mermasState = {
    selectedBranchId: null,
    products: [],
    history: []
};

async function renderMermas() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const activeBranchId = getActiveBranchId();
    const activeBranchName = getActiveBranchName();
    const bodegueroMode = isBodeguero() && activeBranchId;

    contentArea.innerHTML = `
        <div class="action-bar" style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem 2rem; border-radius: 16px; margin-bottom: 2rem; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.75rem; color: white; font-size: 1.5rem;">
                    <i class="bi bi-trash" style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 12px; font-size: 1.2rem;"></i> 
                    Gestión de Mermas
                </h2>
                <p style="margin-top: 0; font-size: 0.95rem; color: rgba(255,255,255,0.8); margin-left: 3.2rem;">
                    ${bodegueroMode ? `Registro operativo de pérdidas para ${activeBranchName || 'tu sucursal'}.` : 'Control de pérdidas, roturas y ajustes de inventario.'}
                </p>
            </div>
            <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
                <div id="mermas-branch-container" class="${bodegueroMode ? 'hidden' : ''}" style="min-width:280px; position: relative;">
                    <i class="bi bi-shop" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: white; pointer-events: none; z-index: 2;"></i>
                    <select id="mermas-branch-select" class="form-control" onchange="mermasCambiarSucursal(this.value)" style="appearance: none; -webkit-appearance: none; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 0.6rem 2.5rem; font-weight: 600; color: white; cursor: pointer; outline: none; width: 100%;">
                        <option value="" style="color: #1e293b;">Desconectado...</option>
                    </select>
                    <i class="bi bi-chevron-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: white; pointer-events: none; z-index: 2;"></i>
                </div>
                <button class="btn" type="button" onclick="mermasAccionPrincipal()" style="background: white; color: #4f46e5; font-weight: bold; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 0.65rem 1.25rem;">
                    <i class="bi bi-plus-lg"></i> Registrar merma
                </button>
            </div>
        </div>

        <div id="mermas-empty-state" class="glass-panel" style="padding:3rem; text-align:center; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
            <i class="bi bi-shop text-muted" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
            <h3 style="font-size:1.2rem; font-weight:800; color: #1e293b; margin-bottom:0.75rem;">Sucursal no seleccionada</h3>
            <p class="text-muted" style="max-width: 400px; margin: 0 auto;">${bodegueroMode ? 'Estamos preparando el inventario de tu sucursal para comenzar el registro de mermas.' : 'Selecciona una sucursal en el menú superior para cargar el inventario y el historial de mermas.'}</p>
        </div>

        <div id="mermas-main-area" class="hidden">
            <div id="mermas-alerts-panel" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1.5rem; margin-bottom:1.5rem;"></div>

            <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <div class="form-group" style="margin:0;">
                    <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block;">Buscar producto para dar de baja</label>
                    <div style="position: relative;">
                        <i class="bi bi-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                        <input type="text" id="mermas-search" class="form-control" placeholder="Escribe el nombre o escanea el código de barras..." oninput="mermasFiltrar()" style="padding-left: 2.5rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px;">
                    </div>
                </div>
            </div>

            <div class="glass-panel" style="margin-bottom:1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b;">Inventario Actual</h3>
                </div>
                <div class="table-responsive" style="max-height: 40vh; overflow-y: auto;">
                    <table class="data-table w-full" style="border: none; width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th class="text-left" style="padding: 1rem 1.5rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Producto</th>
                                <th class="text-center" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Stock actual</th>
                                <th class="text-right" style="padding: 1rem 1.5rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Operación</th>
                            </tr>
                        </thead>
                        <tbody id="mermas-list">
                            <tr><td colspan="3" class="text-center py-10 text-gray-400">Esperando parámetros de búsqueda...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="glass-panel" style="background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; padding: 1.5rem 1.5rem 1rem 1.5rem; flex-wrap:wrap; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                    <div>
                        <h3 style="font-size:1.1rem; font-weight:600; color:#1e293b; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="bi bi-clock-history text-primary"></i> Historial de Mermas
                        </h3>
                        <p class="text-muted" style="font-size:0.85rem; margin-top:0.3rem; margin-bottom: 0;">Últimos movimientos registrados en la sucursal.</p>
                    </div>
                    <div id="mermas-history-summary" class="badge badge-info" style="font-size: 0.8rem; background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 12px; font-weight: 600;">Sin datos cargados</div>
                </div>
                <div class="table-responsive" style="max-height: 40vh; overflow-y: auto;">
                    <table class="data-table w-full" style="border: none; width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th class="text-left" style="padding: 1rem 1.5rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Fecha</th>
                                <th class="text-left" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Producto</th>
                                <th class="text-left" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Motivo</th>
                                <th class="text-left" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Responsable</th>
                                <th class="text-right" style="padding: 1rem 1.5rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody id="mermas-history-list">
                            <tr><td colspan="5" class="text-center py-10 text-gray-400">Preparando historial...</td></tr>
                        </tbody>
                    </table>
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
            select.innerHTML = '<option value="" style="color: #1e293b;">Seleccionar sucursal...</option>' +
                availableBranches.map((branch) => `<option value="${branch.id_sucursal}" style="color: #1e293b;">${branch.nombreSucursal}</option>`).join('');

            if (isBodeguero() && assignedBranchId) {
                select.value = String(assignedBranchId);
            }
        }
    } catch (_) {
        const select = document.getElementById('mermas-branch-select');
        if (select) select.innerHTML = '<option value="">Error de conexion</option>';
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
    const historyBody = document.getElementById('mermas-history-list');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-10 text-gray-400">Sincronizando inventario...</td></tr>';
    }
    if (historyBody) {
        historyBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-400">Cargando historial...</td></tr>';
    }

    const token = getAuthToken();
    try {
        const [inventoryResponse, historyResponse] = await Promise.all([
            apiRequest({ endpoint: `/productos/inventario?id_sucursal=${branchId}`, token }),
            apiRequest({ endpoint: `/productos/mermas?id_sucursal=${branchId}`, token, silentNonJson: true })
        ]);

        mermasState.products = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : (Array.isArray(inventoryResponse) ? inventoryResponse : []);
        mermasState.history = Array.isArray(historyResponse?.data) ? historyResponse.data : (Array.isArray(historyResponse) ? historyResponse : []);
        mermasActualizarAlertas();
        mermasFiltrar();
        mermasRenderHistory();
    } catch (e) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center py-10 text-red-500">Fallo al sincronizar inventario: ${e.message}</td></tr>`;
        }
        if (historyBody) {
            historyBody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-red-500">No fue posible cargar el historial de mermas</td></tr>';
        }
    }
}

function mermasActualizarAlertas() {
    const alertsPanel = document.getElementById('mermas-alerts-panel');
    if (!alertsPanel) return;

    const threshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
    const criticalProducts = mermasState.products.filter((product) =>
        parseFloat(product.stockActual || product.cantidad || 0) <= threshold
    );

    const totalProducts = mermasState.products.length;
    const historyCount = Array.isArray(mermasState.history) ? mermasState.history.length : 0;

    alertsPanel.innerHTML = `
        <div class="glass-panel" style="padding:1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-left: 4px solid #ef4444;">
            <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase; font-weight:bold; letter-spacing:0.05em; color: #64748b;">Productos críticos</div>
            <div style="font-size:2.2rem; font-weight:800; color:#ef4444; margin-top:0.3rem;">${criticalProducts.length}</div>
            <div class="text-muted" style="font-size:0.85rem; margin-top:0.2rem; color: #94a3b8;">Bajo el umbral de ${threshold} unidades.</div>
            <button class="btn btn-ghost btn-sm" style="margin-top:0.85rem; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; border-radius: 8px;" onclick="mermasVerAlertas()">Ver listado</button>
        </div>
        <div class="glass-panel" style="padding:1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6;">
            <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase; font-weight:bold; letter-spacing:0.05em; color: #64748b;">Inventario cargado</div>
            <div style="font-size:2.2rem; font-weight:800; color:#1e293b; margin-top:0.3rem;">${totalProducts.toLocaleString('es-CL')}</div>
            <div class="text-muted" style="font-size:0.85rem; margin-top:0.2rem; color: #94a3b8;">Productos disponibles para revisión.</div>
        </div>
        <div class="glass-panel" style="padding:1.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-left: 4px solid #10b981;">
            <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase; font-weight:bold; letter-spacing:0.05em; color: #64748b;">Historial</div>
            <div style="font-size:2.2rem; font-weight:800; color:#1e293b; margin-top:0.3rem;">${historyCount.toLocaleString('es-CL')}</div>
            <div class="text-muted" style="font-size:0.85rem; margin-top:0.2rem; color: #94a3b8;">Movimientos registrados en esta sucursal.</div>
        </div>
    `;
}

function mermasVerAlertas() {
    const threshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);
    const searchInput = document.getElementById('mermas-search');
    if (searchInput) {
        searchInput.value = '';
    }

    const criticalProducts = mermasState.products.filter((product) =>
        parseFloat(product.stockActual || product.cantidad || 0) <= threshold
    );
    mermasRenderList(criticalProducts);
}

function mermasAccionPrincipal() {
    const selectedBranchId = mermasState.selectedBranchId || getActiveBranchId();
    if (!selectedBranchId) {
        Swal.fire('Sucursal requerida', 'Selecciona una sucursal antes de registrar una merma.', 'warning');
        return;
    }

    const searchInput = document.getElementById('mermas-search');
    if (searchInput) {
        searchInput.focus();
        if (!searchInput.value.trim()) {
            mermasRenderList(mermasState.products.slice(0, 12));
        }
        return;
    }

    if (mermasState.products.length) {
        mermasAbrirAjuste(mermasState.products[0].id_producto);
    }
}

function mermasFiltrar() {
    const query = (document.getElementById('mermas-search')?.value || '').toLowerCase().trim();
    const tbody = document.getElementById('mermas-list');
    if (!tbody) return;

    if (!query) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-10 text-gray-400">Busca un producto para registrar mermas</td></tr>';
        return;
    }

    const filteredProducts = mermasState.products.filter((product) =>
        (product.nombreProducto || '').toLowerCase().includes(query) ||
        (product.codigoBarras || '').toLowerCase().includes(query)
    ).slice(0, 12);

    mermasRenderList(filteredProducts);
}

function mermasRenderList(list) {
    const tbody = document.getElementById('mermas-list');
    if (!tbody) return;

    const threshold = parseInt(localStorage.getItem('valmu_low_stock_threshold') || '10', 10);

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-10 text-gray-400">No se encontraron productos coincidentes</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((product) => {
        const stock = parseFloat(product.stockActual || product.cantidad || 0);
        const isCritical = stock <= threshold;
        const stockLabel = isWeightedWastageProduct(product.esPesable)
            ? `${stock.toFixed(3)} Kg`
            : `${Math.round(stock).toLocaleString('es-CL')} un.`;

        return `
            <tr class="table-row-hover" style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <td style="padding: 1rem 1.5rem;">
                    <div style="font-weight:600; color:#0f172a; font-size: 0.95rem;">${product.nombreProducto || 'Producto sin nombre'}</div>
                    <div class="text-muted" style="font-size:0.75rem; margin-top:0.2rem; color: #64748b;">
                        <i class="bi bi-upc-scan"></i> ${product.codigoBarras || 'Sin codigo'} ${isCritical ? '<span style="color:#ef4444; margin-left:0.5rem; font-weight:bold;">¡CRÍTICO!</span>' : ''}
                    </div>
                </td>
                <td class="text-center" style="padding: 1rem;">
                    <span style="display:inline-flex; padding:0.3rem 0.6rem; border-radius:8px; background:${isCritical ? '#fef2f2' : '#f0fdf4'}; color:${isCritical ? '#b91c1c' : '#166534'}; font-weight:700; border: 1px solid ${isCritical ? '#fee2e2' : '#dcfce7'}; font-size: 0.9rem;">
                        ${stockLabel}
                    </span>
                </td>
                <td style="text-align:right; padding: 1rem 1.5rem;">
                    <button class="btn btn-sm" onclick="mermasAbrirAjuste(${product.id_producto})" style="background: #e0e7ff; color: #4f46e5; border: none; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.8rem;">
                        <i class="bi bi-dash-circle"></i> Registrar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function mermasFormatHistoryDate(value) {
    if (!value) return 'Sin fecha';

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(value);
    }

    return parsedDate.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function mermasNormalizeReasonLabel(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return 'Sin motivo';

    const labels = {
        MERMA: 'Merma',
        MERMA_ROTURA: 'Rotura',
        MERMA_VENCIMIENTO: 'Vencimiento',
        MERMA_ROBO: 'Robo / extravio',
        AJUSTE: 'Ajuste',
        OTRO: 'Otro'
    };

    return labels[rawValue] || rawValue.replace(/_/g, ' ');
}

function mermasRenderHistory() {
    const tbody = document.getElementById('mermas-history-list');
    const summary = document.getElementById('mermas-history-summary');
    if (!tbody) return;

    const history = Array.isArray(mermasState.history) ? mermasState.history : [];
    const rows = history.slice(0, 20);

    if (summary) {
        summary.textContent = history.length
            ? `${history.length} registro(s) encontrados`
            : 'Sin movimientos registrados';
    }

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-400">No hay historial de mermas para esta sucursal</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((item) => {
        const quantity = Math.abs(Number(item?.cantidadMov || 0));
        const quantityLabel = Number.isFinite(quantity)
            ? quantity.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
            : '0';

        return `
            <tr class="table-row-hover" style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <td style="padding: 1rem 1.5rem; font-size: 0.85rem; color: #64748b;">${mermasFormatHistoryDate(item?.fechaMov)}</td>
                <td style="padding: 1rem;">
                    <div style="font-weight:600; color:#0f172a; font-size: 0.9rem;">${item?.nombreProducto || 'Producto sin nombre'}</div>
                    <div class="text-muted" style="font-size:0.75rem; margin-top:0.2rem; color: #94a3b8;"><i class="bi bi-upc-scan"></i> ${item?.codigoBarras || 'Sin codigo'}</div>
                </td>
                <td style="padding: 1rem;">
                    <span style="background: #f1f5f9; color: #475569; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.8rem; font-weight: 500; border: 1px solid #e2e8f0;">
                        ${mermasNormalizeReasonLabel(item?.tipoMovimiento || item?.comprobanteMov)}
                    </span>
                </td>
                <td style="padding: 1rem; font-size: 0.85rem; color: #475569;">${item?.usuarioResponsable || 'Sistema'}</td>
                <td style="text-align:right; color:#ef4444; font-weight:700; padding: 1rem 1.5rem; font-size: 1.05rem;">-${quantityLabel}</td>
            </tr>
        `;
    }).join('');
}

function mermasAbrirAjuste(productId) {
    const product = mermasState.products.find((item) => item.id_producto === productId);
    if (!product) return;

    const currentQty = parseFloat(product.stockActual || product.cantidad || 0);
    const formattedCurrent = isWeightedWastageProduct(product.esPesable)
        ? currentQty.toFixed(3)
        : Math.round(currentQty).toLocaleString('es-CL');

    const content = `
        <div style="display:grid; gap:1.25rem;">
            <div class="glass-panel" style="padding:1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: none;">
                <div class="text-muted" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:600; color: #64748b;">Producto seleccionado</div>
                <div style="font-size:1.15rem; font-weight:800; color:#1e293b; margin-top:0.35rem;">${product.nombreProducto}</div>
                <div style="margin-top:0.5rem; font-size: 0.9rem; color: #475569;">Stock actual: <strong style="color: #1e293b; font-weight: 700;">${formattedCurrent} ${isWeightedWastageProduct(product.esPesable) ? 'Kg' : 'un.'}</strong></div>
            </div>

            <div class="form-group" style="margin:0;">
                <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; font-size: 0.9rem;">Cantidad a restar</label>
                <input type="number" id="merma-lost-qty" class="form-control" placeholder="${isWeightedWastageProduct(product.esPesable) ? '0.000' : '0'}" step="${isWeightedWastageProduct(product.esPesable) ? '0.001' : '1'}" min="0" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.75rem 1rem; font-weight: 600; font-size: 0.95rem; height: auto;">
                <div id="merma-preview-remain" class="text-muted" style="margin-top:0.5rem; font-size: 0.85rem; font-weight: 500;">Restante: -</div>
            </div>

            <div class="form-group" style="margin:0;">
                <label style="font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; font-size: 0.9rem;">Motivo</label>
                <div style="position: relative;">
                    <select id="merma-reason" class="form-control" style="appearance: none; -webkit-appearance: none; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.75rem 2.5rem 0.75rem 1rem; font-weight: 600; font-size: 0.95rem; width: 100%; color: #1e293b; cursor: pointer; outline: none; transition: all 0.2s; position: relative;">
                        <option value="MERMA_ROTURA">Rotura o daño de empaque/producto</option>
                        <option value="MERMA_VENCIMIENTO">Producto vencido</option>
                        <option value="MERMA_ROBO">Robo, hurto o extravío</option>
                        <option value="OTRO">Diferencia de inventario</option>
                    </select>
                    <i class="bi bi-chevron-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; z-index: 2;"></i>
                </div>
            </div>
        </div>
    `;

    showModal('Registrar Merma', content, async () => {
        const token = getAuthToken();
        const discount = parseFloat(document.getElementById('merma-lost-qty').value);

        if (isNaN(discount) || discount <= 0) {
            Swal.fire('Atencion', 'Ingresa una cantidad valida mayor a cero para declarar la merma.', 'warning');
            return;
        }

        const nuevaCantidad = currentQty - discount;
        if (nuevaCantidad < 0) {
            const confirm = await Swal.fire({
                title: 'Ajustar a 0',
                text: `La merma supera el stock actual (${formattedCurrent}). Deseas dejar la existencia en 0?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Si, ajustar',
                cancelButtonText: 'Corregir'
            });
            if (!confirm.isConfirmed) return;
        }

        const currentUser = getCurrentUser();
        const payload = {
            id_producto: productId,
            id_sucursal: mermasState.selectedBranchId,
            nuevaCantidad: Math.max(0, nuevaCantidad),
            motivoAjuste: document.getElementById('merma-reason').value,
            id_usuario: currentUser?.id_usuario || null
        };

        const response = await apiRequest({
            endpoint: '/productos/inventario',
            method: 'PUT',
            body: payload,
            token
        });

        if (!response.ok) {
            Swal.fire('Error', response.data?.error || 'Fallo al procesar la merma', 'error');
            return;
        }

        Toast.fire({ icon: 'success', title: 'Registro de merma finalizado' });
        closeModal();
        mermasCambiarSucursal(mermasState.selectedBranchId);
    });

    window.setTimeout(() => {
        const input = document.getElementById('merma-lost-qty');
        const preview = document.getElementById('merma-preview-remain');
        if (!input || !preview) return;

        input.addEventListener('input', () => {
            const discount = parseFloat(input.value) || 0;
            const remaining = currentQty - discount;
            const remainingLabel = isWeightedWastageProduct(product.esPesable)
                ? remaining.toFixed(3)
                : Math.round(remaining).toLocaleString('es-CL');
            preview.textContent = `Restante: ${remainingLabel} ${isWeightedWastageProduct(product.esPesable) ? 'Kg' : 'un.'}`;
            preview.style.color = remaining < 0 ? '#b91c1c' : 'var(--text-muted)';
        });
        input.focus();
    }, 50);
}

function isWeightedWastageProduct(value) {
    return value === true || value === 1 || value === '1';
}
