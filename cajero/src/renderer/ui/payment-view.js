import { formatCurrency } from '../utils/formatters.js';

export function openPaymentModalView({ documentType, total, customer }) {
    const totalLabel = document.getElementById('payment-total-label');
    const documentLabel = document.getElementById('payment-document-label');
    const customerLabel = document.getElementById('payment-customer-label');
    const taxLabel = document.getElementById('payment-tax-label');
    const copyLabel = document.getElementById('payment-modal-copy');
    const documentNote = document.getElementById('payment-document-note');
    const methodSelect = document.getElementById('payment-method-select');
    const receivedInput = document.getElementById('payment-received-input');
    const facturaRequiredFields = [
        ['rut', 'RUT'],
        ['name', 'razon social'],
        ['business', 'giro'],
        ['address', 'direccion'],
        ['comuna', 'comuna'],
        ['city', 'ciudad']
    ];
    const missingFacturaFields = facturaRequiredFields
        .filter(([key]) => !String(customer?.[key] || '').trim())
        .map(([, label]) => label);

    if (totalLabel) {
        totalLabel.textContent = `$${formatCurrency(total)}`;
    }

    if (documentLabel) {
        documentLabel.textContent = documentType;
    }

    if (customerLabel) {
        customerLabel.textContent = customer?.rut
            ? `${customer.name} · ${customer.rut}`
            : 'General';
    }

    if (taxLabel) {
        taxLabel.textContent = documentType === 'Vale interno' ? 'No fiscal' : 'Fiscal';
    }

    if (copyLabel) {
        copyLabel.textContent = documentType === 'Vale interno'
            ? `Confirma vale interno por $${formatCurrency(total)}.`
            : documentType === 'Factura'
                ? `Confirma factura para ${customer?.name || 'cliente'} por $${formatCurrency(total)}.`
                : `Confirma ${documentType.toLowerCase()} por $${formatCurrency(total)}.`;
    }

    if (documentNote) {
        if (documentType === 'Vale interno') {
            documentNote.textContent = 'Vale interno: no se envia al SII, pero igual debes cobrarlo en efectivo, tarjeta o transferencia.';
            documentNote.classList.remove('hidden');
        } else if (documentType === 'Factura') {
            documentNote.textContent = missingFacturaFields.length
                ? `Factura incompleta: faltan ${missingFacturaFields.join(', ')}. Completa la ficha del cliente antes de emitir al SII.`
                : `Factura lista para emitir al SII para ${customer.name} (${customer.rut}).`;
            documentNote.classList.remove('hidden');
        } else {
            documentNote.textContent = 'Boleta fiscal lista para emitir al SII al confirmar el cobro.';
            documentNote.classList.remove('hidden');
        }
    }

    if (methodSelect) {
        methodSelect.value = 'efectivo';
    }

    if (receivedInput) {
        receivedInput.value = String(total);
    }

    document.getElementById('payment-modal-backdrop')?.classList.remove('hidden');
    receivedInput?.focus();
    receivedInput?.select();
}

export function closePaymentModalView() {
    document.getElementById('payment-modal-backdrop')?.classList.add('hidden');
}

export function renderPaymentMethodView({ isCash, total }) {
    const receivedGroup = document.getElementById('payment-received-group');
    const receivedInput = document.getElementById('payment-received-input');

    receivedGroup?.classList.toggle('hidden', !isCash);

    if (isCash && receivedInput && !receivedInput.value) {
        receivedInput.value = String(total);
    }
}

export function renderPaymentChangeView({ method, total, received }) {
    const row = document.getElementById('payment-change-row');
    const label = document.getElementById('payment-change-label');

    if (method !== 'efectivo') {
        row?.classList.add('hidden');
        if (label) {
            label.textContent = '$0';
        }
        return;
    }

    const change = Math.max(0, received - total);

    row?.classList.remove('hidden');
    if (label) {
        label.textContent = `$${formatCurrency(change)}`;
    }
}
