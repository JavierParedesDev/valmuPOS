import { formatCurrency, formatDateTime, escapeHtml } from '../utils/formatters.js';
import { getExpectedCashAmount } from '../domain/turn-domain.js';

export function renderCashSessionView({ cashSessionState }) {
    const badge = document.getElementById('cash-session-badge');
    const title = document.getElementById('cash-session-title');
    const copy = document.getElementById('cash-session-copy');
    const button = document.getElementById('open-cash-session-btn');
    const closeButton = document.getElementById('close-cash-session-btn');
    const cashViewStatus = document.getElementById('cash-view-status-label');
    const cashViewOpening = document.getElementById('cash-view-opening-label');
    const cashViewOpenedAt = document.getElementById('cash-view-opened-at-label');
    const overlay = document.getElementById('sale-lock-overlay');
    const searchInput = document.getElementById('product-search-input');

    if (badge) {
        badge.textContent = cashSessionState.isOpen ? 'Caja abierta' : 'Caja cerrada';
    }

    if (title) {
        title.textContent = cashSessionState.isOpen
            ? `Turno activo · Fondo $${formatCurrency(cashSessionState.openingAmount)}`
            : 'Caja cerrada';
    }

    if (copy) {
        copy.textContent = cashSessionState.isOpen
            ? `Turno iniciado ${formatDateTime(cashSessionState.openedAt)}`
            : 'Debes abrir caja para empezar a vender.';
    }

    if (button) {
        button.disabled = cashSessionState.isOpen;
        button.textContent = cashSessionState.isOpen ? 'Caja abierta' : 'Abrir caja';
    }

    closeButton?.classList.toggle('hidden', !cashSessionState.isOpen);

    if (cashViewStatus) {
        cashViewStatus.textContent = cashSessionState.isOpen ? 'Caja abierta' : 'Caja cerrada';
    }

    if (cashViewOpening) {
        cashViewOpening.textContent = `$${formatCurrency(cashSessionState.openingAmount)}`;
    }

    if (cashViewOpenedAt) {
        cashViewOpenedAt.textContent = cashSessionState.isOpen
            ? formatDateTime(cashSessionState.openedAt)
            : 'Sin turno';
    }

    overlay?.classList.toggle('hidden', cashSessionState.isOpen);

    if (searchInput) {
        searchInput.disabled = !cashSessionState.isOpen;
        if (cashSessionState.isOpen) {
            searchInput.focus();
        } else {
            searchInput.blur();
        }
    }
}

export function renderTurnSummaryView({ turnSummaryState }) {
    const salesCount = document.getElementById('turn-sales-count');
    const totalCash = document.getElementById('turn-total-cash');
    const totalCard = document.getElementById('turn-total-card');
    const totalTransfer = document.getElementById('turn-total-transfer');
    const totalInternal = document.getElementById('turn-total-internal');
    const expectedCash = document.getElementById('turn-expected-cash');

    if (salesCount) {
        salesCount.textContent = String(turnSummaryState.salesCount);
    }

    if (totalCash) {
        totalCash.textContent = `$${formatCurrency(turnSummaryState.totalCash)}`;
    }

    if (totalCard) {
        totalCard.textContent = `$${formatCurrency(turnSummaryState.totalCard)}`;
    }

    if (totalTransfer) {
        totalTransfer.textContent = `$${formatCurrency(turnSummaryState.totalTransfer)}`;
    }

    if (totalInternal) {
        totalInternal.textContent = `$${formatCurrency(turnSummaryState.totalInternal)}`;
    }

    if (expectedCash) {
        expectedCash.textContent = `$${formatCurrency(getExpectedCashAmount())}`;
    }
}

export function renderTurnHistoryView(entries) {
    const list = document.getElementById('turn-history-list');
    const count = document.getElementById('turn-history-count');

    if (!list || !count) {
        return;
    }

    count.textContent = String(entries.length);

    if (!entries.length) {
        list.innerHTML = '<div class="turn-history-empty">Sin movimientos aun.</div>';
        return;
    }

    list.innerHTML = entries.map((entry) => `
        <article class="turn-history-item">
            <div class="turn-history-meta">
                <strong>${escapeHtml(entry.title)}</strong>
                <span>${formatDateTime(entry.createdAt)}</span>
            </div>
            <div class="turn-history-detail">${escapeHtml(entry.detail)}</div>
        </article>
    `).join('');
}

