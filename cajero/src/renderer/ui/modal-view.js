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
    const isDispatchMode = document.getElementById('cashier-app')?.dataset?.view === 'dispatch';
    const titleLabel = document.querySelector('#invoice-client-modal-backdrop .modal-header h3');
    const subtitleLabel = document.querySelector('#invoice-client-modal-backdrop .modal-header p');
    document.getElementById('invoice-client-search-input').value = '';
    document.getElementById('invoice-client-select-list').innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #9ca3af; font-size: 0.95rem;">Cargando clientes...</div>';
    document.getElementById('invoice-rut-input').value = '';
    document.getElementById('invoice-name-input').value = '';
    document.getElementById('invoice-business-input').value = '';
    document.getElementById('invoice-address-input').value = '';
    document.getElementById('invoice-comuna-input').value = '';
    document.getElementById('invoice-phone-input').value = '';
    document.getElementById('invoice-email-input').value = '';

    // Show selection step by default
    showCustomerModalStepView('selection');

    if (titleLabel) {
        titleLabel.textContent = isDispatchMode ? 'Gestion de Cliente del Despacho' : 'Gestion de Cliente';
    }

    if (subtitleLabel) {
        subtitleLabel.textContent = isDispatchMode
            ? 'Busca un cliente existente o registra uno nuevo para usarlo en boleta o factura del despacho.'
            : 'Busca un cliente existente o registra uno nuevo para la factura.';
    }

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
}

export function showCustomerModalStepView(stepName) {
    const selection = document.getElementById('customer-selection-view');
    const search = document.getElementById('customer-search-view');
    const register = document.getElementById('customer-register-view');
    const subtitle = document.getElementById('customer-modal-subtitle');

    selection?.classList.add('hidden');
    search?.classList.add('hidden');
    register?.classList.add('hidden');

    if (stepName === 'selection') {
        selection?.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Busca un cliente existente o registra uno nuevo para la factura.';
    } else if (stepName === 'search') {
        search?.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Filtra y selecciona un cliente de la base de datos.';
        document.getElementById('invoice-client-search-input')?.focus();
    } else if (stepName === 'register') {
        register?.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Ingresa los datos completos para el nuevo cliente.';
        document.getElementById('invoice-rut-input')?.focus();
    }
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
    const listContainer = document.getElementById('invoice-client-select-list');
    if (!listContainer) {
        return;
    }

    if (!customers.length) {
        listContainer.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #9ca3af; font-size: 0.95rem;">Sin clientes encontrados</div>';
        return;
    }

    listContainer.innerHTML = customers.map((customer) => `
        <div class="selection-item" data-id="${customer.id}" id="customer-item-${customer.id}">
            <span class="item-main">${escapeHtml(customer.name)}</span>
            <span class="item-sub">${escapeHtml(customer.rut)}</span>
        </div>
    `).join('');
}

export function openCloseCashModalView({
    openingAmount,
    totalCash,
    totalCard,
    totalTransfer,
    totalInternal,
    totalWithdrawals,
    totalSales,
    expectedCash
}) {
    document.getElementById('close-opening-amount').textContent = `$${formatCurrency(openingAmount)}`;
    document.getElementById('close-total-cash').textContent = `$${formatCurrency(totalCash)}`;
    document.getElementById('close-total-card').textContent = `$${formatCurrency(totalCard)}`;
    document.getElementById('close-total-transfer').textContent = `$${formatCurrency(totalTransfer)}`;
    const expectedCardLabel = document.getElementById('close-card-expected');
    const expectedTransferLabel = document.getElementById('close-transfer-expected');
    document.getElementById('close-total-internal').textContent = `$${formatCurrency(totalInternal)}`;
    const withdrawalsLabel = document.getElementById('close-total-withdrawals');
    if (withdrawalsLabel) {
        withdrawalsLabel.textContent = `$${formatCurrency(totalWithdrawals || 0)}`;
    }
    if (expectedCardLabel) {
        expectedCardLabel.textContent = `$${formatCurrency(totalCard)}`;
    }
    if (expectedTransferLabel) {
        expectedTransferLabel.textContent = `$${formatCurrency(totalTransfer)}`;
    }
    document.getElementById('close-expected-cash').textContent = `$${formatCurrency(expectedCash)}`;
    document.getElementById('close-counted-cash-input').value = '0';
    document.getElementById('close-counted-card-input').value = String(Math.round(totalCard || 0));
    document.getElementById('close-counted-transfer-input').value = String(Math.round(totalTransfer || 0));
    document.getElementById('close-cash-modal-backdrop')?.classList.remove('hidden');
    document.getElementById('close-counted-cash-input')?.focus();
}

export function closeCloseCashModalView() {
    document.getElementById('close-cash-modal-backdrop')?.classList.add('hidden');
}

export function openWeightedModalView({ productName, mode, currentQuantity, isWeighted }) {
    const titleLabel = document.getElementById('weighted-modal-title');
    const nameLabel = document.getElementById('weighted-product-name');
    const quantityLabel = document.getElementById('weighted-quantity-label');
    const quantityInput = document.getElementById('weighted-quantity-input');
    const confirmButton = document.getElementById('weighted-confirm-btn');

    const modalTitle = isWeighted ? 'Producto pesable' : 'Editar cantidad';
    const helperText = mode === 'edit'
        ? (isWeighted ? `Edita el peso para ${productName}.` : `Edita la cantidad para ${productName}.`)
        : (isWeighted ? `Ingresa el peso para ${productName}.` : `Ingresa la cantidad para ${productName}.`);
    const inputLabel = isWeighted ? 'Cantidad en kg' : 'Cantidad en unidades';
    const step = isWeighted ? '0.001' : '1';
    const min = isWeighted ? '0.001' : '1';
    const placeholder = isWeighted ? '1.000' : '1';

    if (titleLabel) {
        titleLabel.textContent = modalTitle;
    }
    if (nameLabel) {
        nameLabel.textContent = helperText;
    }

    if (quantityLabel) {
        quantityLabel.textContent = inputLabel;
    }

    if (quantityInput) {
        quantityInput.value = isWeighted
            ? Number(currentQuantity || 1).toFixed(3)
            : String(Math.max(1, Number(currentQuantity || 1)));
        quantityInput.step = step;
        quantityInput.min = min;
        quantityInput.placeholder = placeholder;
    }

    if (confirmButton) {
        confirmButton.textContent = mode === 'edit' ? 'Guardar' : 'Agregar';
    }

    document.getElementById('weighted-modal-backdrop')?.classList.remove('hidden');
    quantityInput?.focus();
    quantityInput?.select();
}

export function closeWeightedModalView() {
    document.getElementById('weighted-modal-backdrop')?.classList.add('hidden');
}

export function openConfirmModalView({ title, message }) {
    const titleLabel = document.getElementById('confirm-modal-title');
    const messageLabel = document.getElementById('confirm-modal-message');

    if (titleLabel) titleLabel.textContent = title || 'Confirmar acción';
    if (messageLabel) messageLabel.textContent = message || '¿Estás seguro de realizar esta operación?';

    document.getElementById('confirm-modal-backdrop')?.classList.remove('hidden');
}

export function closeConfirmModalView() {
    document.getElementById('confirm-modal-backdrop')?.classList.add('hidden');
}
