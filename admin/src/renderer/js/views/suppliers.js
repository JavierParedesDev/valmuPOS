async function renderSuppliers() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar">
            <h2><span class="icon">🏢</span> Gestión de Proveedores</h2>
            <button class="btn btn-primary" onclick="openSupplierForm()">+ Nuevo Proveedor</button>
        </div>
        <div class="glass-panel mt-4">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>RUT</th>
                        <th>Nombre del Proveedor</th>
                        <th>Contacto</th>
                        <th>Dirección</th>
                        <th style="text-align: right">Acciones</th>
                    </tr>
                </thead>
                <tbody id="suppliers-list">
                    <tr><td colspan="5">Cargando proveedores...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const response = await apiRequest({
            endpoint: '/proveedores',
            method: 'GET',
            token
        });

        const list = document.getElementById('suppliers-list');
        if (response.ok) {
            window.allSuppliers = response.data;
            list.innerHTML = window.allSuppliers.map((sup, index) => `
                <tr>
                    <td><code>${sup.rutProveedor}</code></td>
                    <td><strong>${sup.nombreProveedor}</strong></td>
                    <td>
                        <div style="font-weight: 500">${sup.email || '-'}</div>
                        <div class="text-muted" style="font-size: 0.8rem">${sup.telefono || '-'}</div>
                    </td>
                    <td>${sup.direccion || '-'}</td>
                    <td style="text-align: right">
                        <button class="btn btn-ghost btn-sm" onclick="openSupplierForm(window.allSuppliers[${index}])">✏️</button>
                        <button class="btn btn-ghost btn-sm text-error" onclick="deleteSupplier(${sup.id_proveedor})">🗑️</button>
                    </td>
                </tr>
        `).join('');
        } else {
            list.innerHTML = `<tr><td colspan="5" class="text-error">Error: ${response.data?.error || response.error || 'No autorizado'}</td></tr>`;
        }
    } catch (error) {
        console.error(error);
    }
}

function openSupplierForm(supplier = null) {
    const isEdit = !!supplier;
    const content = `
        <div class="form-group">
            <label>RUT del Proveedor</label>
            <input type="text" id="sup-rut" class="form-control" placeholder="12.345.678-9" value="${supplier?.rutProveedor || ''}">
        </div>
        <div class="form-group">
            <label>Nombre Comercial</label>
            <input type="text" id="sup-name" class="form-control" placeholder="Nombre de la empresa" value="${supplier?.nombreProveedor || ''}">
        </div>
        <div class="form-group">
            <label>Teléfono</label>
            <input type="text" id="sup-phone" class="form-control" placeholder="+56 9 ..." value="${supplier?.telefono || ''}">
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="sup-email" class="form-control" placeholder="contacto@empresa.com" value="${supplier?.email || ''}">
        </div>
        <div class="form-group">
            <label>Dirección</label>
            <input type="text" id="sup-address" class="form-control" placeholder="Calle, Número, Ciudad" value="${supplier?.direccion || ''}">
        </div>
    `;

    showModal(isEdit ? 'Editar Proveedor' : 'Crear Nuevo Proveedor', content, async () => {
        const data = {
            rutProveedor: document.getElementById('sup-rut').value,
            nombreProveedor: document.getElementById('sup-name').value,
            telefono: document.getElementById('sup-phone').value,
            email: document.getElementById('sup-email').value,
            direccion: document.getElementById('sup-address').value
        };

        if (!data.rutProveedor || !data.nombreProveedor) {
            Swal.fire('Error', 'RUT y Nombre son obligatorios', 'error');
            return;
        }

        const token = getAuthToken();
        const response = await apiRequest({
            endpoint: isEdit ? `/proveedores/${supplier.id_proveedor}` : '/proveedores',
            method: isEdit ? 'PUT' : 'POST',
            body: data,
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: isEdit ? "Proveedor actualizado" : "Proveedor creado con éxito" });
            closeModal();
            renderSuppliers();
        } else {
            Swal.fire('Error', response.data?.error || response.error || "No se pudo procesar", 'error');
        }
    });
}

async function deleteSupplier(id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡No podrás revertir esto!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff8a43',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const token = getAuthToken();
    const response = await apiRequest({
        endpoint: `/proveedores/${id}`,
        method: 'DELETE',
        token
    });

    if (response.ok) {
        Toast.fire({ icon: 'success', title: "Proveedor eliminado" });
        renderSuppliers();
    } else {
        Swal.fire('Error', response.data?.error || response.error || "No se pudo eliminar", 'error');
    }
}
