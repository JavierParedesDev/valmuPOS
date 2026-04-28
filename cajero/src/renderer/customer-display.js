function formatCurrency(value) {
    return new Intl.NumberFormat('es-CL').format(Number(value || 0));
}

const advertisingState = {
    items: [],
    currentIndex: 0,
    timerId: null,
    currentPayload: null,
    failedUrls: new Set(),
    lastCartKey: null,
    imageUrls: {
        idle: '',
        inline: '',
        fullscreen: ''
    }
};

function formatItemCount(count) {
    const normalized = Number(count || 0);
    return `${normalized} ${normalized === 1 ? 'item' : 'items'}`;
}

function getApiBaseUrl() {
    return String(window.cajeroAPI?.apiBaseUrl || '').replace(/\/+$/, '');
}

function getApiOrigin() {
    try {
        return new URL(getApiBaseUrl()).origin;
    } catch {
        return getApiBaseUrl().replace(/\/api$/i, '');
    }
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
    const fullscreenContainer = document.getElementById('customer-fullscreen-ad');
    const fullscreenImage = document.getElementById('customer-fullscreen-ad-image');

    const item = getCurrentAdvertisingItem();
    const imageUrl = buildAdvertisingImageUrl(item);
    const hasItemsInCart = Number(advertisingState.currentPayload?.itemsCount || 0) > 0;
    const hasAdvertising = Boolean(imageUrl);
    const emptyState = document.querySelector('.customer-empty');

    if (emptyState) {
        emptyState.classList.toggle('hidden', hasAdvertising && !hasItemsInCart);
    }

    if (idleContainer) {
        idleContainer.classList.add('hidden'); // Siempre oculto en favor del fullscreen
    }

    if (inlineContainer) {
        inlineContainer.classList.toggle('hidden', !hasAdvertising || !hasItemsInCart);
    }

    if (fullscreenContainer) {
        fullscreenContainer.classList.toggle('hidden', !hasAdvertising || hasItemsInCart);
    }

    setAdvertisingImage(idleImage, 'idle', imageUrl, item?.titulo || 'Publicidad activa', hasAdvertising);
    setAdvertisingImage(inlineImage, 'inline', imageUrl, item?.titulo || 'Publicidad activa', hasAdvertising);
    setAdvertisingImage(fullscreenImage, 'fullscreen', imageUrl, item?.titulo || 'Publicidad activa', hasAdvertising);
}

