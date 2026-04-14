import { formatCurrency, formatQuantity } from '../utils/formatters.js';
import { getPricingForProduct } from '../domain/pricing.js';

export function renderSelectedBranchView({ branches, selectedBranchId }) {
    const branchBadge = document.getElementById('branch-name-badge');
    const branchSelect = document.getElementById('branch-select');
    const selectedBranch = branches.find((branch) => String(branch.id_sucursal) === String(selectedBranchId));
    const fallbackName = selectedBranch?.nombreSucursal || `Sucursal ${selectedBranchId || '-'}`;

    if (branchBadge) {
        branchBadge.textContent = fallbackName;
    }

    if (branchSelect && selectedBranchId) {
        branchSelect.value = String(selectedBranchId);
    }
}

export function renderDocumentTypeView(documentType) {
    const label = document.getElementById('summary-document-label');
    const detail = document.getElementById('summary-document-detail');
    const totalCard = document.getElementById('sale-total-card');
    if (label) label.textContent = documentType;

    if (detail) {
        detail.textContent = documentType === 'Vale interno'
            ? 'No fiscal · no se envia al SII'
            : documentType === 'Factura'
                ? 'Fiscal · requiere cliente'
                : 'Fiscal · venta rapida';
    }

    const btnBoleta = document.getElementById('doc-boleta-toggle');
    const btnFactura = document.getElementById('doc-factura-toggle');

    if (btnBoleta) btnBoleta.classList.toggle('active', documentType === 'Boleta');
    if (btnFactura) btnFactura.classList.toggle('active', documentType === 'Factura');
    if (totalCard) totalCard.classList.toggle('is-internal-sale', documentType === 'Vale interno');
}

export function renderCustomerSummaryView(customer) {
    const label = document.getElementById('summary-customer-label');
    const detail = document.getElementById('summary-customer-detail');
    const clearButton = document.getElementById('clear-invoice-customer-btn');
    if (!label) {
        return;
    }

    label.textContent = customer?.name || 'General';

    if (detail) {
        detail.textContent = customer?.rut
            ? `${customer.name} · ${customer.rut}`
            : 'Cliente general';
    }

    clearButton?.classList.toggle('hidden', !customer?.id);
}

export function renderSearchResultsView(products) {
    const results = document.getElementById('product-search-results');
    if (!results) {
        return;
    }

    if (!products.length) {
        results.innerHTML = '';
        document.getElementById('product-search-overlay')?.classList.add('hidden');
        return;
    }

    document.getElementById('product-search-overlay')?.classList.remove('hidden');
    results.innerHTML = products.map((product) => `
        <button class="search-result-btn" type="button" onclick="selectProductForSale('${product.id}')">
            <div>
                <strong>${product.name}</strong>
                <span class="search-result-meta">${product.code} - ${product.category} - ${Number(product.stockActual || 0) <= 0 ? 'Sin stock en esta sucursal' : `Stock: ${formatQuantity(product.stockActual || 0, product.isWeighted)}`}</span>
            </div>
            <strong>${Number(product.stockActual || 0) <= 0 ? 'Sin stock' : `$${formatCurrency(product.price)}`}</strong>
        </button>
    `).join('');
}

export function renderCartView({ cart, products }) {
    const cartList = document.getElementById('cart-list');
    const totalLabel = document.getElementById('sale-total');
    const subtotalLabel = document.getElementById('summary-subtotal');
    const itemsLabel = document.getElementById('summary-items');

    if (!cartList || !totalLabel || !subtotalLabel || !itemsLabel) {
        return;
    }

    if (!cart.length) {
        cartList.innerHTML = `
            <div class="cart-empty">
                <strong>Sin productos</strong>
                <p>Escanea o busca para agregar al carrito.</p>
            </div>
        `;
        totalLabel.textContent = '$0';
        subtotalLabel.textContent = '$0';
        itemsLabel.textContent = '0';
        return;
    }

    let total = 0;
    let totalItems = 0;
    let totalDiscount = 0;

    cartList.innerHTML = cart.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return '';
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        const lineTotal = pricing.unitPrice * item.quantity;
        const lineDiscount = (product.price - pricing.unitPrice) * item.quantity;

        total += lineTotal;
        totalItems += item.quantity;
        totalDiscount += lineDiscount;

        const hasOffer = product.offerAvailable && product.offerPrice;
        const isOfferActive = Boolean(item.applyOffer);
        let discountHtml = '';

        if (hasOffer) {
            discountHtml = `
                <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: flex-end; width: 100%;">
                    <span class="discount-chip ${lineDiscount > 0 ? 'is-active' : ''}" ${lineDiscount > 0 ? 'style="background: rgba(249, 115, 22, 0.12); color: var(--primary-dark);"' : ''}>
                        ${lineDiscount > 0 ? '-$' + formatCurrency(lineDiscount) : '$0'}
                    </span>
                    <button class="cart-offer-btn ${isOfferActive ? 'active' : ''}" type="button" onclick="toggleCartItemOffer('${product.id}')" title="${isOfferActive ? 'Quitar Oferta' : 'Aplicar Oferta'}">
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
                    <span class="cart-code-pill">${product.code}</span>
                </div>
                <div class="col-desc">
                    <strong class="cart-item-name">${product.name}</strong>
                    <span>${product.category}</span>
                </div>
                <div class="col-qty">
                    <div class="cart-qty-controls">
                        <button class="qty-btn" type="button" onclick="updateCartItemQuantity('${product.id}', -1)">-</button>
                        ${product.isWeighted
                ? `<button class="qty-value-btn" type="button" onclick="openWeightedEditModal('${product.id}')">${formatQuantity(item.quantity, product.isWeighted)}</button>`
                : `<span class="qty-value">${formatQuantity(item.quantity, product.isWeighted)}</span>`}
                        <button class="qty-btn" type="button" onclick="updateCartItemQuantity('${product.id}', 1)">+</button>
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
                    <button class="remove-btn retail-remove-line-btn" type="button" onclick="removeCartItem('${product.id}')">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </article>
        `;
    }).join('');

    const subtotalCalc = Math.round(total / 1.19);
    const ivaCalc = total - subtotalCalc;

    const ivaLabel = document.getElementById('sale-tax') || document.getElementById('summary-iva');
    const discountLabel = document.getElementById('summary-discount');

    totalLabel.textContent = `$${formatCurrency(total)}`;
    subtotalLabel.textContent = `$${formatCurrency(subtotalCalc)}`;
    itemsLabel.textContent = formatQuantity(totalItems, false);
    if (ivaLabel) ivaLabel.textContent = `$${formatCurrency(ivaCalc)}`;
    if (discountLabel) discountLabel.textContent = totalDiscount > 0 ? `-$${formatCurrency(totalDiscount)}` : `$0`;
}

export function renderCatalogStatusView({ status, source }) {
    const statusLabel = document.getElementById('backend-status');
    const sourceBadge = document.getElementById('catalog-source-badge');

    if (statusLabel) {
        statusLabel.textContent = status;
    }

    if (sourceBadge) {
        sourceBadge.textContent = source === 'api' ? 'Catalogo real' : 'Catalogo demo';
    }
}
