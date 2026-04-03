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
                ${escapeHtml(carrier.name)} · ${escapeHtml(carrier.plate)}
            </option>
        `).join('')}
    `;
}

export function renderDispatchCarrierSummary(carrier, summaryId = 'dispatch-carrier-summary') {
    const label = document.getElementById(summaryId);
    if (!label) {
        return;
    }

    label.textContent = carrier
        ? `${carrier.name} · ${carrier.plate} · ${carrier.routeName}`
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
        total += lineTotal;
        items += item.quantity;

        return `
            <article class="cart-item retail-cart-item">
                <div class="col-code">
                    <span class="cart-code-pill">${escapeHtml(product.code)}</span>
                </div>
                <div class="col-desc">
                    <strong class="cart-item-name">${escapeHtml(product.name)}</strong>
                    <span>${escapeHtml(product.category || 'Sin categoria')}</span>
                </div>
                <div class="col-qty">
                    <div class="cart-qty-controls">
                        <button class="qty-btn" type="button" onclick="${quantityUpdateFunction}('${product.id}', -1)">-</button>
                        <span class="qty-value">${formatQuantity(item.quantity, product.isWeighted)}</span>
                        <button class="qty-btn" type="button" onclick="${quantityUpdateFunction}('${product.id}', 1)">+</button>
                    </div>
                </div>
                <div class="col-discount">
                    <span class="discount-chip">$0</span>
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
    if (!list) {
        return;
    }

    if (!records.length) {
        list.innerHTML = '<div class="turn-history-empty">Aun no hay vales de despacho emitidos.</div>';
        return;
    }

    list.innerHTML = records.map((record) => `
            <article class="turn-history-item">
            <div class="turn-history-meta">
                <strong>DSP-${escapeHtml(record.id)}</strong>
                <span>${escapeHtml(record.createdAtLabel)}</span>
            </div>
            <strong>${escapeHtml(record.carrierName)} · ${escapeHtml(record.plate || '')}</strong>
            <p>${escapeHtml(record.branchName || record.saleReference || 'Despacho registrado')} · ${record.total ? `${formatQuantity(record.items || 0, false)} item(s) · Total referencial $${formatCurrency(record.total)}` : escapeHtml(record.status || 'PENDIENTE')}</p>
            <div class="sale-history-actions">
                <button class="summary-link-btn" type="button" onclick="openDispatchReceiptModal('${escapeHtml(record.id)}')">Comprobante</button>
            </div>
        </article>
    `).join('');
}
