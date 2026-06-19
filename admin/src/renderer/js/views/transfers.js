// =========================================================================
// VISTA: HISTORIAL DE TRASLADOS
// =========================================================================

let transfersHistoryGlobal = [];

async function renderTransfersView() {
    const contentArea = document.getElementById('content-area');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const pastWeek = new Date();
    pastWeek.setDate(pastWeek.getDate() - 7);
    const pastWeekStr = pastWeek.toISOString().split('T')[0];
    
    contentArea.innerHTML = `
        <div class="action-bar" style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem 2rem; border-radius: 16px; margin-bottom: 2rem; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.75rem; color: white; font-size: 1.5rem;">
                    <i class="bi bi-clock-history" style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 12px; font-size: 1.2rem;"></i> 
                    Historial de Traslados
                </h2>
                <p style="margin-top: 0; font-size: 0.95rem; color: rgba(255,255,255,0.8); margin-left: 3.2rem;">
                    Revisa los movimientos de mercadería registrados por ti.
                </p>
            </div>
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <div style="display: flex; gap: 0.5rem; align-items: center; background: rgba(255,255,255,0.1); padding: 0.5rem 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
                    <div style="display: flex; flex-direction: column;">
                        <label style="font-size: 0.7rem; color: rgba(255,255,255,0.7); margin-bottom: 0.2rem; text-transform: uppercase; font-weight: bold;">Desde</label>
                        <input type="date" id="filter-transfer-start" value="${pastWeekStr}" style="border: none; background: transparent; color: white; font-size: 0.9rem; outline: none; font-family: inherit; cursor: pointer;">
                    </div>
                    <div style="width: 1px; height: 2rem; background: rgba(255,255,255,0.2); margin: 0 0.5rem;"></div>
                    <div style="display: flex; flex-direction: column;">
                        <label style="font-size: 0.7rem; color: rgba(255,255,255,0.7); margin-bottom: 0.2rem; text-transform: uppercase; font-weight: bold;">Hasta</label>
                        <input type="date" id="filter-transfer-end" value="${todayStr}" style="border: none; background: transparent; color: white; font-size: 0.9rem; outline: none; font-family: inherit; cursor: pointer;">
                    </div>
                    <button class="btn" id="btn-transfer-filter" style="margin-left: 0.5rem; background: rgba(255,255,255,0.2); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 8px;">
                        <i class="bi bi-funnel"></i>
                    </button>
                </div>
                
                <button class="btn" onclick="adminNavigateToPage('transfer-create')" style="background: white; color: #4f46e5; font-weight: bold; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 0.75rem 1.25rem;">
                    <i class="bi bi-plus-lg"></i> Nuevo Traslado
                </button>
            </div>
        </div>
        
        <div class="glass-panel" style="margin-top: 1.5rem; padding: 0; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; min-height: 50vh;">
            <div style="padding: 1.5rem 1.5rem 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="bi bi-list-ul text-primary"></i> Resultados de Búsqueda
                </h3>
                <span id="transfers-count-badge" class="badge badge-info" style="font-size: 0.8rem; background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 12px; font-weight: 600;">0 registros</span>
            </div>
            <div id="transfers-table-container" style="flex: 1;">
                <p class="text-muted" style="padding: 3rem; text-align: center;">Cargando historial...</p>
            </div>
        </div>
    `;

    bindTransfersEvents();
    await loadTransfersData();
}

function bindTransfersEvents() {
    const btnFilter = document.getElementById('btn-transfer-filter');
    if (btnFilter) {
        btnFilter.addEventListener('click', () => {
            loadTransfersData();
        });
    }
}

