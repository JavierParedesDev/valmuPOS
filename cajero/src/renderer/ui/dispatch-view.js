import { escapeHtml, formatCurrency, formatQuantity } from '../utils/formatters.js';
import { getPricingForProduct } from '../domain/pricing.js';

export function renderDispatchCarrierOptions({ carriers, selectedCarrierId, selectId = 'dispatch-carrier-select' }) {
    const carrierSelect = document.getElementById(selectId);
    if (!carrierSelect) {
        return;
    }

    carrierSelect.innerHTML = `
        <option value="">Seleccionar transportista</option>
        ${carriers.map((carrier) => `
            <option value="${carrier.id}" ${String(selectedCarrierId) === String(carrier.id) ? 'selected' : ''}>
                ${escapeHtml(carrier.name)} - ${escapeHtml(carrier.plate)}
            </option>
        `).join('')}
    `;
}

export function renderCarrierSelectionList(carriers, selectedCarrierId, listId = 'carrier-selection-list') {
    const list = document.getElementById(listId);
    if (!list) {
        return;
    }

    if (!carriers.length) {
        list.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #9ca3af;">Aun no hay transportistas registrados.</div>';
        return;
    }

    list.innerHTML = carriers.map((carrier) => `
        <button class="custom-selection-item ${String(selectedCarrierId) === String(carrier.id) ? 'selected' : ''}" 
            type="button" onclick="selectCarrierFromModal('${carrier.id}')">
            <div class="selection-item-info">
                <strong>${escapeHtml(carrier.name)}</strong>
                <span>Patente: ${escapeHtml(carrier.plate)}</span>
            </div>
            ${String(selectedCarrierId) === String(carrier.id) ? '<i class="bi bi-check-circle-fill selection-item-check"></i>' : ''}
        </button>
    `).join('');
}

export function updateCarrierTiles(carrier) {
    const mainName = document.getElementById('dispatch-carrier-name-display');
    const mainMeta = document.getElementById('dispatch-carrier-meta-display');
    const inlineName = document.getElementById('dispatch-inline-carrier-name-display');
    const inlineMeta = document.getElementById('dispatch-inline-carrier-meta-display');

    if (mainName) mainName.textContent = carrier ? carrier.name : 'Seleccionar transportista';
    if (mainMeta) mainMeta.textContent = carrier ? `Patente: ${carrier.plate}` : 'Toca para elegir de la lista';

    if (inlineName) inlineName.textContent = carrier ? carrier.name : 'Seleccionar transportista';
    if (inlineMeta) inlineMeta.textContent = carrier ? `Patente: ${carrier.plate}` : 'Toca para elegir de la lista';
}

export function updateDispatchCustomerTile(customer) {
    const tileName = document.getElementById('dispatch-customer-name-display');
    const tileMeta = document.getElementById('dispatch-customer-meta-display');

    if (tileName) {
        tileName.textContent = customer ? customer.name : 'Seleccionar cliente';
    }

    if (tileMeta) {
        tileMeta.textContent = customer
            ? [customer.rut, customer.address || customer.comuna || customer.city].filter(Boolean).join(' - ')
            : 'Toca para buscar o registrar cliente';
    }
}

export function updateDispatchAddressVisibility(selectedTypeId) {
    const addressShell = document.getElementById('dispatch-address-shell');
    if (!addressShell) {
        return;
    }

    // El usuario solicito poder ingresar la direccion siempre, para vales, boletas y facturas
    addressShell.classList.remove('hidden');
}

