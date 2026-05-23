export async function printReceiptRecord({
    record,
    printerName,
    printerPaper,
    printReceipt
}) {
    if (!record) {
        throw new Error('No hay comprobante disponible para imprimir.');
    }

    if (typeof printReceipt !== 'function') {
        throw new Error('La impresion no esta disponible en este equipo.');
    }

    const result = await printReceipt({
        printerName,
        printerPaper,
        receipt: {
            saleId: record.saleId,
            date: record.date,
            dateLabel: record.dateLabel,
            referenceLabel: record.referenceLabel,
            documentType: record.documentType,
            isStockPicking: Boolean(record.isStockPicking),
            isFiscal: record.isFiscal,
            customerLabel: record.customerLabel,
            paymentMethod: record.paymentMethod,
            paymentCash: record.paymentCash,
            paymentCard: record.paymentCard,
            paymentTransfer: record.paymentTransfer,
            subtotal: record.subtotal,
            iva: record.iva,
            total: record.total,
            stockGroups: Array.isArray(record.stockGroups) ? record.stockGroups : [],
            items: record.items,
            lineItems: Array.isArray(record.lineItems) ? record.lineItems : [],
            preview: record.preview,
            footerMessage: record.footerMessage,
            addressLabel: record.addressLabel,
            origin: record.origin,
            emisor: record.emisor,
            dte: {
                tipo: record.tipoDte,
                folio: record.folioDocumento,
                fecha: record.fechaDte,
                ted: record.ted,
                xml: record.xmlContent
            }
        }
    });

    if (!result?.ok) {
        const debugSuffix = result?.debugDir ? ` Logs: ${result.debugDir}` : '';
        throw new Error(`${result?.error || 'No se pudo imprimir el comprobante.'}${debugSuffix}`);
    }

    return result;
}
