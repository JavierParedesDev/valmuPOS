export function formatCurrency(value) {
    return Math.round(Number(value || 0)).toLocaleString('es-CL');
}

export function formatQuantity(value, isWeighted) {
    if (isWeighted) {
        return `${Number(value || 0).toFixed(3)} kg`;
    }

    return Math.round(Number(value || 0)).toLocaleString('es-CL');
}

export function formatDateTime(isoDate) {
    if (!isoDate) {
        return 'hace un momento';
    }

    return new Date(isoDate).toLocaleString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    });
}

export function capitalizePaymentMethod(method) {
    if (method === 'tarjeta') {
        return 'Tarjeta';
    }

    if (method === 'transferencia') {
        return 'Transferencia';
    }

    return 'Efectivo';
}

export function normalizeApiBaseUrl(url) {
    return String(url || '')
        .trim()
        .replace(/\/+$/, '');
}

export async function parseJsonResponse(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}

export function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
