const ROUTES = window.AdminRoutes;
const navigation = window.AdminNavigation;

let currentPage = null;
let updateStateCleanup = null;
let lastUpdateStatus = null;

document.addEventListener('DOMContentLoaded', async () => {
    enforceSession();
    hydrateUserProfile();
    await hydrateSidebarVersion();
    navigation.bindNavigation(ROUTES, loadPage);
    bindLogout();
    await bindWindowActions();
    bindUpdateStateListener();

    const initialPage = navigation.getInitialPage(ROUTES);
    navigation.setActiveNav(initialPage);
    navigation.updatePageTitle(initialPage, ROUTES);
    loadPage(initialPage);
});

function bindLogout() {
    const logoutButton = document.querySelector('.btn-logout');
    if (!logoutButton) return;

    logoutButton.addEventListener('click', () => {
        clearSession();
        window.location.replace('login.html');
    });
}

function enforceSession() {
    const token = getAuthToken();
    if (!token) {
        window.location.replace('login.html');
    }
}

function hydrateUserProfile() {
    const user = getCurrentUser();
    if (!user) return;

    const nameElement = document.querySelector('.user-name');
    const avatarElement = document.querySelector('.user-avatar');

    if (user.nombreCompleto && nameElement) {
        nameElement.textContent = user.nombreCompleto;
    }

    if (user.nombreCompleto && avatarElement) {
        avatarElement.textContent = user.nombreCompleto
            .split(' ')
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }
}

async function hydrateSidebarVersion() {
    const versionLabel = document.getElementById('sidebar-app-version');
    if (!versionLabel) return;

    try {
        versionLabel.textContent = `Valmu Admin v${await window.electronAPI.getAppVersion()}`;
    } catch (_error) {
        versionLabel.textContent = 'Valmu Admin';
    }
}

async function bindWindowActions() {
    const fullscreenButton = document.getElementById('toggle-fullscreen-btn');
    if (!fullscreenButton || typeof window.electronAPI.toggleFullscreen !== 'function') {
        return;
    }

    const applyWindowState = (state) => {
        fullscreenButton.textContent = state?.isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa';
    };

    try {
        applyWindowState(await window.electronAPI.getWindowState());
    } catch (_error) {
        applyWindowState({ isFullScreen: false });
    }

    fullscreenButton.addEventListener('click', async () => {
        try {
            const state = await window.electronAPI.toggleFullscreen();
            applyWindowState(state);
        } catch (_error) {
            applyWindowState({ isFullScreen: false });
        }
    });
}

function bindUpdateStateListener() {
    if (typeof window.electronAPI.onUpdateStateChanged !== 'function') {
        return;
    }

    updateStateCleanup?.();
    updateStateCleanup = window.electronAPI.onUpdateStateChanged((state) => {
        refreshGlobalUpdateBanner(state);
        refreshSettingsView(state);
    });
}

async function loadPage(page) {
    const route = ROUTES[page];
    const contentArea = document.getElementById('content-area');

    if (!route || !contentArea) {
        renderPlaceholderPage(page);
        return;
    }

    currentPage = page;
    contentArea.innerHTML = `<div class="loader">Cargando ${route.title.toLowerCase()}...</div>`;

    try {
        await route.render();
    } catch (error) {
        console.error(`Error cargando la vista ${page}:`, error);
        contentArea.innerHTML = `
            <div class="glass-panel">
                <h2>No se pudo cargar el modulo</h2>
                <p class="text-muted">Revisa la conexion con la API o la consola para mas detalle.</p>
            </div>
        `;
    }
}

