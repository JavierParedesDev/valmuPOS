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

export function normalizeSearchValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function filterProductsLocally(term = '', source = []) {
    const normalizedTerm = normalizeSearchValue(term);
    if (!normalizedTerm) return source;

    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);

    return source.filter((product) => {
        const haystack = [
            product.nombreProducto,
            product.codigoBarras,
            product.nombreCategoria,
            product.nombreProveedor,
            product.familiaPromo
        ]
            .filter(Boolean)
            .map(normalizeSearchValue)
            .join(' ');

        return tokens.every((token) => haystack.includes(token));
    });
}