export function updateDispatchDocumentTypeUI(selectedTypeId) {
    const chips = document.querySelectorAll('.doc-chip');
    chips.forEach((chip) => {
        if (String(chip.getAttribute('data-type')) === String(selectedTypeId)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

export function renderDispatchCarrierSummary(carrier, summaryId = 'dispatch-carrier-summary') {
    const label = document.getElementById(summaryId);
    if (!label) {
        return;
    }

    label.textContent = carrier
        ? `${carrier.name} - ${carrier.plate} - ${carrier.routeName}`
        : 'Sin transportista seleccionado';
}

export function renderDispatchSearchResults(
    products,
    {
        listId = 'dispatch-search-results',
        overlayId = 'dispatch-search-overlay',
        onSelectFunction = 'selectProductForDispatch'
    } = {}
) {
    const list = document.getElementById(listId);
    const overlay = document.getElementById(overlayId);
    if (!list) {
        return;
    }

    if (!products.length) {
        list.innerHTML = '';
        overlay?.classList.add('hidden');
        return;
    }

    overlay?.classList.remove('hidden');
    list.innerHTML = products.map((product) => `
        <button class="search-result-btn" type="button" onclick="${onSelectFunction}('${product.id}')">
            <div>
                <strong>${escapeHtml(product.name)}</strong>
                <span class="search-result-meta">${escapeHtml(product.code)} - ${escapeHtml(product.category || 'Sin categoria')} - Stock: ${formatQuantity(product.stockActual || 0, product.isWeighted)}</span>
            </div>
            <strong>$${formatCurrency(product.price)}</strong>
        </button>
    `).join('');
}

export function renderDispatchCart({
    cart,
    products,
    listId = 'dispatch-cart-list',
    totalLabelId = 'dispatch-total-label',
    itemsLabelId = 'dispatch-items-label',
    quantityUpdateFunction = 'updateDispatchItemQuantity',
    removeFunction = 'removeDispatchItem'
}) {
    const list = document.getElementById(listId);
    const totalLabel = document.getElementById(totalLabelId);
    const itemsLabel = document.getElementById(itemsLabelId);

    if (!list || !totalLabel || !itemsLabel) {
        return;
    }

    if (!cart.length) {
        list.innerHTML = `
            <div class="cart-empty">
                <strong>Sin carga</strong>
                <p>Escanea o busca productos para preparar el vale del transportista.</p>
            </div>
        `;
        totalLabel.textContent = '$0';
        itemsLabel.textContent = '0';
        return;
    }

    let total = 0;
    let items = 0;

    list.innerHTML = cart.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return '';
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        const lineTotal = pricing.unitPrice * item.quantity;
        const lineDiscount = (product.price - pricing.unitPrice) * item.quantity;
        total += lineTotal;
        items += item.quantity;

        const hasOffer = product.offerAvailable && product.offerPrice;
        const isOfferActive = Boolean(item.applyOffer);
        const isWholesale = pricing.isWholesale;

        let discountHtml = '';
        if (hasOffer) {
            discountHtml = `
                <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: flex-end; width: 100%;">
                    <span class="discount-chip ${lineDiscount > 0 ? 'is-active' : ''}" ${lineDiscount > 0 ? 'style="background: rgba(249, 115, 22, 0.12); color: var(--primary-dark);"' : ''}>
                        ${lineDiscount > 0 ? '-$' + formatCurrency(lineDiscount) : '$0'}
                    </span>
                    <button class="cart-offer-btn ${isOfferActive ? 'active' : ''}" type="button" onclick="toggleDispatchItemOffer('${product.id}')" title="${isOfferActive ? 'Quitar Oferta' : 'Aplicar Oferta'}">
                        <i class="bi bi-tag-fill"></i>
                    </button>
                </div>
            `;
        } else {
            discountHtml = `
                <span class="discount-chip ${lineDiscount > 0 ? 'is-active' : ''}" ${lineDiscount > 0 ? 'style="background: rgba(249, 115, 22, 0.12); color: var(--primary-dark);"' : ''}>
                    ${lineDiscount > 0 ? '-$' + formatCurrency(lineDiscount) : '$0'}
                </span>
            `;
        }

        return `
            <article class="cart-item retail-cart-item">
                <div class="col-code">
                    <span class="cart-code-pill">${escapeHtml(product.code)}</span>
                </div>
                <div class="col-desc">
                    <strong class="cart-item-name">${escapeHtml(product.name)}</strong>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>${escapeHtml(product.category || 'Sin categoria')}</span>
                        ${isWholesale ? '<span class="badge badge-primary" style="font-size: 0.7rem; padding: 0.1rem 0.4rem; background: var(--primary-light); color: var(--primary-dark); border-radius: 4px;">MAYOREO</span>' : ''}
                    </div>
                </div>
                <div class="col-qty">
                    <div class="cart-qty-controls">
                        <button class="qty-btn" type="button" onclick="${quantityUpdateFunction}('${product.id}', -1)">-</button>
                        <button class="qty-value-btn" type="button" onclick="openDispatchQuantityEditModal('${product.id}')">${formatQuantity(item.quantity, product.isWeighted)}</button>
                        <button class="qty-btn" type="button" onclick="${quantityUpdateFunction}('${product.id}', 1)">+</button>
                    </div>
                </div>
                <div class="col-discount" style="display: flex; align-items: center; justify-content: flex-end;">
                    ${discountHtml}
                </div>
                <div class="col-total">
                    <strong class="cart-line-total">$${formatCurrency(lineTotal)}</strong>
                    <span class="cart-unit-meta">$${formatCurrency(pricing.unitPrice)} c/u</span>
                </div>
                <div class="col-action">
                    <button class="remove-btn retail-remove-line-btn" type="button" onclick="${removeFunction}('${product.id}')"><i class="bi bi-trash-fill"></i></button>
                </div>
            </article>
        `;
    }).join('');

    totalLabel.textContent = `$${formatCurrency(total)}`;
    itemsLabel.textContent = formatQuantity(items, false);
}

export function renderDispatchRecords(records, openDispatchReceiptModal) {
    const list = document.getElementById('dispatch-records-list');
    const count = document.getElementById('dispatch-history-count');
    if (!list) {
        return;
    }

    if (count) {
        count.textContent = String(records.length);
    }

    if (!records.length) {
        list.innerHTML = '<div class="turn-history-empty">Aun no hay vales de despacho emitidos.</div>';
        return;
    }

    list.innerHTML = records.map((record) => `
        <article class="turn-history-item" onclick="this.parentElement.querySelectorAll('.turn-history-item').forEach(el => el.classList.remove('is-active')); this.classList.add('is-active');">
            <div class="turn-history-meta">
                <strong>Despacho #DSP-${escapeHtml(record.id)}</strong>
                <span>${escapeHtml(record.createdAtLabel)}</span>
            </div>
            <div class="sale-history-badges">
                <span class="sale-history-badge is-internal">Despacho</span>
                <span class="sale-history-badge is-payment">${escapeHtml(record.status || 'EN RUTA')}</span>
            </div>
            <div class="turn-history-detail">$${formatCurrency(record.total || 0)}</div>
            <div class="product-actions-cell">
                <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="event.stopPropagation(); openDispatchReceiptModal('${escapeHtml(record.id)}')">Comprobante</button>
            </div>
        </article>
    `).join('');
}
