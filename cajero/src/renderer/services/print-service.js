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
            documentType: record.documentType,
            isFiscal: record.isFiscal,
            customerLabel: record.customerLabel,
            paymentMethod: record.paymentMethod,
            subtotal: record.subtotal,
            iva: record.iva,
            total: record.total,
            items: record.items,
            lineItems: Array.isArray(record.lineItems) ? record.lineItems : [],
            preview: record.preview
        }
    });

    if (!result?.ok) {
        throw new Error(result?.error || 'No se pudo imprimir el comprobante.');
    }

    return result;
}
