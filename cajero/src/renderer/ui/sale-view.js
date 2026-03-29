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
    if (label) {
        label.textContent = documentType;
    }
}

export function renderCustomerSummaryView(customer) {
    const label = document.getElementById('summary-customer-label');
    if (!label) {
        return;
    }

    label.textContent = customer?.name || 'General';
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

    cartList.innerHTML = cart.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
            return '';
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        const lineTotal = pricing.unitPrice * item.quantity;

        total += lineTotal;
        totalItems += item.quantity;

        return `
            <article class="cart-item">
                <div class="cart-item-side">
                    <div>
                        <strong class="cart-item-name">${product.name}</strong>
                        <span class="cart-item-meta">${product.code} - ${product.category}${product.isWeighted ? ' - Pesable' : ''}</span>
                    </div>
                    <div class="cart-item-pricing">
                        <span class="cart-item-price-badge">${pricing.label}</span>
                        <span>Unitario: $${formatCurrency(pricing.unitPrice)}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-qty-controls">
                        <button class="qty-btn" type="button" onclick="updateCartItemQuantity('${product.id}', -1)">-</button>
                        ${product.isWeighted
                            ? `<button class="qty-value-btn" type="button" onclick="openWeightedEditModal('${product.id}')">${formatQuantity(item.quantity, product.isWeighted)}</button>`
                            : `<span class="qty-value">${formatQuantity(item.quantity, product.isWeighted)}</span>`}
                        <button class="qty-btn" type="button" onclick="updateCartItemQuantity('${product.id}', 1)">+</button>
                    </div>
                    <strong class="cart-line-total">$${formatCurrency(lineTotal)}</strong>
                    <button class="remove-btn" type="button" onclick="removeCartItem('${product.id}')">Quitar</button>
                </div>
            </article>
        `;
    }).join('');

    totalLabel.textContent = `$${formatCurrency(total)}`;
    subtotalLabel.textContent = `$${formatCurrency(total)}`;
    itemsLabel.textContent = formatQuantity(totalItems, false);
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
