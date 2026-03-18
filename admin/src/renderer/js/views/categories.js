function getCategoryDeleteErrorMessage(response) {
    const rawMessage = String(
        response?.data?.error ||
        response?.error ||
        'No se pudo eliminar'
    );
    const normalizedMessage = rawMessage.toLowerCase();

    if (
        normalizedMessage.includes('foreign key') ||
        normalizedMessage.includes('constraint') ||
        normalizedMessage.includes('producto') ||
        normalizedMessage.includes('referenc')
    ) {
        return 'No puedes eliminar esta categoria porque tiene productos asociados.';
    }

    return rawMessage;
}

async function renderCategories() {
    const contentArea = document.getElementById('content-area');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="action-bar">
            <h2><span class="icon">📑</span> Gestion de Categorias</h2>
            <button class="btn btn-primary" onclick="openCategoryForm()">+ Nueva Categoria</button>
        </div>
        <div class="glass-panel mt-4">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Descripcion</th>
                        <th style="text-align: right">Acciones</th>
                    </tr>
                </thead>
                <tbody id="categories-list">
                    <tr><td colspan="4">Cargando categorias...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const response = await apiRequest({
            endpoint: '/categorias',
            method: 'GET',
            token
        });

        const list = document.getElementById('categories-list');
        if (!list) return;

        if (response.ok) {
            window.allCategories = Array.isArray(response.data) ? response.data : [];
            list.innerHTML = window.allCategories.map((cat, index) => `
                <tr>
                    <td><span class="badge badge-info">#${cat.id_categoria}</span></td>
                    <td><strong>${cat.nombreCategoria}</strong></td>
                    <td><span class="text-muted">${cat.descripcionCategoria || 'Sin descripcion'}</span></td>
                    <td style="text-align: right">
                        <button class="btn btn-ghost btn-sm" onclick="openCategoryForm(window.allCategories[${index}])">✏️</button>
                        <button class="btn btn-ghost btn-sm text-error" onclick="deleteCategory(${cat.id_categoria})">🗑️</button>
                    </td>
                </tr>
            `).join('');
            return;
        }

        list.innerHTML = `<tr><td colspan="4" class="text-error">Error: ${response.data?.error || response.error || 'No autorizado'}</td></tr>`;
    } catch (error) {
        console.error(error);
        const list = document.getElementById('categories-list');
        if (list) {
            list.innerHTML = `<tr><td colspan="4" class="text-error">Error de conexion.</td></tr>`;
        }
    }
}

function openCategoryForm(category = null) {
    const isEdit = !!category;
    const content = `
        <div class="form-group">
            <label>Nombre de la Categoria</label>
            <input type="text" id="cat-name" class="form-control" placeholder="Ej: Abarrotes, Bebidas..." value="${category?.nombreCategoria || ''}">
        </div>
        <div class="form-group">
            <label>Descripcion</label>
            <textarea id="cat-desc" class="form-control" rows="3" placeholder="Opcional...">${category?.descripcionCategoria || ''}</textarea>
        </div>
    `;

    showModal(isEdit ? 'Editar Categoria' : 'Crear Nueva Categoria', content, async () => {
        const name = document.getElementById('cat-name').value.trim();
        const desc = document.getElementById('cat-desc').value.trim();

        if (!name) {
            Swal.fire('Error', 'El nombre es obligatorio', 'error');
            return;
        }

        const token = getAuthToken();
        const response = await apiRequest({
            endpoint: isEdit ? `/categorias/${category.id_categoria}` : '/categorias',
            method: isEdit ? 'PUT' : 'POST',
            body: { nombreCategoria: name, descripcionCategoria: desc },
            token
        });

        if (response.ok) {
            Toast.fire({ icon: 'success', title: isEdit ? 'Categoria actualizada' : 'Categoria creada con exito' });
            closeModal();
            renderCategories();
            return;
        }

        Swal.fire('Error', response.data?.error || response.error || 'No se pudo procesar', 'error');
    });
}

async function deleteCategory(id) {
    const result = await Swal.fire({
        title: 'Estas seguro?',
        text: 'No podras revertir esto.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff8a43',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const token = getAuthToken();
    const response = await apiRequest({
        endpoint: `/categorias/${id}`,
        method: 'DELETE',
        token
    });

    if (response.ok) {
        Toast.fire({ icon: 'success', title: 'Categoria eliminada' });
        renderCategories();
        return;
    }

    Swal.fire('Error', getCategoryDeleteErrorMessage(response), 'error');
}
