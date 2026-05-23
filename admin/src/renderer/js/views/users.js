let globalUsersList = [];

async function renderUsers() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="action-bar mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Gestion de Usuarios</h2>
            <button class="btn btn-primary" onclick="adminAbrirFormUsuario()">+ Nuevo Usuario</button>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             <div class="table-shell">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="w-16">ID</th>
                            <th>Nombre de Usuario</th>
                            <th>Rol</th>
                            <th>Sucursal</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="admin-users-list">
                        <tr><td colspan="5" class="text-center py-4 text-gray-500 italic">Cargando usuarios...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    await adminCargarUsuarios();
}

async function adminCargarUsuarios() {
    const token = getAuthToken();
    try {
        const response = await apiRequest({ endpoint: '/auth/usuarios', token });
        const users = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        globalUsersList = users;

        const tbody = document.getElementById('admin-users-list');
        if (tbody) {
            tbody.innerHTML = users.length ? users.map(u => `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td><code class="text-gray-400">#${u.id_usuario || u.id}</code></td>
                    <td class="font-bold text-gray-900">${u.nombreUsuario || u.username}</td>
                    <td><span class="badge badge-info uppercase text-[10px] font-bold">${u.nombreRol || u.rol || 'Operador'}</span></td>
                    <td><span class="text-gray-600 font-medium">${u.nombreSucursal || 'Ambas sucursales'}</span></td>
                    <td style="text-align: right;">
                        <div class="flex justify-end gap-2">
                             <button class="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors" 
                                    onclick="adminEditarUsuario(${u.id_usuario || u.id})" title="Editar">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors" 
                                    onclick="adminEliminarUsuario(${u.id_usuario || u.id})" title="Eliminar">
                                <i class="bi bi-trash3-fill"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="5" class="text-center py-10 text-gray-400">No hay usuarios registrados</td></tr>';
        }
    } catch (_) {
        document.getElementById('admin-users-list').innerHTML = '<tr><td colspan="5" class="text-center py-10 text-red-500 font-medium">Error al cargar datos</td></tr>';
    }
}

async function adminEliminarUsuario(userId) {
    const result = await Swal.fire({
        title: '¿Eliminar usuario?',
        text: "Esta accion no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        const token = getAuthToken();
        try {
            const res = await apiRequest({
                endpoint: `/auth/usuarios/${userId}`,
                method: 'DELETE',
                token
            });

            if (res.ok) {
                Toast.fire({ icon: 'success', title: 'Usuario eliminado' });
                adminCargarUsuarios();
            } else {
                Swal.fire('Error', res.data?.error || 'No se pudo eliminar el usuario', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Hubo un problema al conectar con el servidor', 'error');
        }
    }
}

async function adminEditarUsuario(userId) {
    const user = globalUsersList.find(u => (u.id_usuario || u.id) === userId);
    if (!user) return;

    const token = getAuthToken();
    try {
        // Fetch metadata needed for the form
        const [rolesRes, branchRes] = await Promise.all([
            apiRequest({ endpoint: '/auth/roles', token }),
            apiRequest({ endpoint: '/sucursales', token })
        ]);

        const roles = Array.isArray(rolesRes) ? rolesRes : (rolesRes?.data || []);
        const branches = Array.isArray(branchRes) ? branchRes : (branchRes?.data || []);

        const content = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre Completo</label>
                    <input type="text" id="edit-user-full-name" class="form-control" placeholder="Ej: Javier Paredes" value="${user.nombreCompleto || ''}">
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre de Usuario</label>
                    <input type="text" id="edit-user-name" class="form-control" value="${user.nombreUsuario || ''}">
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nueva Contrasena</label>
                    <input type="password" id="edit-user-pass" class="form-control" placeholder="(Dejar vacio para mantener)">
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Rol</label>
                    <select id="edit-user-role" class="form-control">
                        ${roles.map(r => `<option value="${r.id_rol}" ${Number(r.id_rol) === Number(user.id_rol) ? 'selected' : ''}>${r.nombreRol}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group md:col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Sucursal Asignada</label>
                    <select id="edit-user-branch" class="form-control">
                         <option value="null" ${!user.id_sucursal || user.id_sucursal === 'null' ? 'selected' : ''}>Ambas sucursales</option>
                         ${branches.map(b => `<option value="${b.id_sucursal}" ${Number(b.id_sucursal) === Number(user.id_sucursal) ? 'selected' : ''}>${b.nombreSucursal}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;

        showModal('Editar Usuario', content, async () => {
            const data = {
                nombreCompleto: document.getElementById('edit-user-full-name').value,
                nombreUsuario: document.getElementById('edit-user-name').value,
                id_rol: document.getElementById('edit-user-role').value,
                id_sucursal: document.getElementById('edit-user-branch').value
            };

            const pass = document.getElementById('edit-user-pass').value;
            if (pass) data.contrasena = pass;

            const res = await apiRequest({
                endpoint: `/auth/usuarios/${userId}`,
                method: 'PUT',
                body: data,
                token
            });

            if (res.ok) {
                Toast.fire({ icon: 'success', title: 'Usuario actualizado' });
                closeModal();
                adminCargarUsuarios();
            } else {
                Swal.fire('Error', res.data?.error || 'No se pudo actualizar', 'error');
            }
        });

    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudieron cargar los datos del formulario', 'error');
    }
}

async function adminAbrirFormUsuario() {
    const token = getAuthToken();
    try {
        const [rolesRes, branchRes] = await Promise.all([
            apiRequest({ endpoint: '/auth/roles', token }),
            apiRequest({ endpoint: '/sucursales', token })
        ]);

        const roles = Array.isArray(rolesRes) ? rolesRes : (rolesRes?.data || []);
        const branches = Array.isArray(branchRes) ? branchRes : (branchRes?.data || []);

        const content = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre Completo</label>
                    <input type="text" id="user-full-name" class="form-control" placeholder="Nombre real del usuario">
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre de Usuario</label>
                    <input type="text" id="user-name" class="form-control" placeholder="Ej: admin_valmu">
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Contrasena</label>
                    <input type="password" id="user-pass" class="form-control">
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Rol</label>
                    <select id="user-role" class="form-control">
                         ${roles.map(r => `<option value="${r.id_rol}">${r.nombreRol}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group md:col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Sucursal Asignada</label>
                    <select id="user-branch" class="form-control">
                         <option value="null" selected>Ambas sucursales</option>
                         ${branches.map(b => `<option value="${b.id_sucursal}">${b.nombreSucursal}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;

        showModal('Crear Nuevo Usuario', content, async () => {
            const data = {
                nombreCompleto: document.getElementById('user-full-name').value,
                nombreUsuario: document.getElementById('user-name').value,
                contrasena: document.getElementById('user-pass').value,
                id_rol: document.getElementById('user-role').value,
                id_sucursal: document.getElementById('user-branch').value
            };

            if (!data.nombreUsuario || !data.contrasena || !data.id_rol) {
                Swal.fire('Error', 'El nombre de usuario, contraseña y rol son obligatorios', 'error');
                return;
            }

            const res = await apiRequest({
                endpoint: '/auth/usuarios',
                method: 'POST',
                body: data,
                token
            });

            if (res.ok) {
                Toast.fire({ icon: 'success', title: 'Usuario creado' });
                closeModal();
                adminCargarUsuarios();
            } else {
                Swal.fire('Error', res.data?.error || 'No se pudo crear el usuario', 'error');
            }
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudieron cargar roles o sucursales', 'error');
    }
}