async function loadTransfersData() {
    const container = document.getElementById('transfers-table-container');
    const startInput = document.getElementById('filter-transfer-start');
    const endInput = document.getElementById('filter-transfer-end');
    const countBadge = document.getElementById('transfers-count-badge');
    
    const fechaInicio = startInput?.value || '';
    const fechaFin = endInput?.value || '';
    
    container.innerHTML = '<div style="padding: 4rem; text-align: center; color: var(--text-muted);"><div class="spinner" style="margin-bottom: 1rem;"></div>Cargando historial de traslados...</div>';
    if (countBadge) countBadge.textContent = 'Cargando...';
    
    try {
        const token = getAuthToken();
        let endpoint = '/productos/traslados/historial';
        if (fechaInicio && fechaFin) {
            endpoint += `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        }
        
        const res = await apiRequest({ endpoint, token });
        const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        transfersHistoryGlobal = data;
        
        if (countBadge) {
            countBadge.textContent = `${data.length} traslado${data.length === 1 ? '' : 's'}`;
        }
        
        renderTransfersTable();
    } catch (error) {
        console.error('Error fetching transfers:', error);
        container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #ef4444;"><i class="bi bi-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i> Ocurrió un error al cargar el historial.</div>';
        if (countBadge) countBadge.textContent = 'Error';
    }
}

function renderTransfersTable() {
    const container = document.getElementById('transfers-table-container');
    if (!transfersHistoryGlobal || transfersHistoryGlobal.length === 0) {
        container.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <i class="bi bi-box-seam text-muted" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h4 style="color: var(--text-main); margin-bottom: 0.5rem;">No se encontraron traslados</h4>
                <p class="text-muted">No tienes registros de traslado en el rango de fechas seleccionado.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-responsive" style="max-height: 65vh; overflow-y: auto;">
            <table class="data-table w-full" style="border: none; width: 100%; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 1px solid #e2e8f0;">
                    <tr>
                        <th class="text-left" style="padding: 1rem 1.5rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Fecha</th>
                        <th class="text-left" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Comprobante</th>
                        <th class="text-left" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Producto</th>
                        <th class="text-right" style="padding: 1rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Cantidad</th>
                        <th class="text-left" style="padding: 1rem 1.5rem; color: #64748b; font-weight: 600; font-size: 0.85rem;">Ruta</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    transfersHistoryGlobal.forEach(item => {
        const qtyFormatted = (item.esPesable === 1 || item.esPesable === true || item.esPesable === '1') 
            ? `${Number(item.cantidadMov).toFixed(3)} Kg` 
            : `${Math.round(Number(item.cantidadMov)).toLocaleString('es-CL')} un.`;
            
        html += `
            <tr class="table-row-hover" style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <td style="white-space:nowrap; padding: 1rem 1.5rem;" class="text-muted">
                    <div style="font-weight: 500; color: #1e293b;">${new Date(item.fechaMov).toLocaleDateString('es-CL')}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${new Date(item.fechaMov).toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}</div>
                </td>
                <td style="padding: 1rem;">
                    <span style="background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; font-size: 0.8rem; color: #475569; border: 1px solid #e2e8f0;">
                        ${item.comprobanteMov || 'Sin Comprobante'}
                    </span>
                </td>
                <td style="padding: 1rem;">
                    <div style="font-weight: 600; color: #0f172a; font-size: 0.95rem;">${item.nombreProducto}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
                        <i class="bi bi-upc-scan"></i> ${item.codigoBarras || 'Sin código'}
                    </div>
                </td>
                <td class="text-right" style="padding: 1rem;">
                    <span style="font-weight: 700; color: #4f46e5; font-size: 1.1rem;">${qtyFormatted}</span>
                </td>
                <td style="padding: 1rem 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
                        <span style="color:#b91c1c; font-weight:600; background: #fef2f2; padding: 0.25rem 0.5rem; border-radius: 6px; white-space: nowrap; border: 1px solid #fee2e2;">
                            ${item.sucursalOrigen || 'Origen'}
                        </span> 
                        <i class="bi bi-arrow-right text-muted"></i> 
                        <span style="color:#15803d; font-weight:600; background: #f0fdf4; padding: 0.25rem 0.5rem; border-radius: 6px; white-space: nowrap; border: 1px solid #dcfce7;">
                            ${item.sucursalDestino || 'Destino'}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

window.renderTransfersView = renderTransfersView;
