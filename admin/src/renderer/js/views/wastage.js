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
        <div class="action-bar mb-6">
            <div>
                <h2>Mermas</h2>
                <p class="text-muted" style="margin-top:0.35rem;">
                    ${bodegueroMode ? `Registro operativo de perdidas para ${activeBranchName || 'tu sucursal'}.` : 'Control de perdidas, roturas y ajustes de inventario.'}
                </p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:end; flex-wrap:wrap;">
                <div id="mermas-branch-container" class="${bodegueroMode ? 'hidden' : ''}" style="min-width:280px;">
                    <div class="form-group" style="margin:0;">
                        <label>Sucursal</label>
                        <select id="mermas-branch-select" class="form-control" onchange="mermasCambiarSucursal(this.value)">
                            <option value="">Desconectado...</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary" type="button" onclick="mermasAccionPrincipal()">+ Registrar merma</button>
            </div>
        </div>

        <div id="mermas-empty-state" class="glass-panel" style="padding:2rem; text-align:center;">
            <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-main); margin-bottom:0.75rem;">Sucursal no seleccionada</h3>
            <p class="text-muted">${bodegueroMode ? 'Estamos preparando el inventario de tu sucursal para comenzar el registro de mermas.' : 'Selecciona una sucursal para cargar el inventario y el historial de mermas.'}</p>
        </div>

        <div id="mermas-main-area" class="hidden">
            <div id="mermas-alerts-panel" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.25rem;"></div>

            <div class="glass-panel" style="padding:1rem; margin-bottom:1.25rem;">
                <div class="form-group" style="margin:0;">
                    <label>Buscar producto</label>
                    <input type="text" id="mermas-search" class="form-control" placeholder="Nombre o codigo de barras" oninput="mermasFiltrar()">
                </div>
                <p class="text-muted" style="margin-top:0.75rem; font-size:0.85rem;">Busca un producto y registra la merma directamente desde esta tabla.</p>
            </div>

            <div class="glass-panel" style="margin-bottom:1.25rem;">
                <div class="table-shell">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Stock actual</th>
                                <th style="text-align:right;">Operacion</th>
                            </tr>
                        </thead>
                        <tbody id="mermas-list">
                            <tr><td colspan="3" class="text-center py-10 text-gray-400">Esperando parametros de busqueda...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="glass-panel">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; padding:1rem 1rem 0.75rem 1rem; flex-wrap:wrap;">
                    <div>
                        <h3 style="font-size:1rem; font-weight:800; color:var(--text-main);">Historial de Mermas</h3>
                        <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">Ultimos movimientos registrados en la sucursal seleccionada.</p>
                    </div>
                    <div id="mermas-history-summary" class="text-muted" style="font-size:0.8rem;">Sin datos cargados</div>
                </div>
                <div class="table-shell">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Motivo</th>
                                <th>Responsable</th>
                                <th style="text-align:right;">Cantidad</th>
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
            select.innerHTML = '<option value="">Seleccionar sucursal...</option>' +
                availableBranches.map((branch) => `<option value="${branch.id_sucursal}">${branch.nombreSucursal}</option>`).join('');

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
        <div class="glass-panel" style="padding:1rem;">
            <div class="text-muted" style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em;">Productos criticos</div>
            <div style="font-size:2rem; font-weight:800; color:#dc2626; margin-top:0.35rem;">${criticalProducts.length}</div>
            <div class="text-muted" style="font-size:0.85rem; margin-top:0.35rem;">Bajo el umbral de ${threshold} unidades.</div>
            <button class="btn btn-ghost btn-sm" style="margin-top:0.85rem;" onclick="mermasVerAlertas()">Ver listado</button>
        </div>
        <div class="glass-panel" style="padding:1rem;">
            <div class="text-muted" style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em;">Inventario cargado</div>
            <div style="font-size:2rem; font-weight:800; color:var(--text-main); margin-top:0.35rem;">${totalProducts.toLocaleString('es-CL')}</div>
            <div class="text-muted" style="font-size:0.85rem; margin-top:0.35rem;">Productos disponibles para revision.</div>
        </div>
        <div class="glass-panel" style="padding:1rem;">
            <div class="text-muted" style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em;">Historial</div>
            <div style="font-size:2rem; font-weight:800; color:var(--text-main); margin-top:0.35rem;">${historyCount.toLocaleString('es-CL')}</div>
            <div class="text-muted" style="font-size:0.85rem; margin-top:0.35rem;">Movimientos registrados en esta sucursal.</div>
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
            <tr>
                <td>
                    <div style="font-weight:800; color:var(--text-main);">${product.nombreProducto || 'Producto sin nombre'}</div>
                    <div class="text-muted" style="font-size:0.78rem; margin-top:0.2rem;">${product.codigoBarras || 'Sin codigo'}${isCritical ? ' | Critico' : ''}</div>
                </td>
                <td>
                    <span style="display:inline-flex; padding:0.35rem 0.7rem; border-radius:999px; background:${isCritical ? '#fef2f2' : '#f0fdf4'}; color:${isCritical ? '#b91c1c' : '#166534'}; font-weight:800;">
                        ${stockLabel}
                    </span>
                </td>
                <td style="text-align:right;">
                    <button class="btn btn-primary btn-sm" onclick="mermasAbrirAjuste(${product.id_producto})">Registrar merma</button>
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
            <tr>
                <td>${mermasFormatHistoryDate(item?.fechaMov)}</td>
                <td>
                    <div style="font-weight:800; color:var(--text-main);">${item?.nombreProducto || 'Producto sin nombre'}</div>
                    <div class="text-muted" style="font-size:0.78rem; margin-top:0.2rem;">${item?.codigoBarras || 'Sin codigo'}</div>
                </td>
                <td>${mermasNormalizeReasonLabel(item?.tipoMovimiento || item?.comprobanteMov)}</td>
                <td>${item?.usuarioResponsable || 'Sistema'}</td>
                <td style="text-align:right; color:#b91c1c; font-weight:800;">-${quantityLabel}</td>
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
        <div style="display:grid; gap:1rem;">
            <div class="glass-panel" style="padding:1rem;">
                <div class="text-muted" style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em;">Producto seleccionado</div>
                <div style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin-top:0.35rem;">${product.nombreProducto}</div>
                <div class="text-muted" style="margin-top:0.35rem;">Stock actual: <strong>${formattedCurrent} ${isWeightedWastageProduct(product.esPesable) ? 'Kg' : 'un.'}</strong></div>
            </div>

            <div class="form-group" style="margin:0;">
                <label>Cantidad a restar</label>
                <input type="number" id="merma-lost-qty" class="form-control" placeholder="${isWeightedWastageProduct(product.esPesable) ? '0.000' : '0'}" step="${isWeightedWastageProduct(product.esPesable) ? '0.001' : '1'}" min="0">
                <div id="merma-preview-remain" class="text-muted" style="margin-top:0.5rem;">Restante: -</div>
            </div>

            <div class="form-group" style="margin:0;">
                <label>Motivo</label>
                <select id="merma-reason" class="form-control">
                    <option value="MERMA_ROTURA">Rotura o dano de empaque/producto</option>
                    <option value="MERMA_VENCIMIENTO">Producto vencido</option>
                    <option value="MERMA_ROBO">Robo, hurto o extravio</option>
                    <option value="OTRO">Diferencia de inventario</option>
                </select>
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

        const payload = {
            id_producto: productId,
            id_sucursal: mermasState.selectedBranchId,
            nuevaCantidad: Math.max(0, nuevaCantidad),
            motivoAjuste: document.getElementById('merma-reason').value
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
