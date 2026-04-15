function escapeSettingsHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatUpdateCheckedAt(value) {
    if (!value) return 'Aún no se ha comprobado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function getUpdateStatusBadge(state) {
    const status = state?.status || 'idle';
    switch (status) {
        case 'available': return { label: 'Actualización disponible', class: 'badge-warning' };
        case 'downloading': return { label: 'Descargando...', class: 'badge-info' };
        case 'downloaded': return { label: 'Lista para instalar', class: 'badge-success' };
        case 'up-to-date': return { label: 'Sistema actualizado', class: 'badge-success' };
        case 'error': return { label: 'Error', class: 'badge-danger' };
        case 'development': return { label: 'Modo desarrollo', class: 'badge-info' };
        case 'checking': return { label: 'Verificando...', class: 'badge-info' };
        default: return { label: 'Pendiente', class: 'badge-info' };
    }
}

async function renderSettings() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const appVersion = await window.electronAPI.getAppVersion();
    const updateState = await window.electronAPI.getUpdateState();
    const badge = getUpdateStatusBadge(updateState);
    const token = getAuthToken();

    let branches = [];
    try {
        const response = await apiRequest({ endpoint: '/sucursales', token });
        branches = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
    } catch (_error) {
        branches = [];
    }

    const activeBranchId = getActiveBranchId();
    const activeBranchName = getActiveBranchName();
    const branchOptions = branches.length
        ? branches.map((branch) => `
            <option value="${branch.id_sucursal}" ${Number(branch.id_sucursal) === Number(activeBranchId) ? 'selected' : ''}>${branch.nombreSucursal}</option>
        `).join('')
        : `<option value="">${activeBranchName || 'Sin sucursales'}</option>`;

    contentArea.innerHTML = `
        <div class="action-bar mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Configuración</h2>
        </div>

        <div class="space-y-4">
            <!-- Actualizaciones -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                            <i class="bi bi-cloud-download"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900">Actualizaciones del Sistema</h3>
                            <p class="text-sm text-gray-500">Versión instalada: <code class="text-gray-700">${appVersion}</code></p>
                        </div>
                    </div>
                    <span class="badge ${badge.class}">${badge.label}</span>
                </div>
                <div class="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                    <button class="btn btn-primary" id="check-updates-button">
                        <i class="bi bi-arrow-clockwise"></i> Buscar actualizaciones
                    </button>
                    ${updateState?.downloadReady ? `
                        <button class="btn btn-primary" style="background:#059669;" id="install-update-button">
                            <i class="bi bi-lightning-fill"></i> Instalar y reiniciar
                        </button>
                    ` : ''}
                    <span class="text-xs text-gray-400 ml-auto">${formatUpdateCheckedAt(updateState?.checkedAt)}</span>
                </div>
            </div>

            <!-- Sucursal Activa -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="h-10 w-10 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                        <i class="bi bi-shop"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-900">Sucursal de Trabajo</h3>
                        <p class="text-sm text-gray-500">Se usa como origen para operaciones de inventario</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <select id="setting-active-branch" class="form-control" style="max-width:280px;">
                        ${branchOptions}
                    </select>
                    <button class="btn btn-primary" id="save-branch-settings">
                        <i class="bi bi-check-lg"></i> Guardar
                    </button>
                </div>
            </div>

            <!-- Umbral de Stock -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div class="flex items-center gap-3 mb-4">
                    <div class="h-10 w-10 rounded-lg bg-red-500 text-white flex items-center justify-center">
                        <i class="bi bi-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-900">Alerta de Stock Bajo</h3>
                        <p class="text-sm text-gray-500">Cantidad mínima para mostrar alerta de reposición</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <input type="number" id="setting-low-stock" class="form-control" style="max-width:100px;" value="${localStorage.getItem('valmu_low_stock_threshold') || '10'}" min="1" step="1">
                    <span class="text-sm text-gray-500">unidades</span>
                    <button class="btn btn-primary" id="save-inventory-settings">
                        <i class="bi bi-check-lg"></i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;

    bindSettingsEvents();
}

function bindSettingsEvents() {
    const checkButton = document.getElementById('check-updates-button');
    const installButton = document.getElementById('install-update-button');

    if (checkButton) {
        checkButton.addEventListener('click', async () => {
            const originalHtml = checkButton.innerHTML;
            checkButton.disabled = true;
            checkButton.innerHTML = `<i class="bi bi-hourglass-split"></i> Verificando...`;

            try {
                await window.electronAPI.checkForUpdates();
                setTimeout(renderSettings, 1500);
            } catch (err) {
                console.error('Update check failed:', err);
                Toast.fire({ icon: 'error', title: 'Error al verificar actualizaciones' });
            } finally {
                checkButton.disabled = false;
                checkButton.innerHTML = originalHtml;
            }
        });
    }

    installButton?.addEventListener('click', () => {
        window.electronAPI.installUpdate();
    });

    document.getElementById('save-inventory-settings')?.addEventListener('click', () => {
        const threshold = document.getElementById('setting-low-stock')?.value || '10';
        localStorage.setItem('valmu_low_stock_threshold', threshold);
        Toast.fire({ icon: 'success', title: 'Umbral de stock actualizado' });
    });

    document.getElementById('save-branch-settings')?.addEventListener('click', () => {
        const branchSelect = document.getElementById('setting-active-branch');
        const selectedOption = branchSelect?.options?.[branchSelect.selectedIndex];
        const branchId = branchSelect?.value;

        if (!branchId) {
            Toast.fire({ icon: 'warning', title: 'Selecciona una sucursal' });
            return;
        }

        setActiveBranch({
            id: branchId,
            name: selectedOption?.textContent || ''
        });

        Toast.fire({ icon: 'success', title: 'Sucursal guardada correctamente' });
    });
}
