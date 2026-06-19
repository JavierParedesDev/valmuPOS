// =========================================================================
// VISTA: DESPACHOS Y RENDICIÓN DE RUTA
// =========================================================================

let dispatchesCurrentTab = 'pendientes';
let dispatchesTransportes = [];
let allDespachosGlobal = [];
let dispatchesHistorialPage = 1;
let dispatchesPendientesPage = 1;
let dispatchesHistorialDateFilter = '';
let dispatchesHistorialMontoFilter = '';
const DISPATCHES_PER_PAGE = 15;

function formatDispatchDate(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
}

function formatDispatchCurrency(value) {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num);
}

function getDispatchEstadoBadge(estado) {
    switch (estado?.toUpperCase()) {
        case 'EN_RUTA': return { label: 'En Ruta', class: 'badge-warning' };
        case 'ENTREGADO': return { label: 'Entregado', class: 'badge-success' };
        case 'CANCELADO': return { label: 'Cancelado', class: 'badge-danger' };
        default: return { label: estado || 'Desconocido', class: 'badge-info' };
    }
}

function escapeDispatchHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function renderDispatches() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const token = getAuthToken();

    // Mostrar loader rápido si está vacío
    if (!document.getElementById('dispatches-content')) {
        contentArea.innerHTML = `<div class="loader">Cargando despachos...</div>`;
    }

    // Cargar transportistas
    try {
        const transportesRes = await apiRequest({ endpoint: '/despachos/transportes', token });
        dispatchesTransportes = Array.isArray(transportesRes?.data) ? transportesRes.data : (Array.isArray(transportesRes) ? transportesRes : []);
    } catch (_error) {
        dispatchesTransportes = [];
    }

    // Cargar todos los despachos
    try {
        const despachosRes = await apiRequest({ endpoint: '/despachos', token });
        allDespachosGlobal = Array.isArray(despachosRes?.data) ? despachosRes.data : (Array.isArray(despachosRes) ? despachosRes : []);
    } catch (_error) {
        allDespachosGlobal = [];
    }

    renderDispatchesShell();
}

function renderDispatchesShell() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const pendientes = allDespachosGlobal.filter(d => d.estado?.toUpperCase() === 'EN_RUTA');

    contentArea.innerHTML = `
        <div class="action-bar mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Despachos</h2>
            <button class="btn btn-primary" id="btn-add-transporte">
                <i class="bi bi-plus-lg"></i> Nuevo Transportista
            </button>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 mb-4">
            <button class="btn ${dispatchesCurrentTab === 'pendientes' ? 'btn-primary' : ''}" data-dispatch-tab="pendientes">
                <i class="bi bi-clock-history"></i> Pendientes 
                <span class="badge ${pendientes.length > 0 ? 'badge-warning' : 'badge-success'}" style="margin-left:6px;">${pendientes.length}</span>
            </button>
            <button class="btn ${dispatchesCurrentTab === 'historial' ? 'btn-primary' : ''}" data-dispatch-tab="historial">
                <i class="bi bi-list-check"></i> Historial
            </button>
            <button class="btn ${dispatchesCurrentTab === 'transportes' ? 'btn-primary' : ''}" data-dispatch-tab="transportes">
                <i class="bi bi-truck"></i> Transportistas
            </button>
        </div>

        <!-- Content Area -->
        <div id="dispatches-content">
            ${renderDispatchesContentHtml()}
        </div>
    `;

    bindDispatchesEvents();
}

function renderDispatchesContentHtml() {
    const pendientes = allDespachosGlobal.filter(d => d.estado?.toUpperCase() === 'EN_RUTA');
    const historial = allDespachosGlobal.filter(d => d.estado?.toUpperCase() !== 'EN_RUTA');

    if (dispatchesCurrentTab === 'pendientes') {
        return renderDispatchesPendientes(pendientes);
    } else if (dispatchesCurrentTab === 'historial') {
        return renderDispatchesHistorial(historial);
    } else if (dispatchesCurrentTab === 'transportes') {
        return renderDispatchesTransportes();
    }
    return '';
}

