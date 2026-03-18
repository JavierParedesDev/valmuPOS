async function renderBranches() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar">
            <h2><span class="icon">📍</span> Gestión de Sucursales</h2>
        </div>
        <div id="branches-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="loader">Cargando sucursales...</div>
        </div>
    `;

    try {
        const response = await apiRequest({
            endpoint: '/sucursales',
            method: 'GET',
            token
        });

        const container = document.getElementById('branches-container');
        if (response.ok) {
            const branches = response.data;
            container.innerHTML = branches.map(b => `
                <div class="glass-panel branch-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div>
                            <h3 style="margin-bottom: 0.25rem">${b.nombreSucursal}</h3>
                            <p class="text-muted" style="font-size: 0.85rem">${b.direccion}</p>
                        </div>
                        <span class="badge badge-info">ID: ${b.id_sucursal}</span>
                    </div>
                    <button class="btn btn-ghost btn-sm" style="width: 100%" onclick="renderBranchInventory(${b.id_sucursal}, '${b.nombreSucursal}')">
                        📦 Ver Inventario
                    </button>
                </div>
            `).join('');
        } else {
            container.innerHTML = `<p class="text-error">Error: ${response.data?.error || response.error || 'Error'}</p>`;
        }
    } catch (error) {
        console.error(error);
    }
}

async function renderBranchInventory(branchId, branchName) {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button class="btn btn-ghost btn-sm" onclick="renderBranches()">⬅ Volver</button>
                <h2><span class="icon">📦</span> Inventario: ${branchName}</h2>
            </div>
            <div class="btn-group">
                <button class="btn btn-ghost" onclick="renderBranchInventory(${branchId}, '${branchName}')">🔄 Actualizar</button>
            </div>
        </div>
        <div class="glass-panel mt-4">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Código</th>
                        <th>Stock Actual</th>
                        <th style="text-align: right">Acciones</th>
                    </tr>
                </thead>
                <tbody id="branch-stock-list">
                    <tr><td colspan="4">Cargando inventario...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const response = await apiRequest({
            endpoint: `/productos/inventario?id_sucursal=${branchId}`,
            method: 'GET',
            token
        });

        const list = document.getElementById('branch-stock-list');
        if (response.ok) {
            const stock = response.data;
            window.currentBranchStock = stock; // Store for quick access

            if (stock.length === 0) {
                list.innerHTML = `<tr><td colspan="4" style="text-align: center">No hay productos con stock en esta sucursal</td></tr>`;
                return;
            }

            list.innerHTML = stock.map((s, index) => `
                <tr>
                    <td>
                        <strong>${s.nombreProducto}</strong>
                        ${s.esPesable ? '<span class="badge badge-warning" style="font-size: 0.6rem; margin-left: 0.4rem">Pesable</span>' : ''}
                    </td>
                    <td><code>${s.codigoBarras}</code></td>
                    <td>
                        <span class="badge ${s.cantidad > 10 ? 'badge-success' : 'badge-danger'}">
                            ${s.esPesable ? parseFloat(s.cantidad).toFixed(3) + ' Kg' : Math.floor(s.cantidad) + ' Unidades'}
                        </span>
                    </td>
                    <td style="text-align: right">
                        <button class="btn btn-primary btn-sm" onclick="openAdjustmentForm(${index}, ${branchId}, '${branchName}')">
                            ⚖️ Ajustar
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            list.innerHTML = `<tr><td colspan="4" class="text-error">Error: ${response.data?.error || response.error || 'Error'}</td></tr>`;
        }
    } catch (error) {
        console.error(error);
    }
}

function openAdjustmentForm(index, branchId, branchName) {
    const item = window.currentBranchStock[index];
    const content = `
        <div class="form-group">
            <label>Producto</label>
            <input type="text" class="form-control" value="${item.nombreProducto}" disabled>
        </div>
        <div class="form-group">
            <label>Stock Actual</label>
            <input type="text" class="form-control" value="${item.esPesable ? parseFloat(item.cantidad).toFixed(3) + ' Kg' : Math.floor(item.cantidad) + ' unidades'}" disabled>
        </div>
        <div class="form-group">
            <label>Nueva Cantidad Física</label>
            <input type="number" id="adj-qty" class="form-control" value="${item.esPesable ? item.cantidad : Math.floor(item.cantidad)}" step="${item.esPesable ? '0.001' : '1'}">
        </div>
        <div class="form-group">
            <label>Motivo del Ajuste</label>
            <select id="adj-reason" class="form-control">
                <option value="INVENTARIO_MANUAL">Corrección de Inventario</option>
                <option value="MERMA_DANO">Merma por Daño</option>
                <option value="MERMA_VENCIMIENTO">Vencimiento</option>
                <option value="SOBRANTE">Sobrante encontrado</option>
            </select>
        </div>
    `;

    showModal('Ajuste Manual de Stock', content, async () => {
        const token = getAuthToken();
        const data = {
            id_producto: item.id_producto,
            id_sucursal: branchId,
            nuevaCantidad: parseFloat(document.getElementById('adj-qty').value),
            motivoAjuste: document.getElementById('adj-reason').value
        };

        if (isNaN(data.nuevaCantidad) || data.nuevaCantidad < 0) {
            Swal.fire('Error', 'Cantidad inválida', 'error');
            return;
        }

        const response = await apiRequest({
            endpoint: '/productos/inventario',
            method: 'PUT',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: "Stock ajustado correctamente" });
            closeModal();
            renderBranchInventory(branchId, branchName);
        } else {
            Swal.fire('Error', response.data?.error || response.error || 'Error', 'error');
        }
    });
}