function setAdvertisingImage(imageElement, slot, imageUrl, altText, hasAdvertising) {
    if (!imageElement || !hasAdvertising) {
        return;
    }

    if (advertisingState.imageUrls[slot] !== imageUrl) {
        imageElement.src = imageUrl;
        advertisingState.imageUrls[slot] = imageUrl;
    }

    if (imageElement.alt !== altText) {
        imageElement.alt = altText;
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

async function apiRequest({ endpoint, method = 'GET', body }) {
    try {
        const baseUrl = getApiBaseUrl();
        const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return { ok: response.ok, status: response.status, data };
        } catch {
            return { ok: response.ok, status: response.status, data: text };
        }
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

async function loadAdvertising() {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
        advertisingState.items = [];
        renderAdvertising();
        return;
    }

    try {
        const response = await apiRequest({ endpoint: '/publicidad/activas' });
        const images = response.ok && Array.isArray(response.data) ? response.data : null;

        if (Array.isArray(images)) {
            advertisingState.items = images;
        } else {
            advertisingState.items = [];
        }

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
    const fullscreenImage = document.getElementById('customer-fullscreen-ad-image');

    [idleImage, inlineImage, fullscreenImage].forEach((imageElement) => {
        imageElement?.addEventListener('error', () => {
            markAdvertisingImageAsFailed(imageElement.currentSrc || imageElement.src);
        });
    });
}

function renderCustomerDisplay(payload = {}) {
    advertisingState.currentPayload = payload;
    const displayRoot = document.querySelector('.customer-display');
    const branchLabel = document.getElementById('customer-branch-label');
    const itemsCountLabel = document.getElementById('customer-items-count');
    const itemsList = document.getElementById('customer-items-list');
    const statusLabel = document.getElementById('customer-status-label');
    const customerNameLabel = document.getElementById('customer-name-label');
    const totalLabel = document.getElementById('customer-total-label');

    if (branchLabel) branchLabel.textContent = payload.branchName || 'Sucursal';
    if (itemsCountLabel) itemsCountLabel.textContent = formatItemCount(payload.itemsCount);
    if (statusLabel) statusLabel.textContent = payload.statusLabel || 'Pantalla cliente lista';
    if (customerNameLabel) customerNameLabel.textContent = payload.customerLabel || 'Cliente general';
    if (totalLabel) totalLabel.textContent = payload.totalLabel || '$0';

    if (!itemsList) {
        return;
    }

    const cart = Array.isArray(payload.cart) ? payload.cart : [];
    const compactLevel = cart.length >= 12 ? 'dense' : (cart.length >= 5 ? 'compact' : '');

    if (displayRoot) {
        displayRoot.classList.toggle('customer-display-compact', compactLevel === 'compact');
        displayRoot.classList.toggle('customer-display-dense', compactLevel === 'dense');
    }

    // Identificador único para el estado actual del carrito
    const cartKey = cart
        .map((item) => [
            item.id,
            item.name,
            item.meta,
            item.quantityLabel,
            item.unitPriceLabel,
            item.lineTotalLabel
        ].join(':'))
        .join('|');

    if (cartKey === advertisingState.lastCartKey) {
        syncScroll(payload, itemsList);
        renderAdvertising();
        return;
    }

    advertisingState.lastCartKey = cartKey;

    // Si no hay items, limpiamos la lista pero mantenemos el contenedor de publicidad
    if (!cart.length) {
        let emptyState = itemsList.querySelector('.customer-empty');
        if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.className = 'customer-empty';
            itemsList.appendChild(emptyState);
        }

        emptyState.innerHTML = `
            <strong>${payload.mode === 'locked' ? 'Caja cerrada' : 'Bienvenido'}</strong>
            <p>${payload.mode === 'locked' ? 'La caja aun no esta lista para vender.' : 'Escanea tus productos para ver el detalle aqui.'}</p>
        `;

        itemsList.querySelectorAll('.customer-item').forEach(el => el.remove());
        itemsList.scrollTop = 0;

        renderAdvertising();
        return;
    }

    // Si hay items, removemos el empty state y renderizamos los items
    itemsList.querySelector('.customer-empty')?.remove();
    itemsList.querySelectorAll('.customer-item').forEach(el => el.remove());

    const fragment = document.createDocumentFragment();

    cart.forEach((item, index) => {
        const article = document.createElement('article');
        article.className = `customer-item${index === 0 ? ' is-latest' : ''}`;
        article.innerHTML = `
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
        `;
        fragment.appendChild(article);
    });

    itemsList.appendChild(fragment);
    syncScroll(payload, itemsList);
    renderAdvertising();
}

function syncScroll(payload, itemsList) {
    if (!itemsList) return;

    const sourceScrollTop = Number(payload?.scrollState?.top || 0);
    const sourceScrollHeight = Number(payload?.scrollState?.height || 0);
    const sourceViewport = Number(payload?.scrollState?.viewport || 0);
    const sourceMaxScroll = Math.max(0, sourceScrollHeight - sourceViewport);
    const targetMaxScroll = Math.max(0, itemsList.scrollHeight - itemsList.clientHeight);
    const nextScrollTop = sourceMaxScroll > 0
        ? Math.round((sourceScrollTop / sourceMaxScroll) * targetMaxScroll)
        : 0;

    itemsList.scrollTop = nextScrollTop;
}

async function bootCustomerDisplay() {
    bindAdvertisingImageGuards();

    if (typeof window.cajeroAPI?.onCustomerDisplayUpdate === 'function') {
        window.cajeroAPI.onCustomerDisplayUpdate(renderCustomerDisplay);
    }

    await loadAdvertising();
    window.setInterval(loadAdvertising, 120000);

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
}

bootCustomerDisplay();
