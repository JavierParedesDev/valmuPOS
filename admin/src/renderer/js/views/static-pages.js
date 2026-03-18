function renderConstructionPage({ title, description }) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <section class="glass-panel" style="padding: 2.5rem; text-align: center; max-width: 720px; margin: 2rem auto;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">En construccion</div>
            <h2 style="margin-bottom: 0.75rem;">${title}</h2>
            <p class="text-muted" style="font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem;">
                ${description}
            </p>
            <div class="badge badge-warning" style="font-size: 0.85rem; padding: 0.5rem 0.9rem;">
                Estamos trabajando en esta seccion
            </div>
        </section>
    `;
}

function renderFinances() {
    renderConstructionPage({
        title: 'Finanzas',
        description: 'Estamos construyendo paneles financieros, balances y reportes para esta seccion.'
    });
}

function renderInvoicing() {
    renderConstructionPage({
        title: 'Facturacion',
        description: 'Estamos preparando la gestion de documentos, folios y estados de facturacion.'
    });
}

function renderLogistics() {
    renderConstructionPage({
        title: 'Logistica',
        description: 'Estamos desarrollando rutas, despachos y seguimiento operativo para esta seccion.'
    });
}
