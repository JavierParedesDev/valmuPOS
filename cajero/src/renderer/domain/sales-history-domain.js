export function normalizeSalesHistory(payload, formatDateTime) {
    return (Array.isArray(payload) ? payload : []).map((sale) => ({
        id: Number(sale.id_venta || 0),
        total: Number(sale.total || 0),
        document: String(sale.tipoDoc || 'Venta'),
        paymentMethod: String(sale.metodoPago || 'Sin pago'),
        isFiscal: Boolean(sale.esFiscal),
        rawDate: sale.fechaVenta,
        dateLabel: formatDateTime(sale.fechaVenta)
    })).filter((sale) => sale.id > 0);
}

export function applyCancelledSaleToSummary({ sale, turnSummaryState, persistTurnSummary, renderTurnSummary }) {
    if (!sale) {
        return;
    }

    const paymentMethod = String(sale.paymentMethod || '').toUpperCase();
    const total = Number(sale.total || 0);

    if (paymentMethod === 'EFECTIVO') {
        turnSummaryState.totalCash = Math.max(0, turnSummaryState.totalCash - total);
    } else if (paymentMethod === 'TARJETA') {
        turnSummaryState.totalCard = Math.max(0, turnSummaryState.totalCard - total);
    } else if (paymentMethod === 'TRANSFERENCIA') {
        turnSummaryState.totalTransfer = Math.max(0, turnSummaryState.totalTransfer - total);
    }

    if (sale.document === 'Vale interno') {
        turnSummaryState.totalInternal = Math.max(0, turnSummaryState.totalInternal - total);
    }

    turnSummaryState.salesCount = Math.max(0, turnSummaryState.salesCount - 1);
    persistTurnSummary();
    renderTurnSummary();
}

export function moveSaleToCancelled({ salesHistoryState, cancelledSale, reason, formatDateTime }) {
    if (!cancelledSale) {
        return;
    }

    salesHistoryState.items = salesHistoryState.items.filter((sale) => sale.id !== cancelledSale.id);
    salesHistoryState.cancelledItems.unshift({
        ...cancelledSale,
        dateLabel: formatDateTime(new Date().toISOString()),
        cancellationReason: reason
    });
    salesHistoryState.currentTab = 'cancelled';
}
