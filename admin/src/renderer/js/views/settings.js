function escapeSettingsHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatUpdateCheckedAt(value) {
    if (!value) {
        return 'Aun no se ha comprobado.';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Fecha no disponible';
    }

    return new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function getUpdateStatusBadge(state) {
    const status = state?.status || 'idle';

    switch (status) {
        case 'available':
            return { label: 'Nueva version disponible', className: 'badge-warning' };
        case 'downloading':
            return { label: 'Descargando', className: 'badge-info' };
        case 'downloaded':
            return { label: 'Lista para instalar', className: 'badge-success' };
        case 'up-to-date':
            return { label: 'Actualizado', className: 'badge-success' };
        case 'error':
            return { label: 'Revision con error', className: 'badge-danger' };
        case 'development':
            return { label: 'Modo desarrollo', className: 'badge-warning' };
        case 'checking':
            return { label: 'Buscando actualizacion', className: 'badge-info' };
        default:
            return { label: 'Sin revisar', className: 'badge-info' };
    }
}

function renderReleaseNotes(notes) {
    if (!notes) {
        return `
            <div class="update-notes-empty">
                Aun no hay un resumen disponible de la ultima actualizacion.
            </div>
        `;
    }

    const escaped = escapeSettingsHtml(notes);
    const paragraphs = escaped
        .split(/\n{2,}/)
        .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
        .join('');

    return `<div class="update-notes-content">${paragraphs}</div>`;
}

async function renderSettings() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const appVersion = await window.electronAPI.getAppVersion();
    const updateState = await window.electronAPI.getUpdateState();
    const latestVersion = updateState?.latestVersion || 'Sin registro';
    const badge = getUpdateStatusBadge(updateState);

    contentArea.innerHTML = `
        <section class="settings-shell">
            <div class="settings-header-card glass-panel">
                <div>
                    <p class="settings-eyebrow">Centro de configuracion</p>
                    <h2>Actualizaciones de Valmu Admin</h2>
                    <p class="text-muted">
                        Revisa la version instalada, consulta si hay una nueva release y mira el resumen de cambios sin salir del panel.
                    </p>
                </div>
                <div class="settings-version-pill">
                    Version actual
                    <strong>${escapeSettingsHtml(appVersion)}</strong>
                </div>
            </div>

            <section class="settings-overview-grid">
                <article class="glass-panel settings-overview-card">
                    <p class="settings-card-label">Build lista para prueba</p>
                    <h3>Version ${escapeSettingsHtml(appVersion)}</h3>
                    <p class="text-muted">
                        Esta build deja la configuracion de updates dentro del panel para validar mejor la experiencia en escritorio.
                    </p>
                </article>
                <article class="glass-panel settings-overview-card">
                    <p class="settings-card-label">Ultima release</p>
                    <h3>${escapeSettingsHtml(latestVersion)}</h3>
                    <p class="text-muted">
                        Cuando publiques una release nueva en GitHub, aqui veras la version detectada y el resumen de cambios.
                    </p>
                </article>
                <article class="glass-panel settings-overview-card">
                    <p class="settings-card-label">Proximo paso</p>
                    <h3>Publicar update</h3>
                    <p class="text-muted">
                        Genera el instalador nuevo, publica la release y despues usa este mismo panel para confirmar la descarga.
                    </p>
                </article>
            </section>

            <div class="settings-grid">
                <section class="glass-panel settings-card">
                    <div class="settings-card-head">
                        <div>
                            <p class="settings-card-label">Estado</p>
                            <h3>Busqueda de actualizaciones</h3>
                        </div>
                        <span class="badge ${badge.className}" id="update-status-badge">${badge.label}</span>
                    </div>

                    <div class="settings-info-list">
                        <div class="settings-info-row">
                            <span>Version instalada</span>
                            <strong>${escapeSettingsHtml(appVersion)}</strong>
                        </div>
                        <div class="settings-info-row">
                            <span>Ultima version detectada</span>
                            <strong id="latest-version-label">${escapeSettingsHtml(latestVersion)}</strong>
                        </div>
                        <div class="settings-info-row">
                            <span>Ultima revision</span>
                            <strong id="last-checked-label">${escapeSettingsHtml(formatUpdateCheckedAt(updateState?.checkedAt))}</strong>
                        </div>
                    </div>

                    <div class="update-status-panel" id="update-status-panel">
                        <strong>${escapeSettingsHtml(updateState?.statusMessage || 'Aun no se ha comprobado si hay actualizaciones.')}</strong>
                        <p>${escapeSettingsHtml(updateState?.errorMessage || 'Cuando publiques una nueva release, aqui veras si hay una version nueva disponible.')}</p>
                    </div>

                    <div class="settings-actions">
                        <button class="btn btn-primary" id="check-updates-button">Buscar actualizacion</button>
                        <button class="btn btn-ghost" id="install-update-button" ${updateState?.downloadReady ? '' : 'disabled'}>
                            Instalar actualizacion
                        </button>
                    </div>
                </section>

                <section class="glass-panel settings-card">
                    <div class="settings-card-head">
                        <div>
                            <p class="settings-card-label">Resumen</p>
                            <h3>Que trae la ultima actualizacion</h3>
                        </div>
                    </div>
                    <div class="update-notes-box" id="update-notes-box">
                        ${renderReleaseNotes(updateState?.releaseNotes)}
                    </div>
                </section>
            </div>
        </section>
    `;

    bindSettingsEvents();
}

function bindSettingsEvents() {
    const checkButton = document.getElementById('check-updates-button');
    const installButton = document.getElementById('install-update-button');

    checkButton?.addEventListener('click', async () => {
        checkButton.disabled = true;
        checkButton.textContent = 'Buscando...';

        try {
            await window.electronAPI.checkForUpdates();
        } finally {
            checkButton.disabled = false;
            checkButton.textContent = 'Buscar actualizacion';
        }
    });

    installButton?.addEventListener('click', () => {
        window.electronAPI.installUpdate();
    });
}
