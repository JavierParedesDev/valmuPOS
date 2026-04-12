function customersEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function customersRequest(endpoint, method = 'GET', body = null) {
    const token = getAuthToken();
    const response = await apiRequest({ endpoint, method, body, token });
    if (!response.ok) {
        throw new Error(response.data?.error || 'Error de API');
    }
    return response.data || response;
}

async function renderCustomers() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="action-bar mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Gestion de Clientes</h2>
            <div class="flex gap-3">
                <input id="customer-search-input" type="text" class="w-72 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-orange-500" placeholder="Buscar por RUT, nombre o giro...">
                <button class="btn btn-primary" onclick="adminAbrirFormCliente()">+ Nuevo Cliente</button>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             <div class="table-shell">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>RUT</th>
                            <th>Razon Social</th>
                            <th>Giro</th>
                            <th>Ciudad / Comuna</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="customers-table-body">
                        <tr><td colspan="5" class="text-center py-10 text-gray-400 italic">Cargando clientes...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('customer-search-input').addEventListener('input', (e) => loadCustomers(e.target.value));
    await loadCustomers();
}

async function loadCustomers(searchTerm = '') {
    const tbody = document.getElementById('customers-table-body');
    try {
        const data = await customersRequest('/clientes');
        const customers = Array.isArray(data) ? data : [];
        const term = searchTerm.toLowerCase();

        const filtered = customers.filter(c =>
            !term ||
            [c.rut_cliente, c.nombreCliente, c.giroCliente, c.ciudad].some(v => String(v || '').toLowerCase().includes(term))
        );

        tbody.innerHTML = filtered.length ? filtered.map(c => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="font-mono text-xs text-gray-500">${customersEscapeHtml(c.rut_cliente)}</td>
                <td class="font-bold text-gray-900">${customersEscapeHtml(c.nombreCliente)}</td>
                <td class="text-xs text-gray-500">${customersEscapeHtml(c.giroCliente)}</td>
                <td class="text-sm">${customersEscapeHtml(c.ciudad)} / ${customersEscapeHtml(c.comuna)}</td>
                <td style="text-align: right;">
                    <div class="flex justify-end gap-2">
                        <button class="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors" 
                                onclick="adminEditarCliente(${c.id_cliente})" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors" 
                                onclick="adminEliminarCliente(${c.id_cliente}, '${c.rut_cliente}')" title="Eliminar">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="text-center py-20 text-gray-400">No se encontraron clientes</td></tr>';
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500 font-medium">Error: ${e.message}</td></tr>`;
    }
}

function getCustomerFormHtml(c = {}) {
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-group">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">RUT *</label>
                <input type="text" id="cust-rut" class="form-control" value="${c.rut_cliente || ''}" placeholder="76.xxx.xxx-x">
            </div>
            <div class="form-group">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Razon Social *</label>
                <input type="text" id="cust-name" class="form-control" value="${c.nombreCliente || ''}" placeholder="Nombre o Empresa">
            </div>
            <div class="form-group md:col-span-2">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Giro</label>
                <input type="text" id="cust-giro" class="form-control" value="${c.giroCliente || ''}" placeholder="Actividad economica">
            </div>
            <div class="form-group md:col-span-2">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Direccion</label>
                <input type="text" id="cust-dir" class="form-control" value="${c.direccion || ''}" placeholder="Calle, numero, oficina">
            </div>
            <div class="form-group">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Comuna</label>
                <input type="text" id="cust-comuna" class="form-control" value="${c.comuna || ''}">
            </div>
            <div class="form-group">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Ciudad</label>
                <input type="text" id="cust-ciudad" class="form-control" value="${c.ciudad || ''}">
            </div>
            <div class="form-group">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Telefono</label>
                <input type="text" id="cust-tel" class="form-control" value="${c.telefono || ''}">
            </div>
            <div class="form-group">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Correo Electronico</label>
                <input type="email" id="cust-mail" class="form-control" value="${c.correo || ''}">
            </div>
        </div>
    `;
}

async function adminAbrirFormCliente() {
    showModal('Registrar Nuevo Cliente', getCustomerFormHtml(), async () => {
        const payload = {
            rut_cliente: document.getElementById('cust-rut').value.trim().toUpperCase(),
            nombreCliente: document.getElementById('cust-name').value.trim(),
            giroCliente: document.getElementById('cust-giro').value,
            direccion: document.getElementById('cust-dir').value,
            comuna: document.getElementById('cust-comuna').value,
            ciudad: document.getElementById('cust-ciudad').value,
            telefono: document.getElementById('cust-tel').value,
            correo: document.getElementById('cust-mail').value
        };

        if (!payload.rut_cliente || !payload.nombreCliente) {
            Swal.fire('Atencion', 'RUT y Razon Social son obligatorios', 'warning');
            return;
        }

        try {
            await customersRequest('/clientes', 'POST', payload);
            Toast.fire({ icon: 'success', title: 'Cliente registrado' });
            closeModal();
            loadCustomers();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    });
}

async function adminEditarCliente(id_cliente) {
    try {
        const customers = await customersRequest('/clientes');
        const c = customers.find(x => x.id_cliente === id_cliente);
        if (!c) throw new Error('Cliente no encontrado');

        showModal('Editar Cliente', getCustomerFormHtml(c), async () => {
            const payload = {
                rut_cliente: document.getElementById('cust-rut').value.trim().toUpperCase(),
                nombreCliente: document.getElementById('cust-name').value.trim(),
                giroCliente: document.getElementById('cust-giro').value,
                direccion: document.getElementById('cust-dir').value,
                comuna: document.getElementById('cust-comuna').value,
                ciudad: document.getElementById('cust-ciudad').value,
                telefono: document.getElementById('cust-tel').value,
                correo: document.getElementById('cust-mail').value
            };

            await customersRequest(`/clientes/${id_cliente}`, 'PUT', payload);
            Toast.fire({ icon: 'success', title: 'Cliente actualizado' });
            closeModal();
            loadCustomers();
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function adminEliminarCliente(id_cliente, rut) {
    const res = await Swal.fire({
        title: '¿Eliminar cliente?',
        text: 'Se eliminara el registro de ' + rut,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f97316'
    });

    if (res.isConfirmed) {
        try {
            await customersRequest(`/clientes/${id_cliente}`, 'DELETE');
            Toast.fire({ icon: 'success', title: 'Cliente eliminado' });
            loadCustomers();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
}
