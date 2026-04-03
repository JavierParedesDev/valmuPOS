function formatCurrency(value) {
    return new Intl.NumberFormat('es-CL').format(Number(value || 0));
}

const advertisingState = {
    items: [],
    currentIndex: 0,
    timerId: null,
    currentPayload: null,
    failedUrls: new Set()
};

function formatItemCount(count) {
    const normalized = Number(count || 0);
    return `${normalized} ${normalized === 1 ? 'item' : 'items'}`;
}

function getApiBaseUrl() {
    return String(window.cajeroAPI?.apiBaseUrl || '').replace(/\/+$/, '');
}

function getApiOrigin() {
    return getApiBaseUrl().replace(/\/api$/i, '');
}

function buildAdvertisingImageUrl(item) {
    const route = String(item?.rutaImagen || item?.ruta || '').trim();
    if (!route) {
        return '';
    }

    if (/^https?:\/\//i.test(route)) {
        return route;
    }

    return `${getApiOrigin()}${route.startsWith('/') ? route : `/${route}`}`;
}

function getHealthyAdvertisingItems() {
    return advertisingState.items.filter((item) => {
        const url = buildAdvertisingImageUrl(item);
        return url && !advertisingState.failedUrls.has(url);
    });
}

function getCurrentAdvertisingItem() {
    const items = getHealthyAdvertisingItems();
    if (!items.length) {
        return null;
    }

    if (advertisingState.currentIndex >= items.length) {
        advertisingState.currentIndex = 0;
    }

    return items[advertisingState.currentIndex] || items[0] || null;
}

function renderAdvertising() {
    const idleContainer = document.getElementById('customer-idle-ad');
    const idleImage = document.getElementById('customer-idle-ad-image');
    const inlineContainer = document.getElementById('customer-inline-ad');
    const inlineImage = document.getElementById('customer-inline-ad-image');

    const item = getCurrentAdvertisingItem();
    const imageUrl = buildAdvertisingImageUrl(item);
    const hasItemsInCart = Number(advertisingState.currentPayload?.itemsCount || 0) > 0;
    const hasAdvertising = Boolean(imageUrl);
    const emptyState = document.querySelector('.customer-empty');

    if (emptyState) {
        emptyState.classList.toggle('hidden', hasAdvertising && !hasItemsInCart);
    }

    if (idleContainer) {
        idleContainer.classList.toggle('hidden', !hasAdvertising || hasItemsInCart);
    }

    if (inlineContainer) {
        inlineContainer.classList.toggle('hidden', !hasAdvertising || !hasItemsInCart);
    }

    if (idleImage && hasAdvertising) {
        idleImage.src = imageUrl;
        idleImage.alt = item?.titulo || 'Publicidad activa';
    }

    if (inlineImage && hasAdvertising) {
        inlineImage.src = imageUrl;
        inlineImage.alt = item?.titulo || 'Publicidad activa';
    }
}

function rotateAdvertising() {
    const items = getHealthyAdvertisingItems();
    if (items.length <= 1) {
        return;
    }

    advertisingState.currentIndex = (advertisingState.currentIndex + 1) % items.length;
    renderAdvertising();
}

function startAdvertisingRotation() {
    if (advertisingState.timerId) {
        window.clearInterval(advertisingState.timerId);
        advertisingState.timerId = null;
    }

    if (getHealthyAdvertisingItems().length <= 1) {
        return;
    }

    advertisingState.timerId = window.setInterval(rotateAdvertising, 7000);
}

async function loadAdvertising() {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
        advertisingState.items = [];
        renderAdvertising();
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/publicidad/activas`);
        const payload = await response.json().catch(() => []);

        advertisingState.items = Array.isArray(payload) ? payload : [];
        advertisingState.currentIndex = 0;
        advertisingState.failedUrls.clear();
        startAdvertisingRotation();
        renderAdvertising();
    } catch (_error) {
        advertisingState.items = [];
        renderAdvertising();
    }
}

function markAdvertisingImageAsFailed(imageUrl) {
    if (!imageUrl) {
        return;
    }

    advertisingState.failedUrls.add(imageUrl);
    advertisingState.currentIndex = 0;
    startAdvertisingRotation();
    renderAdvertising();
}

function bindAdvertisingImageGuards() {
    const idleImage = document.getElementById('customer-idle-ad-image');
    const inlineImage = document.getElementById('customer-inline-ad-image');

    [idleImage, inlineImage].forEach((imageElement) => {
        imageElement?.addEventListener('error', () => {
            markAdvertisingImageAsFailed(imageElement.currentSrc || imageElement.src);
        });
    });
}

function renderCustomerDisplay(payload = {}) {
    advertisingState.currentPayload = payload;
    const branchLabel = document.getElementById('customer-branch-label');
    const documentLabel = document.getElementById('customer-document-label');
    const itemsCountLabel = document.getElementById('customer-items-count');
    const itemsList = document.getElementById('customer-items-list');
    const statusLabel = document.getElementById('customer-status-label');
    const customerNameLabel = document.getElementById('customer-name-label');
    const totalLabel = document.getElementById('customer-total-label');

    if (branchLabel) branchLabel.textContent = payload.branchName || 'Sucursal';
    if (documentLabel) documentLabel.textContent = payload.documentType || 'Boleta';
    if (itemsCountLabel) itemsCountLabel.textContent = formatItemCount(payload.itemsCount);
    if (statusLabel) statusLabel.textContent = payload.statusLabel || 'Pantalla cliente lista';
    if (customerNameLabel) customerNameLabel.textContent = payload.customerLabel || 'Cliente general';
    if (totalLabel) totalLabel.textContent = payload.totalLabel || '$0';

    if (!itemsList) {
        return;
    }

    const cart = Array.isArray(payload.cart) ? payload.cart : [];
    if (!cart.length) {
        itemsList.innerHTML = `
            <div class="customer-empty ${advertisingState.items.length ? 'hidden' : ''}">
                <strong>${payload.mode === 'locked' ? 'Caja cerrada' : 'Bienvenido'}</strong>
                <p>${payload.mode === 'locked' ? 'La caja aun no esta lista para vender.' : 'Escanea tus productos para ver el detalle aqui.'}</p>
            </div>
        `;
        renderAdvertising();
        return;
    }

    itemsList.innerHTML = cart.map((item) => `
        <article class="customer-item">
            <div>
                <strong class="customer-item-name">${item.name || 'Producto'}</strong>
                <span class="customer-item-meta">${item.meta || ''}</span>
            </div>
            <div class="customer-item-qty">
                <strong>${item.quantityLabel || '0'}</strong>
                <span>${item.unitPriceLabel || '$0'} c/u</span>
            </div>
            <div class="customer-item-total">
                <strong>${item.lineTotalLabel || '$0'}</strong>
                <span>Total</span>
            </div>
        </article>
    `).join('');
    renderAdvertising();
}

async function bootCustomerDisplay() {
    bindAdvertisingImageGuards();

    if (typeof window.cajeroAPI?.onCustomerDisplayUpdate === 'function') {
        window.cajeroAPI.onCustomerDisplayUpdate(renderCustomerDisplay);
    }

    if (typeof window.cajeroAPI?.getCustomerDisplayState === 'function') {
        try {
            const result = await window.cajeroAPI.getCustomerDisplayState();
            if (result?.ok) {
                renderCustomerDisplay(result.payload);
            }
        } catch (_error) {
            renderCustomerDisplay();
        }
        return;
    }

    renderCustomerDisplay();
    await loadAdvertising();
    window.setInterval(loadAdvertising, 60000);
}

bootCustomerDisplay();
