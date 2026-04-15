// =========================================================================
// VISTA: DESPACHOS Y RENDICIÓN DE RUTA
// =========================================================================

let dispatchesCurrentTab = 'pendientes';
let dispatchesTransportes = [];

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

    // Cargar transportistas
    try {
        const transportesRes = await apiRequest({ endpoint: '/despachos/transportes', token });
        dispatchesTransportes = Array.isArray(transportesRes?.data) ? transportesRes.data : (Array.isArray(transportesRes) ? transportesRes : []);
    } catch (_error) {
        dispatchesTransportes = [];
    }

    // Cargar todos los despachos
    let allDespachos = [];
    try {
        const despachosRes = await apiRequest({ endpoint: '/despachos', token });
        allDespachos = Array.isArray(despachosRes?.data) ? despachosRes.data : (Array.isArray(despachosRes) ? despachosRes : []);
    } catch (_error) {
        allDespachos = [];
    }

    const pendientes = allDespachos.filter(d => d.estado?.toUpperCase() === 'EN_RUTA');
    const historial = allDespachos.filter(d => d.estado?.toUpperCase() !== 'EN_RUTA');

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
            ${renderDispatchesTab(dispatchesCurrentTab, pendientes, historial)}
        </div>
    `;

    bindDispatchesEvents(pendientes, historial);
}

function renderDispatchesTab(tab, pendientes, historial) {
    if (tab === 'pendientes') {
        return renderDispatchesPendientes(pendientes);
    } else if (tab === 'historial') {
        return renderDispatchesHistorial(historial);
    } else if (tab === 'transportes') {
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
                    ${pendientes.map(d => {
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
                                        <button class="btn btn-sm btn-dispatch-entregar" style="background:#059669;color:#fff;padding:4px 10px;font-size:12px;" 
                                                data-id="${d.id}" title="Marcar como entregado">
                                            <i class="bi bi-check-circle"></i> Entregar
                                        </button>
                                        <button class="btn btn-sm btn-dispatch-cancelar" style="background:#dc2626;color:#fff;padding:4px 10px;font-size:12px;" 
                                                data-id="${d.id}" title="Cancelar despacho">
                                            <i class="bi bi-x-circle"></i> Cancelar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderDispatchesHistorial(historial) {
    if (historial.length === 0) {
        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                <i class="bi bi-inbox text-5xl text-gray-300 mb-3 block"></i>
                <h3 class="text-lg font-semibold text-gray-700 mb-1">Sin historial</h3>
                <p class="text-gray-500">No hay despachos procesados aún</p>
            </div>
        `;
    }

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
                    </tr>
                </thead>
                <tbody>
                    ${historial.map(d => {
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
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
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

function bindDispatchesEvents(pendientes, historial) {
    const token = getAuthToken();

    // Tabs
    document.querySelectorAll('[data-dispatch-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            dispatchesCurrentTab = btn.dataset.dispatchTab;
            renderDispatches();
        });
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
                renderDispatches();
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
                    renderDispatches();
                } catch (error) {
                    Toast.fire({ icon: 'error', title: error.message || 'Error al eliminar' });
                }
            }
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
                    renderDispatches();
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
                    renderDispatches();
                } catch (error) {
                    Toast.fire({ icon: 'error', title: error.message || 'Error al cancelar' });
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        });
    });
}