function renderDispatchesPendientes(pendientes) {
    if (pendientes.length === 0) {
        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                <i class="bi bi-check-circle text-5xl text-green-500 mb-3 block"></i>
                <h3 class="text-lg font-semibold text-gray-700 mb-1">Sin despachos pendientes</h3>
                <p class="text-gray-500">Todos los despachos han sido rendidos</p>
            </div>
        `;
    }

    const totalPages = Math.ceil(pendientes.length / DISPATCHES_PER_PAGE) || 1;
    if (dispatchesPendientesPage > totalPages) dispatchesPendientesPage = totalPages;
    if (dispatchesPendientesPage < 1) dispatchesPendientesPage = 1;

    const start = (dispatchesPendientesPage - 1) * DISPATCHES_PER_PAGE;
    const paginated = pendientes.slice(start, start + DISPATCHES_PER_PAGE);

    return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table class="data-table w-full">
                <thead>
                    <tr>
                        <th class="text-left">Venta</th>
                        <th class="text-left">Transporte</th>
                        <th class="text-right">Total</th>
                        <th class="text-left">Fecha</th>
                        <th class="text-center">Estado</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginated.map(d => {
                        const badge = getDispatchEstadoBadge(d.estado);
                        return `
                            <tr data-despacho-id="${d.id}">
                                <td class="font-medium">${escapeDispatchHtml(d.venta)}</td>
                                <td>
                                    <div class="text-sm font-medium">${escapeDispatchHtml(d.transporte)}</div>
                                    <div class="text-xs text-gray-400">${escapeDispatchHtml(d.patenteTransporte)}</div>
                                </td>
                                <td class="text-right font-semibold">${formatDispatchCurrency(d.total)}</td>
                                <td class="text-sm text-gray-500">${formatDispatchDate(d.fecha)}</td>
                                <td class="text-center"><span class="badge ${badge.class}">${badge.label}</span></td>
                                <td class="text-center">
                                    <div class="flex items-center justify-center gap-1">
                                        <button class="btn btn-sm btn-dispatch-detail" style="background:#4b5563;color:#fff;padding:4px 10px;font-size:12px;" 
                                                data-id="${d.id}" title="Ver Detalle">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-dispatch-entregar" style="background:#059669;color:#fff;padding:4px 10px;font-size:12px;" 
                                                data-id="${d.id}" title="Marcar como entregado">
                                            <i class="bi bi-check-circle"></i> Entregar
                                        </button>
                                        <button class="btn btn-sm btn-dispatch-cancelar" style="background:#dc2626;color:#fff;padding:4px 10px;font-size:12px;" 
                                                data-id="${d.id}" title="Cancelar despacho">
                                            <i class="bi bi-x-circle"></i> Cancelar
                                        </button>
                                        <button class="btn btn-sm btn-dispatch-pdf" style="background:#ef4444;color:#fff;padding:4px 10px;font-size:12px;" 
                                                data-id-venta="${d.id_venta}" title="Descargar Boleta PDF">
                                            <i class="bi bi-file-pdf"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${totalPages > 1 ? `
        <div class="flex items-center justify-between mt-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <span class="text-sm text-gray-500">Mostrando página ${dispatchesPendientesPage} de ${totalPages} (Total: ${pendientes.length} pendientes)</span>
            <div class="flex gap-2">
                <button id="btn-dispatch-pend-prev" class="btn btn-sm btn-outline" ${dispatchesPendientesPage === 1 ? 'disabled' : ''}>Anterior</button>
                <button id="btn-dispatch-pend-next" class="btn btn-sm btn-outline" ${dispatchesPendientesPage === totalPages ? 'disabled' : ''}>Siguiente</button>
            </div>
        </div>
        ` : ''}
    `;
}

function renderDispatchesHistorial(historial) {
    // 1. Filtrado por fecha
    let filtered = historial;
    if (dispatchesHistorialDateFilter) {
        filtered = filtered.filter(d => {
            if (!d.fecha) return false;
            // Manejar fechas ISO o MySQL
            const dDate = new Date(d.fecha);
            if (Number.isNaN(dDate.getTime())) return false;
            
            // Convertir a YYYY-MM-DD local para comparar con el input type="date"
            const localDate = new Date(dDate.getTime() - (dDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            return localDate === dispatchesHistorialDateFilter;
        });
    }

    if (dispatchesHistorialMontoFilter) {
        filtered = filtered.filter(d => {
            return parseFloat(d.total) === parseFloat(dispatchesHistorialMontoFilter);
        });
    }

    // 2. Paginación
    const totalPages = Math.ceil(filtered.length / DISPATCHES_PER_PAGE) || 1;
    if (dispatchesHistorialPage > totalPages) dispatchesHistorialPage = totalPages;
    if (dispatchesHistorialPage < 1) dispatchesHistorialPage = 1;

    const start = (dispatchesHistorialPage - 1) * DISPATCHES_PER_PAGE;
    const paginated = filtered.slice(start, start + DISPATCHES_PER_PAGE);

    const tableHtml = paginated.length === 0 ? `
        <div class="p-8 text-center">
            <i class="bi bi-inbox text-5xl text-gray-300 mb-3 block"></i>
            <h3 class="text-lg font-semibold text-gray-700 mb-1">Sin historial</h3>
            <p class="text-gray-500">No se encontraron despachos procesados ${dispatchesHistorialDateFilter ? 'en esta fecha' : ''}</p>
        </div>
    ` : `
        <table class="data-table w-full">
            <thead>
                <tr>
                    <th class="text-left">Venta</th>
                    <th class="text-left">Transporte</th>
                    <th class="text-right">Total</th>
                    <th class="text-left">Fecha</th>
                    <th class="text-center">Estado</th>
                    <th class="text-center">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${paginated.map(d => {
                    const badge = getDispatchEstadoBadge(d.estado);
                    return `
                        <tr>
                            <td class="font-medium">${escapeDispatchHtml(d.venta)}</td>
                            <td>
                                <div class="text-sm font-medium">${escapeDispatchHtml(d.transporte)}</div>
                                <div class="text-xs text-gray-400">${escapeDispatchHtml(d.patenteTransporte)}</div>
                            </td>
                            <td class="text-right font-semibold">${formatDispatchCurrency(d.total)}</td>
                            <td class="text-sm text-gray-500">${formatDispatchDate(d.fecha)}</td>
                            <td class="text-center"><span class="badge ${badge.class}">${badge.label}</span></td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-dispatch-detail" style="background:#4b5563;color:#fff;padding:4px 10px;font-size:12px;" 
                                        data-id="${d.id}" title="Ver Detalle">
                                    <i class="bi bi-eye"></i> Ver
                                </button>
                                <button class="btn btn-sm btn-dispatch-pdf" style="background:#ef4444;color:#fff;padding:4px 10px;font-size:12px; margin-left: 4px;" 
                                        data-id-venta="${d.id_venta}" title="Descargar Boleta PDF">
                                    <i class="bi bi-file-pdf"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3 flex-wrap">
                <label class="text-sm font-medium text-gray-700">Filtrar por fecha:</label>
                <input type="date" id="filter-dispatch-date" class="form-control text-sm" style="max-width: 150px;" value="${dispatchesHistorialDateFilter}">
                
                <label class="text-sm font-medium text-gray-700 ml-2">Monto:</label>
                <input type="number" id="filter-dispatch-monto" class="form-control text-sm" placeholder="Ej: 15000" style="max-width: 120px;" value="${dispatchesHistorialMontoFilter}">
                
                ${(dispatchesHistorialDateFilter || dispatchesHistorialMontoFilter) ? '<button class="btn btn-ghost btn-sm text-red-500" id="btn-dispatch-clear-filters" title="Limpiar filtros"><i class="bi bi-x-circle"></i> Limpiar</button>' : ''}
            </div>
            <div class="text-sm text-gray-500">
                Mostrando ${paginated.length} de ${filtered.length} despachos
            </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            ${tableHtml}
        </div>

        ${totalPages > 1 ? `
        <div class="flex justify-between items-center bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <button class="btn btn-ghost btn-sm" id="btn-dispatch-prev" ${dispatchesHistorialPage === 1 ? 'disabled' : ''}>
                <i class="bi bi-chevron-left"></i> Anterior
            </button>
            <span class="text-sm font-medium text-gray-700">Página ${dispatchesHistorialPage} de ${totalPages}</span>
            <button class="btn btn-ghost btn-sm" id="btn-dispatch-next" ${dispatchesHistorialPage === totalPages ? 'disabled' : ''}>
                Siguiente <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        ` : ''}
    `;
}

function renderDispatchesTransportes() {
    if (dispatchesTransportes.length === 0) {
        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                <i class="bi bi-truck text-5xl text-gray-300 mb-3 block"></i>
                <h3 class="text-lg font-semibold text-gray-700 mb-1">Sin transportistas</h3>
                <p class="text-gray-500">Agrega tu primer transportista para comenzar</p>
            </div>
        `;
    }

    return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table class="data-table w-full">
                <thead>
                    <tr>
                        <th class="text-left">Nombre</th>
                        <th class="text-left">Patente</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${dispatchesTransportes.map(t => `
                        <tr data-transporte-id="${t.id_transporte}">
                            <td class="font-medium">${escapeDispatchHtml(t.nombreTransporte)}</td>
                            <td class="text-gray-600">${escapeDispatchHtml(t.patenteTransporte)}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-transporte-delete" style="background:#dc2626;color:#fff;padding:4px 10px;font-size:12px;" 
                                        data-id="${t.id_transporte}" title="Eliminar transportista">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function bindDispatchesEvents() {
    const token = getAuthToken();

    // Re-bind click tabs (Solo actualizamos UI sin re-fetch a menos que sea necesario)
    document.querySelectorAll('[data-dispatch-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (dispatchesCurrentTab !== btn.dataset.dispatchTab) {
                dispatchesCurrentTab = btn.dataset.dispatchTab;
                renderDispatchesShell();
            }
        });
    });

    // Filtros de fecha, monto y Paginación
    const dateInput = document.getElementById('filter-dispatch-date');
    if (dateInput) {
        dateInput.addEventListener('change', (e) => {
            dispatchesHistorialDateFilter = e.target.value;
            dispatchesHistorialPage = 1;
            reRenderContentOnly();
        });
    }

    const montoInput = document.getElementById('filter-dispatch-monto');
    if (montoInput) {
        montoInput.addEventListener('input', (e) => {
            dispatchesHistorialMontoFilter = e.target.value;
            dispatchesHistorialPage = 1;
            reRenderContentOnly();
        });
    }

    const clearFiltersBtn = document.getElementById('btn-dispatch-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            dispatchesHistorialDateFilter = '';
            dispatchesHistorialMontoFilter = '';
            dispatchesHistorialPage = 1;
            reRenderContentOnly();
        });
    }

    document.getElementById('btn-dispatch-prev')?.addEventListener('click', () => {
        if (dispatchesHistorialPage > 1) {
            dispatchesHistorialPage--;
            reRenderContentOnly();
        }
    });

    document.getElementById('btn-dispatch-next')?.addEventListener('click', () => {
        dispatchesHistorialPage++;
        reRenderContentOnly();
    });

    document.getElementById('btn-dispatch-pend-prev')?.addEventListener('click', () => {
        if (dispatchesPendientesPage > 1) {
            dispatchesPendientesPage--;
            reRenderContentOnly();
        }
    });

    document.getElementById('btn-dispatch-pend-next')?.addEventListener('click', () => {
        dispatchesPendientesPage++;
        reRenderContentOnly();
    });

    // Agregar transportista
    document.getElementById('btn-add-transporte')?.addEventListener('click', async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Nuevo Transportista',
            html: `
                <div style="text-align:left;">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input id="swal-nombre" class="swal2-input" placeholder="Ej: Juan Pérez" style="width:100%;margin:0 0 12px 0;">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Patente</label>
                    <input id="swal-patente" class="swal2-input" placeholder="Ej: ABCD12" style="width:100%;margin:0;">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Agregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
            preConfirm: () => {
                const nombre = document.getElementById('swal-nombre').value.trim();
                const patente = document.getElementById('swal-patente').value.trim();
                if (!nombre || !patente) {
                    Swal.showValidationMessage('Ambos campos son requeridos');
                    return false;
                }
                return { nombreTransporte: nombre, patenteTransporte: patente };
            }
        });

        if (formValues) {
            try {
                await apiRequest({
                    endpoint: '/despachos/transportes',
                    method: 'POST',
                    body: formValues,
                    token
                });
                Toast.fire({ icon: 'success', title: 'Transportista agregado' });
                renderDispatches(); // Fetch full de nuevo
            } catch (error) {
                Toast.fire({ icon: 'error', title: error.message || 'Error al agregar transportista' });
            }
        }
    });

    // Eliminar transportista
    document.querySelectorAll('.btn-transporte-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const { isConfirmed } = await Swal.fire({
                title: '¿Eliminar transportista?',
                text: 'Esta acción no se puede deshacer',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626'
            });

            if (isConfirmed) {
                try {
                    await apiRequest({
                        endpoint: `/despachos/transportes/${id}`,
                        method: 'DELETE',
                        token
                    });
                    Toast.fire({ icon: 'success', title: 'Transportista eliminado' });
                    renderDispatches(); // Fetch full de nuevo
                } catch (error) {
                    Toast.fire({ icon: 'error', title: error.message || 'Error al eliminar' });
                }
            }
        });
    });

    // Ver Detalle
    document.querySelectorAll('.btn-dispatch-detail').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const d = allDespachosGlobal.find(x => String(x.id) === String(id));
            if (!d) return;

            const badge = getDispatchEstadoBadge(d.estado);

            // Fetch products if id_venta exists
            let productosHtml = '<p class="text-xs text-gray-500 mb-2">Cargando productos...</p>';
            if (d.id_venta) {
                try {
                    btn.disabled = true;
                    const oldHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="bi bi-hourglass"></i>';
                    
                    const res = await apiRequest({ endpoint: `/ventas/${d.id_venta}`, token });
                    const payload = res?.data || res;
                    
                    if (payload && payload.productos && payload.productos.length > 0) {
                        productosHtml = `
                            <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 10px; max-height: 150px; overflow-y: auto;">
                                <h4 style="font-size: 0.85rem; font-weight: bold; margin-bottom: 5px; color: #475569;">Productos del Despacho:</h4>
                                <table style="width: 100%; font-size: 0.8rem; color: #334155;">
                                    <tbody>
                                        ${payload.productos.map(p => `
                                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                                <td style="padding: 4px 0;">${Number(p.cantidadVenta)}x ${p.nombreProducto}</td>
                                                <td style="text-align: right; padding: 4px 0; font-weight: bold;">${formatDispatchCurrency(p.subtotalLinea)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else {
                        productosHtml = '<p class="text-xs text-gray-500 mb-2">Sin productos registrados en esta venta.</p>';
                    }
                    
                    btn.disabled = false;
                    btn.innerHTML = oldHtml;
                } catch (err) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-eye"></i> Ver';
                    productosHtml = '<p class="text-xs text-red-500 mb-2">Error al cargar productos.</p>';
                }
            }

            Swal.fire({
                title: 'Detalle de Despacho',
                html: `
                    <div style="text-align: left; font-size: 0.95rem;">
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 10px;">
                            <p class="mb-2"><strong>ID Despacho:</strong> #${d.id}</p>
                            <p class="mb-2"><strong>Venta Asociada:</strong> ${d.venta || 'N/A'}</p>
                            <p class="mb-2"><strong>Fecha de Registro:</strong> ${formatDispatchDate(d.fecha)}</p>
                            <p class="mb-2"><strong>Estado:</strong> <span class="badge ${badge.class}">${badge.label}</span></p>
                            ${d.estado === 'ENTREGADO' ? `<p class="mb-2"><strong>Método de Pago:</strong> ${d.metodoPago || 'N/A'}</p>` : ''}
                        </div>
                        <div style="background: #fff7ed; padding: 15px; border-radius: 8px; border: 1px solid #ffedd5; margin-bottom: 10px;">
                            <p class="mb-2 text-orange-800"><strong>Transportista:</strong> ${d.transporte || 'N/A'}</p>
                            <p class="mb-2 text-orange-800"><strong>Patente:</strong> ${d.patenteTransporte || 'N/A'}</p>
                        </div>
                        ${productosHtml}
                        <div style="text-align: right; margin-top: 15px;">
                            <span style="font-size: 1rem; color: #64748b;">Total a cobrar: </span>
                            <span style="font-size: 1.5rem; font-weight: 900; color: #0f172a;">${formatDispatchCurrency(d.total)}</span>
                        </div>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#2563eb'
            });
        });
    });

    // Entregar despacho
    document.querySelectorAll('.btn-dispatch-entregar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;

            const { value: metodoPago } = await Swal.fire({
                title: 'Confirmar Entrega',
                text: '¿Cómo pagó el cliente?',
                icon: 'question',
                input: 'select',
                inputOptions: {
                    'EFECTIVO': 'Efectivo',
                    'TARJETA': 'Tarjeta',
                    'TRANSFERENCIA': 'Transferencia'
                },
                inputValue: 'EFECTIVO',
                showCancelButton: true,
                confirmButtonText: 'Confirmar entrega',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#059669'
            });

            if (metodoPago) {
                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';

                try {
                    await apiRequest({
                        endpoint: `/despachos/${id}/estado`,
                        method: 'PUT',
                        body: { estado: 'ENTREGADO', metodoPago },
                        token
                    });
                    Toast.fire({ icon: 'success', title: 'Despacho marcado como entregado' });
                    renderDispatches(); // Fetch full de nuevo
                } catch (error) {
                    Toast.fire({ icon: 'error', title: error.message || 'Error al procesar' });
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        });
    });

    // Cancelar despacho
    document.querySelectorAll('.btn-dispatch-cancelar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;

            const { isConfirmed } = await Swal.fire({
                title: '¿Cancelar despacho?',
                text: 'Los productos serán devueltos al stock y la venta será anulada.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, cancelar',
                cancelButtonText: 'No',
                confirmButtonColor: '#dc2626'
            });

            if (isConfirmed) {
                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';

                try {
                    await apiRequest({
                        endpoint: `/despachos/${id}/estado`,
                        method: 'PUT',
                        body: { estado: 'CANCELADO' },
                        token
                    });
                    Toast.fire({ icon: 'success', title: 'Despacho cancelado, stock devuelto' });
                    renderDispatches(); // Fetch full de nuevo
                } catch (error) {
                    Toast.fire({ icon: 'error', title: error.message || 'Error al cancelar' });
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        });
    });

    // Descargar Boleta PDF
    document.querySelectorAll('.btn-dispatch-pdf').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idVenta = btn.dataset.idVenta;
            if (!idVenta) {
                return Toast.fire({ icon: 'error', title: 'Este despacho no tiene una venta asociada.' });
            }

            try {
                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-hourglass"></i>';

                const res = await apiRequest({ endpoint: `/ventas/${idVenta}`, token });
                const payload = res?.data || res;
                const venta = payload?.cabecera || payload;

                if (!venta || (!venta.folioDocumento && !venta.id_venta)) {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return Toast.fire({ icon: 'warning', title: 'Esta venta no es válida.' });
                }

                // Generar Ticket Interno (PDF) si no hay folio electrónico
                if (!venta.folioDocumento) {
                    await generateInternalTicketPdf(payload);
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return;
                }

                let tipoDte = '39'; // Default boleta
                const tipoDocLabel = String(venta.tipoDoc || '').toLowerCase();
                if (tipoDocLabel.includes('factura')) tipoDte = '33';
                if (tipoDocLabel.includes('credito')) tipoDte = '61';
                if (tipoDocLabel.includes('debito')) tipoDte = '56';

                // Usamos la API de InvoicingHistory/Documents para generar o descargar el PDF
                if (window.ValmuInvoicingDocuments && window.ValmuInvoicingDocuments.createPdfFromXmlWrapper) {
                    await window.ValmuInvoicingDocuments.createPdfFromXmlWrapper({
                        type: tipoDte,
                        folio: venta.folioDocumento,
                        idXml: null,
                        api: window.ValmuInvoicingApi,
                        electronAPI: window.electronAPI,
                        toast: Toast,
                        createPdfFromXml: window.ValmuInvoicingDocuments.createPdfFromXml.bind(window.ValmuInvoicingDocuments)
                    });
                } else {
                    throw new Error('El módulo de facturación no está cargado correctamente.');
                }

                btn.disabled = false;
                btn.innerHTML = originalHtml;
            } catch (error) {
                console.error(error);
                Toast.fire({ icon: 'error', title: 'Error al descargar PDF: ' + (error.message || 'Error desconocido') });
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-file-pdf"></i>';
            }
        });
    });
}

