async function renderAdvertising() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Publicidad y Pantalla Cliente</h2>
                    <p class="text-gray-500 text-sm">Gestiona las imágenes que ven tus clientes en la segunda pantalla.</p>
                </div>
                <button class="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all font-bold text-sm shadow-lg shadow-orange-100" onclick="showUploadAdvertisingModal()">
                    <i class="bi bi-plus-lg"></i> Nueva Publicidad
                </button>
            </div>

            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="table-shell">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Vista Previa</th>
                                <th>Título</th>
                                <th>Estado</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="advertising-list-body">
                            <tr><td colspan="4" class="text-center py-20 text-gray-400 italic">Cargando publicidad...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    void hydrateAdvertisingList();
}

async function hydrateAdvertisingList() {
    const tbody = document.getElementById('advertising-list-body');
    if (!tbody) return;

    try {
        const token = getAuthToken();
        const config = await window.electronAPI.getConfig();
        const apiBaseUrl = String(config?.apiBaseUrl || '').replace(/\/+$/, '');
        const origin = new URL(apiBaseUrl).origin;
        const imagesResponse = await apiRequest({ endpoint: '/publicidad', token });
        const images = imagesResponse.ok ? imagesResponse.data : null;

        if (!Array.isArray(images)) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-20 text-gray-400">No se pudo cargar la lista.</td></tr>';
            return;
        }

        if (images.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-20 text-gray-400">No hay publicidad registrada. Sube una para comenzar.</td></tr>';
            return;
        }

        tbody.innerHTML = images.map(img => {
            const statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium ${img.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                ${img.activo ? 'Activa' : 'Inactiva'}
            </span>`;

            const baseUrl = String(config?.apiBaseUrl || '').replace(/\/+$/, '');
            let origin = '';
            try {
                origin = new URL(baseUrl).origin;
            } catch {
                origin = baseUrl.replace(/\/api$/i, '');
            }
            const imageUrl = img.rutaImagen.startsWith('http') ? img.rutaImagen : `${origin}${img.rutaImagen}`;

            return `
                <tr class="hover:bg-gray-50/50 transition-colors">
                    <td class="py-4">
                        <img src="${imageUrl}" class="h-16 w-24 object-cover rounded-lg border border-gray-100 shadow-sm" onerror="this.src='../assets/img/placeholder.png'">
                    </td>
                    <td class="py-4">
                        <span class="font-bold text-gray-900">${img.titulo || 'Sin título'}</span>
                    </td>
                    <td class="py-4">
                        <div class="form-check form-switch cursor-pointer">
                            <input class="form-check-input" type="checkbox" ${img.activa ? 'checked' : ''} onchange="toggleAdvertisingStatus(${img.id_publicidad}, this.checked)">
                            <label class="text-xs font-medium ${img.activa ? 'text-green-600' : 'text-gray-400'}">${img.activa ? 'Activa' : 'Inactiva'}</label>
                        </div>
                    </td>
                    <td class="py-4 text-right">
                        <button class="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50 transition-colors" onclick="deleteAdvertising(${img.id_publicidad})">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error hydrating advertising:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-20 text-red-400">Error al conectar con el servidor.</td></tr>';
    }
}

async function toggleAdvertisingStatus(id, activa) {
    try {
        const token = getAuthToken();
        await apiRequest({
            endpoint: `/publicidad/${id}/estado`,
            method: 'PUT',
            body: { activa: activa ? 1 : 0 },
            token
        });
        Toast.fire({ icon: 'success', title: 'Estado actualizado' });
        void hydrateAdvertisingList();
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error al actualizar estado' });
        void hydrateAdvertisingList();
    }
}

async function deleteAdvertising(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Estás seguro?',
        text: "La imagen se borrará permanentemente del servidor.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
        const token = getAuthToken();
        await apiRequest({
            endpoint: `/publicidad/${id}`,
            method: 'DELETE',
            token
        });
        Toast.fire({ icon: 'success', title: 'Publicidad eliminada' });
        void hydrateAdvertisingList();
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error al eliminar publicidad' });
    }
}

function showUploadAdvertisingModal() {
    Swal.fire({
        title: 'Subir Publicidad',
        html: `
            <div class="text-left space-y-4 pt-4">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Título de la imagen</label>
                    <input type="text" id="ad-title" class="swal2-input !m-0 !w-full" placeholder="Ej: Oferta Semanal">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Seleccionar archivo</label>
                    <input type="file" id="ad-file" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" accept="image/*">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Subir Imagen',
        confirmButtonColor: '#ea580c',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const titulo = document.getElementById('ad-title').value;
            const fileInput = document.getElementById('ad-file');
            const file = fileInput.files[0];

            if (!file) {
                Swal.showValidationMessage('Por favor selecciona una imagen');
                return false;
            }

            return { titulo, file };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            await uploadAdvertising(result.value.titulo, result.value.file);
        }
    });
}

async function uploadAdvertising(titulo, file) {
    Swal.fire({
        title: 'Subiendo...',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const token = getAuthToken();

        // Convert file to base64 for IPC transfer
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;

        const response = await window.electronAPI.uploadPublicidad({
            titulo,
            base64,
            mime: file.type,
            token
        });

        if (!response.ok) throw new Error(response.error || 'Error al subir imagen');

        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'La imagen se ha subido correctamente.',
            timer: 2000,
            showConfirmButton: false
        });

        void hydrateAdvertisingList();
    } catch (error) {
        console.error('Upload error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo subir la imagen: ' + error.message
        });
    }
}
