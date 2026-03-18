const ROUTES = {
    dashboard: { title: 'Dashboard', render: renderDashboard },
    users: { title: 'Usuarios', render: renderUsers },
    customers: { title: 'Clientes', render: renderCustomers },
    products: { title: 'Productos', render: renderProducts },
    categories: { title: 'Categorias', render: renderCategories },
    suppliers: { title: 'Proveedores', render: renderSuppliers },
    wastage: { title: 'Mermas', render: renderMermas },
    finances: { title: 'Finanzas', render: renderFinances },
    invoicing: { title: 'Facturacion', render: renderInvoicing },
    logistics: { title: 'Logistica', render: renderLogistics },
    branches: { title: 'Sucursales', render: renderBranches }
};

document.addEventListener('DOMContentLoaded', () => {
    enforceSession();
    hydrateUserProfile();
    bindNavigation();
    bindLogout();

    const initialPage = getInitialPage();
    setActiveNav(initialPage);
    updatePageTitle(initialPage);
    loadPage(initialPage);
});

function getInitialPage() {
    const requestedPage = window.location.hash.replace('#', '');
    return ROUTES[requestedPage] ? requestedPage : 'dashboard';
}

function bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();

            const page = item.dataset.page;
            if (!ROUTES[page]) {
                renderPlaceholderPage(page);
                return;
            }

            setActiveNav(page);
            updatePageTitle(page);
            loadPage(page);
            window.location.hash = page;
        });
    });
}

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

function setActiveNav(page) {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.page === page);
    });
}

function updatePageTitle(page) {
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = ROUTES[page]?.title || 'Valmu Admin';
    }
}

async function loadPage(page) {
    const route = ROUTES[page];
    const contentArea = document.getElementById('content-area');

    if (!route || !contentArea) {
        renderPlaceholderPage(page);
        return;
    }

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
