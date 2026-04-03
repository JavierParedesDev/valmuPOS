import { escapeHtml, formatCurrency } from '../utils/formatters.js';

export function openInfoModalView({ title, message }) {
    const titleLabel = document.getElementById('info-modal-title');
    const messageLabel = document.getElementById('info-modal-message');

    if (titleLabel) {
        titleLabel.textContent = title || 'Aviso';
    }

    if (messageLabel) {
        messageLabel.textContent = message || '';
    }

    document.getElementById('info-modal-backdrop')?.classList.remove('hidden');
}

export function closeInfoModalView() {
    document.getElementById('info-modal-backdrop')?.classList.add('hidden');
}

export function openSaleCancellationModalView({ saleId, documentLabel, total }) {
    document.getElementById('sale-action-modal-title').textContent = 'Anular venta';
    document.getElementById('sale-action-modal-message').textContent = `Se anulara la venta #${saleId} (${documentLabel}) por $${formatCurrency(total)} y se devolvera el stock.`;
    document.getElementById('sale-action-reason-input').value = '';
    document.getElementById('sale-action-modal-backdrop')?.classList.remove('hidden');
    document.getElementById('sale-action-reason-input')?.focus();
}

export function closeSaleCancellationModalView() {
    document.getElementById('sale-action-modal-backdrop')?.classList.add('hidden');
}

export function setSaleActionStatusView(message) {
    const status = document.getElementById('sale-action-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle('hidden', !message);
}

export function openCashSessionModalView(openingAmount) {
    const amountInput = document.getElementById('cash-opening-amount-input');
    document.getElementById('cash-session-modal-backdrop')?.classList.remove('hidden');
    if (amountInput) {
        amountInput.value = String(Math.round(openingAmount || 0));
        amountInput.focus();
        amountInput.select();
    }
}

export function closeCashSessionModalView() {
    document.getElementById('cash-session-modal-backdrop')?.classList.add('hidden');
}

export function openInvoiceClientModalView(customer = null) {
    document.getElementById('invoice-client-search-input').value = '';
    document.getElementById('invoice-client-select').innerHTML = '<option value="">Cargando clientes...</option>';
    document.getElementById('invoice-rut-input').value = '';
    document.getElementById('invoice-name-input').value = '';
    document.getElementById('invoice-business-input').value = '';
    const currentCard = document.getElementById('invoice-client-current-card');
    if (currentCard) {
        if (customer?.id) {
            currentCard.textContent = `Cliente actual: ${customer.name}${customer.rut ? ` · ${customer.rut}` : ''}`;
            currentCard.classList.remove('hidden');
            currentCard.classList.add('invoice-current-card');
        } else {
            currentCard.textContent = '';
            currentCard.classList.add('hidden');
            currentCard.classList.remove('invoice-current-card');
        }
    }
    document.getElementById('invoice-client-modal-backdrop')?.classList.remove('hidden');
    document.getElementById('invoice-rut-input')?.focus();
}

export function closeInvoiceClientModalView() {
    document.getElementById('invoice-client-modal-backdrop')?.classList.add('hidden');
}

export function setInvoiceClientStatusView(message) {
    const status = document.getElementById('invoice-client-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle('hidden', !message);
}

export function renderInvoiceClientOptionsView(customers) {
    const select = document.getElementById('invoice-client-select');
    if (!select) {
        return;
    }

    if (!customers.length) {
        select.innerHTML = '<option value="">Sin clientes encontrados</option>';
        return;
    }

    select.innerHTML = `
        <option value="">Selecciona un cliente</option>
        ${customers.map((customer) => `
            <option value="${customer.id}">
                ${escapeHtml(customer.rut)} · ${escapeHtml(customer.name)}
            </option>
        `).join('')}
    `;
}

export function openCloseCashModalView({
    openingAmount,
    totalCash,
    totalCard,
    totalTransfer,
    totalInternal,
    totalSales,
    expectedCash
}) {
    document.getElementById('close-opening-amount').textContent = `$${formatCurrency(openingAmount)}`;
    document.getElementById('close-total-cash').textContent = `$${formatCurrency(totalCash)}`;
    document.getElementById('close-total-card').textContent = `$${formatCurrency(totalCard)}`;
    document.getElementById('close-total-transfer').textContent = `$${formatCurrency(totalTransfer)}`;
    document.getElementById('close-total-internal').textContent = `$${formatCurrency(totalInternal)}`;
    document.getElementById('close-total-sales').textContent = `$${formatCurrency(totalSales)}`;
    document.getElementById('close-expected-cash').textContent = `$${formatCurrency(expectedCash)}`;
    document.getElementById('close-counted-cash-input').value = String(Math.round(expectedCash));
    document.getElementById('close-counted-card-input').value = String(Math.round(totalCard));
    document.getElementById('close-counted-transfer-input').value = String(Math.round(totalTransfer));
    document.getElementById('close-cash-modal-backdrop')?.classList.remove('hidden');
}

export function closeCloseCashModalView() {
    document.getElementById('close-cash-modal-backdrop')?.classList.add('hidden');
}

export function openWeightedModalView({ productName, mode, currentQuantity }) {
    const nameLabel = document.getElementById('weighted-product-name');
    const quantityInput = document.getElementById('weighted-quantity-input');

    if (nameLabel) {
        nameLabel.textContent = mode === 'edit'
            ? `Edita el peso para ${productName}.`
            : `Ingresa el peso para ${productName}.`;
    }

    if (quantityInput) {
        quantityInput.value = Number(currentQuantity || 1).toFixed(3);
    }

    document.getElementById('weighted-modal-backdrop')?.classList.remove('hidden');
    quantityInput?.focus();
    quantityInput?.select();
}

export function closeWeightedModalView() {
    document.getElementById('weighted-modal-backdrop')?.classList.add('hidden');
}
