export function toNumber(value) {
    return Number(String(value || '0').replace(',', '.'));
}

export function toInteger(value) {
    const numericValue = toNumber(value);
    if (Number.isNaN(numericValue)) return 0;
    return Math.round(numericValue);
}

export function formatCurrency(value) {
    const amount = toInteger(value);
    return `$${amount.toLocaleString('es-CL')}`;
}
