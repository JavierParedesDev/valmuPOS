console.log("Loading routes.js... renderInvoicing type:", typeof window.renderInvoicing);

function buildMissingRenderer(title, rendererName) {
    return async () => {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            return;
        }

        contentArea.innerHTML = `
            <div class="glass-panel">
                <h2>No se pudo cargar el modulo</h2>
                <p class="text-muted">Falta inicializar ${rendererName} para la vista ${title}.</p>
            </div>
        `;
    };
}

function resolveRenderer(rendererName, title) {
    const renderer = window[rendererName];
    if (typeof renderer === 'function') {
        return renderer;
    }

    console.warn(`Renderer unavailable during route registration: ${rendererName}`);
    return buildMissingRenderer(title, rendererName);
}

window.AdminRoutes = {
    dashboard: { title: 'Dashboard', render: resolveRenderer('renderDashboard', 'Dashboard') },
    users: { title: 'Usuarios', render: resolveRenderer('renderUsers', 'Usuarios') },
    customers: { title: 'Clientes', render: resolveRenderer('renderCustomers', 'Clientes') },
    products: { title: 'Productos', render: resolveRenderer('renderProducts', 'Productos') },
    categories: { title: 'Categorias', render: resolveRenderer('renderCategories', 'Categorias') },
    suppliers: { title: 'Proveedores', render: resolveRenderer('renderSuppliers', 'Proveedores') },
    wastage: { title: 'Mermas', render: resolveRenderer('renderMermas', 'Mermas') },
    finances: { title: 'Finanzas', render: resolveRenderer('renderFinances', 'Finanzas') },
    invoicing: { title: 'Facturacion', render: resolveRenderer('renderInvoicing', 'Facturacion') },
    dispatches: { title: 'Despachos', render: resolveRenderer('renderDispatches', 'Despachos') },
    transfers: { title: 'Historial Traslados', render: resolveRenderer('renderTransfersView', 'Historial Traslados') },
    'transfer-create': { title: 'Nuevo Traslado', render: resolveRenderer('renderTransferCreateView', 'Nuevo Traslado') },
    'inbound-create': { title: 'Ingreso de Stock', render: resolveRenderer('renderInboundCreateView', 'Ingreso de Stock') },
    logistics: { title: 'Logistica', render: resolveRenderer('renderLogistics', 'Logistica') },
    branches: { title: 'Sucursales', render: resolveRenderer('renderBranches', 'Sucursales') },
    advertising: { title: 'Publicidad', render: resolveRenderer('renderAdvertising', 'Publicidad') },
    settings: { title: 'Configuracion', render: resolveRenderer('renderSettings', 'Configuracion') }
};
console.log("AdminRoutes initialized:", !!window.AdminRoutes);