export function renderSalesHistoryView({ salesHistoryState, openSaleCancellationModal, openSaleReceiptModal }) {
    const list = document.getElementById('sales-history-list');
    const count = document.getElementById('sales-history-count');
    const activeTabButton = document.getElementById('sales-tab-active-btn');
    const cancelledTabButton = document.getElementById('sales-tab-cancelled-btn');

    if (!list || !count || !activeTabButton || !cancelledTabButton) {
        return;
    }

    const isCancelledTab = salesHistoryState.currentTab === 'cancelled';
    const selectedItems = isCancelledTab ? salesHistoryState.cancelledItems : salesHistoryState.items;
    activeTabButton.classList.toggle('active', !isCancelledTab);
    cancelledTabButton.classList.toggle('active', isCancelledTab);
    count.textContent = String(selectedItems.length);

    if (!selectedItems.length) {
        list.innerHTML = `<div class="turn-history-empty">${isCancelledTab ? 'Sin ventas anuladas aun.' : 'Sin ventas registradas aun.'}</div>`;
        return;
    }

    window.openSaleCancellationModal = openSaleCancellationModal;
    window.openSaleReceiptModal = openSaleReceiptModal;

    list.innerHTML = selectedItems.map((sale) => {
        const documentBadge = `<span class="sale-history-badge ${sale.isFiscal ? 'is-fiscal' : 'is-internal'}">${escapeHtml(sale.document)}</span>`;
        const fiscalBadge = `<span class="sale-history-badge ${sale.isFiscal ? 'is-fiscal' : 'is-internal'}">${sale.isFiscal ? 'Fiscal' : 'No fiscal'}</span>`;
        const paymentBadge = `<span class="sale-history-badge is-payment">${escapeHtml(sale.paymentMethod)}</span>`;
        const actionBlock = isCancelledTab
            ? `<div class="turn-history-detail">Motivo: ${escapeHtml(sale.cancellationReason || 'Sin motivo registrado')}</div>
               <div class="product-actions-cell" style="justify-content:flex-start; margin-top:0.35rem;">
                   <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openSaleReceiptModal(${sale.id})">Comprobante</button>
               </div>`
            : `<div class="product-actions-cell" style="justify-content:flex-start; margin-top:0.35rem;">
                <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openSaleReceiptModal(${sale.id})">Comprobante</button>
                <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openSaleCancellationModal(${sale.id}, '${escapeHtml(sale.document)}', ${sale.total})">Anular</button>
            </div>`;

        return `
            <article class="turn-history-item">
                <div class="turn-history-meta">
                    <strong>Venta #${escapeHtml(sale.id)}</strong>
                    <span>${escapeHtml(sale.dateLabel)}</span>
                </div>
                <div class="sale-history-badges">
                    ${documentBadge}
                    ${fiscalBadge}
                    ${paymentBadge}
                </div>
                <div class="turn-history-detail">Total: $${formatCurrency(sale.total)}</div>
                ${actionBlock}
            </article>
        `;
    }).join('');
}

export function renderCloseCashDifferenceView({ turnSummaryState, countedCash, countedCard, countedTransfer, formatDifferenceLabel }) {
    const expectedCash = getExpectedCashAmount();
    const cashDifference = countedCash - expectedCash;
    const cardDifference = countedCard - Number(turnSummaryState.totalCard || 0);
    const transferDifference = countedTransfer - Number(turnSummaryState.totalTransfer || 0);
    const totalDifference = cashDifference + cardDifference + transferDifference;
    const cashDifferenceLabel = document.getElementById('close-cash-difference');
    const cardDifferenceLabel = document.getElementById('close-card-difference');
    const transferDifferenceLabel = document.getElementById('close-transfer-difference');
    const totalDifferenceLabel = document.getElementById('close-total-difference');

    if (!cashDifferenceLabel || !cardDifferenceLabel || !transferDifferenceLabel || !totalDifferenceLabel) {
        return;
    }

    cashDifferenceLabel.textContent = formatDifferenceLabel(cashDifference);
    cardDifferenceLabel.textContent = formatDifferenceLabel(cardDifference);
    transferDifferenceLabel.textContent = formatDifferenceLabel(transferDifference);
    totalDifferenceLabel.textContent = formatDifferenceLabel(totalDifference);
}

export function setBackendStatusView(message) {
    const status = document.getElementById('backend-status');
    if (status) {
        status.textContent = message;
    }
}