// Función auxiliar para repintar solo la tabla (usada por Paginación y Filtros)
function reRenderContentOnly() {
    const content = document.getElementById('dispatches-content');
    if (content) {
        content.innerHTML = renderDispatchesContentHtml();
        bindDispatchesEvents(); // Volver a bindear los botones de la nueva tabla
    }
}

// Función para generar un PDF de ticket interno (Ventas sin DTE)
async function generateInternalTicketPdf(payload) {
    if (!window.jspdf) {
        throw new Error('La librería jsPDF no está cargada');
    }
    const { jsPDF } = window.jspdf;
    
    const doc = new jsPDF();
    const cabecera = payload.cabecera || payload;
    const productos = payload.productos || [];

    // Intentar cargar Logo de Valmu
    try {
        if (window.ValmuInvoicingDocuments) {
            const logoDataUrl = await window.ValmuInvoicingDocuments.loadImageAsDataUrl('assets/logo.png');
            doc.addImage(logoDataUrl, 'PNG', 10, 8, 22, 22);
        }
    } catch (e) {
        console.warn('No se pudo cargar el logo', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('COMPROBANTE DE VENTA', 200, 20, { align: 'right' });
    
    doc.setFontSize(11);
    doc.text('VALMU', 36, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Comprobante interno', 36, 19);
    
    doc.setFontSize(10);
    doc.text(`Venta Interna N°: ${cabecera.id_venta || 'N/A'}`, 200, 28, { align: 'right' });
    
    const fecha = cabecera.fechaVenta ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(cabecera.fechaVenta)) : '';
    doc.text(`Fecha: ${fecha}`, 200, 33, { align: 'right' });

    // Cliente Box
    const clientY = 45;
    doc.setLineWidth(0.2);
    doc.rect(10, clientY, 190, 25);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Señor(es):', 12, clientY + 5);
    doc.text('R.U.T.:', 12, clientY + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.text((cabecera.nombreCliente || 'Cliente Genérico').substring(0, 60), 35, clientY + 5);
    doc.text(cabecera.rut_cliente || 'N/A', 35, clientY + 10);
    doc.text(`Atendido por: ${cabecera.nombreCajero || cabecera.id_usuario || 'N/A'}`, 130, clientY + 5);

    // Tabla de productos
    const items = productos.map(p => [
        Number(p.cantidadVenta),
        p.nombreProducto,
        '$' + Number(p.precioVenta).toLocaleString('es-CL'),
        '$' + Number(p.subtotalLinea).toLocaleString('es-CL')
    ]);

    doc.autoTable({
        startY: clientY + 30,
        head: [['CANTIDAD', 'DESCRIPCIÓN', 'P. UNITARIO', 'SUBTOTAL']],
        body: items,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: 150 },
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 35 },
            3: { halign: 'right', cellWidth: 35 }
        },
        margin: { left: 10, right: 10 }
    });

    // Totales
    let bottomY = doc.lastAutoTable.finalY + 10;
    const totalsW = 70;
    const totalsX = 210 - totalsW - 10;

    doc.setFillColor(240, 240, 240);
    doc.rect(totalsX, bottomY, totalsW, 8, 'F');
    doc.rect(totalsX, bottomY, totalsW, 8, 'S');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsX + 2, bottomY + 6);
    doc.text('$' + Number(cabecera.total).toLocaleString('es-CL'), 200, bottomY + 6, { align: 'right' });

    // Mensaje final
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Comprobante de venta interno - Documento no válido como boleta o factura SII', 105, bottomY + 20, { align: 'center' });

    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = new Uint8Array(pdfArrayBuffer);
    const pdfFilename = `Comprobante_Venta_${cabecera.id_venta}.pdf`;
    
    // Guardar en la carpeta facturas localmente o donde se permita
    if (window.electronAPI && window.electronAPI.saveXml) {
        try {
            const result = await window.electronAPI.saveXml(pdfFilename, pdfBuffer, 'facturas');
            if (result?.success) {
                await window.electronAPI.openFile(result.path);
                return;
            }
        } catch (e) {
            console.error('Error guardando en electron:', e);
        }
    }
    
    // Fallback Web Download
    doc.save(pdfFilename);
}
