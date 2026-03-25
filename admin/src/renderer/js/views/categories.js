const ADMIN_CATEGORY_LIMIT = 25;
const adminCategoryPagination = {
    page: 1
};
let adminExpandedCategoryId = null;

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
            <div class="table-shell product-table-shell">
                <table class="data-table product-data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Categoria</th>
                            <th>Descripcion</th>
                        </tr>
                    </thead>
                    <tbody id="categories-list">
                        <tr><td colspan="4">Cargando categorias...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination-bar">
                <div class="pagination-summary" id="categories-pagination-summary">Preparando paginacion...</div>
                <div class="pagination-actions">
                    <button class="btn btn-ghost btn-sm" id="categories-prev-page">Anterior</button>
                    <button class="btn btn-ghost btn-sm" id="categories-next-page">Siguiente</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('categories-prev-page')?.addEventListener('click', () => {
        if (adminCategoryPagination.page <= 1) return;
        adminCategoryPagination.page -= 1;
        renderCategoryRows();
    });

    document.getElementById('categories-next-page')?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil((window.allCategories?.length || 0) / ADMIN_CATEGORY_LIMIT));
        if (adminCategoryPagination.page >= totalPages) return;
        adminCategoryPagination.page += 1;
        renderCategoryRows();
    });

    try {
        const response = await apiRequest({
            endpoint: '/categorias',
            method: 'GET',
            token
        });

        const list = document.getElementById('categories-list');
        if (!list) return;

        if (!response.ok) {
            list.innerHTML = `<tr><td colspan="4" class="text-error">Error: ${response.data?.error || response.error || 'No autorizado'}</td></tr>`;
            return;
        }

        window.allCategories = Array.isArray(response.data) ? response.data : [];

        adminCategoryPagination.page = 1;
        renderCategoryRows();
    } catch (error) {
        console.error(error);
        const list = document.getElementById('categories-list');
        if (list) {
            list.innerHTML = `<tr><td colspan="4" class="text-error">Error de conexion.</td></tr>`;
        }
    }
}

function renderCategoryRows() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    const categories = Array.isArray(window.allCategories) ? window.allCategories : [];
    if (!categories.length) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay categorias registradas.</td></tr>`;
        updateCategoryPaginationUi(0);
        return;
    }

    const page = Math.max(1, adminCategoryPagination.page);
    const start = (page - 1) * ADMIN_CATEGORY_LIMIT;
    const pagedCategories = categories.slice(start, start + ADMIN_CATEGORY_LIMIT);

    list.innerHTML = pagedCategories.map((category) => {
        const isExpanded = adminExpandedCategoryId === category.id_categoria;
        return `
            <tr class="product-row-compact product-row-clickable ${isExpanded ? 'is-expanded' : ''}"
                role="button" tabindex="0"
                aria-expanded="${isExpanded ? 'true' : 'false'}"
                onclick="toggleCategoryActions(${category.id_categoria})"
                onkeydown="handleCategoryRowKeydown(event, ${category.id_categoria})"
            >
                <td class="product-code-cell" data-label="ID"><code>#${category.id_categoria}</code></td>
                <td class="product-name-cell" data-label="Categoria">
                    <div class="product-name-stack">
                        <strong>${category.nombreCategoria}</strong>
                        <span class="product-row-hint">${isExpanded ? 'Ocultar opciones' : 'Toca para ver opciones'}</span>
                    </div>
                </td>
                <td class="product-supplier-cell" data-label="Descripcion">${category.descripcionCategoria || 'Sin descripcion'}</td>
            </tr>
            <tr class="product-action-row ${isExpanded ? 'is-expanded' : ''}">
                <td colspan="3" class="product-action-row-cell">
                    <div class="product-actions-panel">
                        <div class="product-actions-panel-copy">
                            <strong>Opciones para ${category.nombreCategoria}</strong>
                            <span>Selecciona una accion para ver, editar o eliminar esta categoria.</span>
                        </div>
                        <div class="product-actions-cell">
                            <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="previewCategoryById(${category.id_categoria}, event)">Ver</button>
                            <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openCategoryFormById(${category.id_categoria}, event)">Editar</button>
                            <button class="btn btn-ghost btn-sm text-error product-action-btn" type="button" onclick="deleteCategory(${category.id_categoria}, event)">Borrar</button>
                        </div>
                    </div>
                </td>    
            </tr>
        `;
    }).join('');

    updateCategoryPaginationUi(categories.length);
}

function toggleCategoryActions(categoryId) {
    adminExpandedCategoryId = adminExpandedCategoryId === categoryId ? null : categoryId;
    renderCategoryRows();
}

function handleCategoryRowKeydown(event, categoryId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleCategoryActions(categoryId);
}

function updateCategoryPaginationUi(totalItems) {
    const summary = document.getElementById('categories-pagination-summary');
    const prevButton = document.getElementById('categories-prev-page');
    const nextButton = document.getElementById('categories-next-page');
    const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_CATEGORY_LIMIT));
    const page = Math.min(adminCategoryPagination.page, totalPages);
    adminCategoryPagination.page = page;
    const start = totalItems === 0 ? 0 : ((page - 1) * ADMIN_CATEGORY_LIMIT) + 1;
    const end = Math.min(page * ADMIN_CATEGORY_LIMIT, totalItems);

    if (summary) {
        summary.textContent = totalItems
            ? `Mostrando ${start}-${end} de ${totalItems} categoria(s).`
            : 'Sin categorias registradas.';
    }

    if (prevButton) prevButton.disabled = page <= 1;
    if (nextButton) nextButton.disabled = page >= totalPages || totalItems === 0;
}

function getCategoryById(id) {
    return (window.allCategories || []).find((category) => category.id_categoria === id);
}

function previewCategoryById(id, event) {
    event?.stopPropagation?.();
    const category = getCategoryById(id);
    if (!category) return;

    Swal.fire({
        html: `
            <div class="product-preview-header">
                <div class="preview-icon">📑</div>
                <div class="preview-title-stack">
                    <span class="preview-overline">Detalles de Categoria</span>
                    <h3 class="preview-title">${category.nombreCategoria || 'Categoria'}</h3>
                </div>
            </div>
            <div class="preview-card-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <div class="preview-info-card">
                    <span class="preview-label">ID</span>
                    <strong class="preview-value">${category.id_categoria}</strong>
                </div>
                <div class="preview-info-card">
                    <span class="preview-label">Estado</span>
                    <strong class="preview-value text-accent">Activa</strong>
                </div>
                <div class="preview-info-card" style="grid-column: 1 / -1;">
                    <span class="preview-label">Descripcion</span>
                    <strong class="preview-value" style="font-size: 1.05rem; font-weight: 600;">${category.descripcionCategoria || 'Sin descripcion registrada.'}</strong>
                </div>
            </div>
            <div class="preview-actions">
                <button class="btn btn-primary" onclick="Swal.close()">Entendido</button>
            </div>
        `,
        showConfirmButton: false,
        padding: 0,
        customClass: {
            popup: 'custom-swal-popup'
        },
        width: 680
    });
}

function openCategoryFormById(id, event) {
    event?.stopPropagation?.();
    const category = getCategoryById(id);
    if (!category) return;
    openCategoryForm(category);
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

async function deleteCategory(id, event) {
    event?.stopPropagation?.();
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
