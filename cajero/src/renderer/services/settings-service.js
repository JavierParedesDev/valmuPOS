export function getSettingsSnapshot({ getSessionValue, sessionKeys }) {
    return {
        printerName: getSessionValue(sessionKeys.printerName) || 'Impresora termica 80mm',
        printerPaper: getSessionValue(sessionKeys.printerPaper) || '80mm',
        releaseRepo: getSessionValue(sessionKeys.releaseRepo) || 'JavierParedesDev/valmuPOS'
    };
}

export function savePrinterSettingsSnapshot({
    printerName,
    printerPaper,
    setSessionValue,
    sessionKeys
}) {
    const normalizedPrinterName = printerName || 'Impresora termica 80mm';
    const normalizedPrinterPaper = printerPaper || '80mm';

    setSessionValue(sessionKeys.printerName, normalizedPrinterName);
    setSessionValue(sessionKeys.printerPaper, normalizedPrinterPaper);

    return {
        printerName: normalizedPrinterName,
        printerPaper: normalizedPrinterPaper
    };
}

export function saveUpdateSettingsSnapshot({
    releaseRepo,
    setSessionValue,
    sessionKeys
}) {
    const normalizedRepo = String(releaseRepo || '').trim() || 'JavierParedesDev/valmuPOS';
    setSessionValue(sessionKeys.releaseRepo, normalizedRepo);
    return normalizedRepo;
}
