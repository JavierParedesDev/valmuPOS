export function normalizeSalesHistory(payload, formatDateTime) {
    return (Array.isArray(payload) ? payload : []).map((sale) => ({
        id: Number(sale.id_venta || 0),
        total: Number(sale.total || 0),
        document: String(sale.tipoDoc || 'Venta'),
        paymentMethod: String(sale.metodoPago || 'Sin pago'),
        origin: String(sale.origenVenta || sale.origen_venta || 'CAJA').toUpperCase(),
        paymentCash: Number(sale.pago_efectivo || sale.pagoEfectivo || 0),
        paymentCard: Number(sale.pago_tarjeta || sale.pagoTarjeta || 0),
        paymentTransfer: Number(sale.pago_transferencia || sale.pagoTransferencia || 0),
        isFiscal: Boolean(sale.esFiscal),
        folioDocumento: sale.folioDocumento || sale.folio || sale.numeroFolio || null,
        tipoDte: Number(sale.tipoDte || sale.tipo_dte || sale.dteType || 0) || null,
        rutReceptor: sale.rutReceptor || sale.rut_receptor || sale.rutCliente || null,
        customerRut: sale.rutCliente || sale.rut_receptor || null,
        estadoSii: sale.estadoSii || sale.estado_sii || null,
        trackId: sale.trackId || sale.track_id || null,
        fechaDte: sale.fechaDte || sale.fecha_dte || (sale.fechaVenta ? String(sale.fechaVenta).slice(0, 10) : null),
        rawDate: sale.fechaVenta,
        dateLabel: formatDateTime(sale.fechaVenta),
        userId: Number(sale.id_usuario || sale.idUsuario || sale.id_vendedor || 0)
    })).filter((sale) => sale.id > 0);
}

export function applyCancelledSaleToSummary({ sale, turnSummaryState, persistTurnSummary, renderTurnSummary }) {
    if (!sale) {
        return;
    }

    const paymentMethod = String(sale.paymentMethod || '').toUpperCase();
    const total = Number(sale.total || 0);
    const paymentCash = Number(sale.paymentCash || 0);
    const paymentCard = Number(sale.paymentCard || 0);
    const paymentTransfer = Number(sale.paymentTransfer || 0);

    if (paymentMethod === 'EFECTIVO') {
        turnSummaryState.totalCash = Math.max(0, turnSummaryState.totalCash - total);
    } else if (paymentMethod === 'TARJETA') {
        turnSummaryState.totalCard = Math.max(0, turnSummaryState.totalCard - total);
    } else if (paymentMethod === 'TRANSFERENCIA') {
        turnSummaryState.totalTransfer = Math.max(0, turnSummaryState.totalTransfer - total);
    } else if (paymentMethod === 'MIXTO') {
        turnSummaryState.totalCash = Math.max(0, turnSummaryState.totalCash - paymentCash);
        turnSummaryState.totalCard = Math.max(0, turnSummaryState.totalCard - paymentCard);
        turnSummaryState.totalTransfer = Math.max(0, turnSummaryState.totalTransfer - paymentTransfer);
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
