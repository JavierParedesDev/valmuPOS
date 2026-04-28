export function getSettingsSnapshot({ getSessionValue, sessionKeys }) {
    return {
        printerName: getSessionValue(sessionKeys.printerName) || 'Impresora termica 80mm',
        printerPaper: getSessionValue(sessionKeys.printerPaper) || '80mm',
        customerDisplayEnabled: getSessionValue(sessionKeys.customerDisplayEnabled) === 'true',
        customerDisplayTarget: getSessionValue(sessionKeys.customerDisplayTarget) || '',
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

export function saveCustomerDisplaySettingsSnapshot({
    customerDisplayEnabled,
    customerDisplayTarget,
    setSessionValue,
    sessionKeys
}) {
    const isEnabled = Boolean(customerDisplayEnabled);
    const normalizedTarget = String(customerDisplayTarget || '').trim();
    setSessionValue(sessionKeys.customerDisplayEnabled, String(isEnabled));
    setSessionValue(sessionKeys.customerDisplayTarget, normalizedTarget);
    return {
        customerDisplayEnabled: isEnabled,
        customerDisplayTarget: normalizedTarget
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
