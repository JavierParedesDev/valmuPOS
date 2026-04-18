let currentPage = null;
let updateStateCleanup = null;
let lastUpdateStatus = null;
const ROLE_CONFIGS = {
    1: {
        allowedPages: ['dashboard', 'users', 'customers', 'products', 'categories', 'suppliers', 'advertising', 'wastage', 'finances', 'invoicing', 'dispatches', 'branches', 'settings', 'logistics'],
        defaultPage: 'dashboard'
    },
    3: {
        allowedPages: ['dashboard', 'products', 'branches', 'wastage', 'settings'],
        defaultPage: 'dashboard',
        brandName: 'Bodega',
        navLabels: {
            dashboard: 'Resumen Bodega',
            products: 'Ingreso de Stock',
            branches: 'Inventario',
            wastage: 'Mermas',
            settings: 'Configuracion'
        },
        sectionLabels: ['Bodega', 'Operacion']
    }
};

function getRoutes() {
    return window.AdminRoutes || {};
}

function getNavigation() {
    return window.AdminNavigation || null;
}

document.addEventListener('DOMContentLoaded', async () => {
    enforceSession();
    hydrateUserProfile();
    applyRoleChrome();
    applyRoleEntrance();
    applyRolePermissions();
    await hydrateSidebarVersion();
    const navigation = getNavigation();
    if (!navigation) {
        console.error('Admin navigation is unavailable.');
        renderBootstrapError('No se pudo inicializar la navegacion del panel.');
        return;
    }

    navigation.bindNavigation(getRoutes, loadPage);
    bindLogout();
    await bindWindowActions();
    bindUpdateStateListener();

    const initialPage = getInitialPageForUser();
    navigation.setActiveNav(initialPage);
    navigation.updatePageTitle(initialPage, getRoutes);
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

function getUserRoleConfig() {
    const user = getCurrentUser();
    if (!user) return ROLE_CONFIGS[1];

    const roleKey = Number(user.id_rol || user.rol_id || user.idRol);
    if (ROLE_CONFIGS[roleKey]) {
        return ROLE_CONFIGS[roleKey];
    }

    if (String(user.rol || '').toLowerCase() === 'bodeguero') {
        return ROLE_CONFIGS[3];
    }

    return ROLE_CONFIGS[1];
}

function getAllowedPagesForUser() {
    return getUserRoleConfig().allowedPages || ROLE_CONFIGS[1].allowedPages;
}

function getInitialPageForUser() {
    const requestedPage = window.location.hash.replace('#', '');
    const routes = getRoutes();
    const allowedPages = getAllowedPagesForUser();
    const roleConfig = getUserRoleConfig();

    if (routes[requestedPage] && allowedPages.includes(requestedPage)) {
        return requestedPage;
    }

    if (routes[roleConfig.defaultPage] && allowedPages.includes(roleConfig.defaultPage)) {
        return roleConfig.defaultPage;
    }

    return allowedPages.find((page) => routes[page]) || 'dashboard';
}

function applyRoleChrome() {
    const roleConfig = getUserRoleConfig();

    if (roleConfig.brandName) {
        const brandName = document.querySelector('.brand-name');
        if (brandName) {
            brandName.textContent = roleConfig.brandName;
        }
    }

    const navLabels = roleConfig.navLabels || {};
    document.querySelectorAll('.nav-item, .sidebar-settings-link').forEach((item) => {
        const page = item.dataset.page;
        const label = item.querySelector('.nav-label');
        if (page && label && navLabels[page]) {
            label.textContent = navLabels[page];
        }
    });

    if (Array.isArray(roleConfig.sectionLabels) && roleConfig.sectionLabels.length) {
        const labels = document.querySelectorAll('.sidebar-section-label');
        roleConfig.sectionLabels.forEach((text, index) => {
            if (labels[index]) {
                labels[index].textContent = text;
            }
        });
    }
}

function applyRoleEntrance() {
    if (!isBodeguero()) {
        return;
    }

    document.body.classList.add('role-bodeguero-enter');
    window.setTimeout(() => {
        document.body.classList.remove('role-bodeguero-enter');
    }, 900);
}

function applyRolePermissions() {
    const user = getCurrentUser();
    if (!user) return;

    // Debug para identificar que esta llegando en la sesion
    console.log('[Permisos] Usuario actual:', {
        id_rol: user.id_rol,
        rol_id: user.rol_id,
        idRol: user.idRol,
        rol: user.rol,
        nombre: user.nombreCompleto
    });

    const roleKey = user.id_rol || user.rol_id || user.idRol;
    let allowedPages = getAllowedPagesForUser();

    if (!allowedPages) {
        if (user.rol === 'Administrador' || Number(roleKey) === 1) {
            console.log('[Permisos] Acceso total mantenido por rol Administrador');
            return;
        }
        console.warn('[Permisos] Rol no reconocido, aplicando restricciones maximas.');
        allowedPages = ['dashboard']; // Solo dashboard por seguridad
    }

    const navItems = document.querySelectorAll('.nav-item, .sidebar-settings-link');

    navItems.forEach((item) => {
        const page = item.dataset.page;
        if (!allowedPages.includes(page)) {
            item.style.display = 'none';
        }
    });

    const sidebarNav = document.querySelector('.sidebar-nav');
    if (!sidebarNav) return;

    const sections = Array.from(sidebarNav.children);
    let lastLabel = null;
    let hasVisibleItems = false;

    sections.forEach((el) => {
        if (el.classList.contains('sidebar-section-label')) {
            if (lastLabel && !hasVisibleItems) {
                lastLabel.style.display = 'none';
            }
            lastLabel = el;
            hasVisibleItems = false;
        } else if (el.classList.contains('nav-item')) {
            if (el.style.display !== 'none') {
                hasVisibleItems = true;
            }
        }
    });

    if (lastLabel && !hasVisibleItems) {
        lastLabel.style.display = 'none';
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
    const route = getRoutes()[page];
    const contentArea = document.getElementById('content-area');
    const user = getCurrentUser();

    // Verificacion de permisos
    if (user) {
        const allowedPages = getAllowedPagesForUser();
        if (allowedPages && !allowedPages.includes(page)) {
            console.error(`Acceso denegado a la pagina: ${page}`);
            renderBootstrapError('No tienes permisos para acceder a este modulo.');
            return;
        }
    }

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

window.adminNavigateToPage = function adminNavigateToPage(page) {
    const navigation = getNavigation();
    if (!navigation) {
        return;
    }

    const allowedPages = getAllowedPagesForUser();
    if (!allowedPages.includes(page)) {
        Toast.fire({ icon: 'warning', title: 'No tienes acceso a este modulo' });
        return;
    }

    navigation.setActiveNav(page);
    navigation.updatePageTitle(page, getRoutes);
    loadPage(page);
    window.location.hash = page;
};

function renderBootstrapError(message) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) {
        return;
    }

    contentArea.innerHTML = `
        <div class="glass-panel">
            <h2>No se pudo iniciar el panel</h2>
            <p class="text-muted">${message}</p>
        </div>
    `;
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
        const navigation = getNavigation();
        if (!navigation) {
            loadPage('settings');
            window.location.hash = 'settings';
            return;
        }

        navigation.setActiveNav('settings');
        navigation.updatePageTitle('settings', getRoutes);
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