function renderPlaceholderPage(page) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="maintenance-container">
            <div class="maintenance-icon">En construccion</div>
            <h2>Estamos trabajando en el modulo de ${page}</h2>
            <p>Esta seccion aun no tiene una vista asociada.</p>
        </div>
    `;
}

function refreshSettingsView(state) {
    if (currentPage !== 'settings') {
        return;
    }

    const latestVersionLabel = document.getElementById('latest-version-label');
    const lastCheckedLabel = document.getElementById('last-checked-label');
    const statusPanel = document.getElementById('update-status-panel');
    const notesBox = document.getElementById('update-notes-box');
    const installButton = document.getElementById('install-update-button');
    const statusBadge = document.getElementById('update-status-badge');
    const badge = getUpdateStatusBadge(state);

    if (latestVersionLabel) {
        latestVersionLabel.textContent = state?.latestVersion || 'Sin registro';
    }

    if (lastCheckedLabel) {
        lastCheckedLabel.textContent = formatUpdateCheckedAt(state?.checkedAt);
    }

    if (statusPanel) {
        statusPanel.innerHTML = `
            <strong>${escapeSettingsHtml(state?.statusMessage || 'Aun no se ha comprobado si hay actualizaciones.')}</strong>
            <p>${escapeSettingsHtml(state?.errorMessage || 'Cuando publiques una nueva release, aqui veras si hay una version nueva disponible.')}</p>
        `;
    }

    if (notesBox) {
        notesBox.innerHTML = renderReleaseNotes(state?.releaseNotes);
    }

    if (installButton) {
        installButton.disabled = !state?.downloadReady;
    }

    if (statusBadge) {
        statusBadge.className = `badge ${badge.className}`;
        statusBadge.textContent = badge.label;
    }
}

function refreshGlobalUpdateBanner(state) {
    const banner = document.getElementById('app-update-banner');
    if (!banner) return;

    const status = state?.status || 'idle';
    const latestVersion = state?.latestVersion || 'nueva version';
    const isDownloaded = status === 'downloaded';
    const isAvailable = status === 'available' || status === 'downloading';
    const shouldShow = isAvailable || isDownloaded;

    if (!shouldShow) {
        banner.className = 'app-update-banner hidden';
        banner.innerHTML = '';
        lastUpdateStatus = status;
        return;
    }

    const title = isDownloaded
        ? `La version ${latestVersion} ya esta lista para instalar`
        : `Hay una nueva version disponible: ${latestVersion}`;

    const message = isDownloaded
        ? 'Puedes instalarla ahora con un clic o cerrar la app y dejar que se actualice automaticamente.'
        : (state?.statusMessage || 'La app ya esta descargando la actualizacion en segundo plano.');

    banner.className = `app-update-banner ${isDownloaded ? 'ready' : 'progress'}`;
    banner.innerHTML = `
        <div class="app-update-banner-copy">
            <span class="app-update-badge">${isDownloaded ? 'Lista para instalar' : 'Actualizacion disponible'}</span>
            <strong>${escapeSettingsHtml(title)}</strong>
            <p>${escapeSettingsHtml(message)}</p>
        </div>
        <div class="app-update-banner-actions">
            <button class="btn btn-ghost btn-sm" type="button" id="app-update-open-settings">Ver detalles</button>
            ${isDownloaded ? '<button class="btn btn-primary btn-sm" type="button" id="app-update-install-now">Instalar ahora</button>' : ''}
        </div>
    `;

    document.getElementById('app-update-open-settings')?.addEventListener('click', () => {
        navigation.setActiveNav('settings');
        navigation.updatePageTitle('settings', ROUTES);
        loadPage('settings');
        window.location.hash = 'settings';
    });

    document.getElementById('app-update-install-now')?.addEventListener('click', () => {
        window.electronAPI.installUpdate();
    });

    if (lastUpdateStatus !== status) {
        if (isDownloaded) {
            Toast.fire({ icon: 'success', title: `Actualizacion ${latestVersion} lista para instalar` });
        } else if (status === 'available') {
            Toast.fire({ icon: 'info', title: `Nueva version ${latestVersion} detectada` });
        }
    }

    lastUpdateStatus = status;
}
