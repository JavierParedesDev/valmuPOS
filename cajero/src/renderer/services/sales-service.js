import { normalizeApiBaseUrl, parseJsonResponse } from '../utils/formatters.js';

export async function fetchSalesHistory({ apiBaseUrl, token }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/ventas`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo cargar el historial de ventas.');
    }

    return Array.isArray(payload) ? payload : [];
}

export async function cancelSaleRequest({ apiBaseUrl, token, saleId }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/ventas/${saleId}/anular`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo anular la venta.');
    }

    return payload;
}

export async function submitSaleRequest({ apiBaseUrl, token, payload }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/ventas`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const result = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(result?.error || 'No se pudo registrar la venta.');
    }

    return result;
}
