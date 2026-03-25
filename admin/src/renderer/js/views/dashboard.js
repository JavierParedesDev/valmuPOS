async function renderDashboard() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <section class="dashboard-shell">
            <div class="glass-panel dashboard-hero">
                <div>
                    <p class="settings-eyebrow">Resumen general</p>
                    <h2>Vision rapida del sistema</h2>
                    <p class="text-muted">
                        Aqui iremos concentrando los indicadores mas importantes del panel. Por ahora dejamos una lectura real
                        del catalogo de productos cargado en el servidor.
                    </p>
                </div>
            </div>
            <div class="dashboard-grid">
                <article class="glass-panel dashboard-metric-card">
                    <span class="dashboard-metric-icon"><i class="bi bi-box-seam-fill"></i></span>
                    <p class="dashboard-metric-label">Total productos</p>
                    <strong id="dashboard-products-total">Cargando...</strong>
                    <p class="text-muted" id="dashboard-products-caption">Consultando catalogo del servidor.</p>
                </article>
                <article class="glass-panel dashboard-metric-card dashboard-metric-card-muted">
                    <p class="dashboard-metric-label">Proximamente</p>
                    <strong>Indicadores de ventas</strong>
                    <p class="text-muted">Esta area quedara lista para volumen comercial, margenes y rotacion.</p>
                </article>
            </div>
        </section>
    `;

    await hydrateDashboardProductCount();
}

async function hydrateDashboardProductCount() {
    const totalElement = document.getElementById('dashboard-products-total');
    const captionElement = document.getElementById('dashboard-products-caption');
    if (!totalElement || !captionElement) return;

    try {
        const token = getAuthToken();
        const response = await apiRequest({
            endpoint: '/productos?limit=5000&page=1&offset=0',
            method: 'GET',
            token
        });

        const totalFromHeaders = Number(
            response?.headers?.['x-total-count']
            || response?.headers?.['x-total']
            || response?.headers?.['x-pagination-total']
        );

        const totalFromBody = Number(
            response?.data?.total
            || response?.data?.count
            || response?.data?.totalProductos
        );

        const productTotal = Number.isFinite(totalFromHeaders) && totalFromHeaders > 0
            ? totalFromHeaders
            : Number.isFinite(totalFromBody) && totalFromBody > 0
                ? totalFromBody
                : Array.isArray(response?.data)
                    ? response.data.length
                    : NaN;

        if (response?.ok && Number.isFinite(productTotal)) {
            totalElement.textContent = productTotal.toLocaleString('es-CL');
            captionElement.textContent = 'Productos contados desde la respuesta actual del servidor.';
            return;
        }
    } catch (_error) {
        // Fallback below.
    }

    totalElement.textContent = '--';
    captionElement.textContent = 'No se pudo leer el total desde la API en este momento.';
}
