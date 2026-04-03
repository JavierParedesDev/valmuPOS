import { normalizeApiBaseUrl, parseJsonResponse } from '../utils/formatters.js';

export async function fetchDispatchCarriers({ apiBaseUrl, token }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/despachos/transportes`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar los transportistas.');
    }

    return Array.isArray(payload) ? payload : [];
}

export async function fetchDispatchHistory({ apiBaseUrl, token }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/despachos`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo cargar el historial de despachos.');
    }

    return Array.isArray(payload) ? payload : [];
}

export async function createDispatchCarrier({ apiBaseUrl, token, carrier }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/despachos/transportes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            nombreTransporte: carrier?.name,
            patenteTransporte: carrier?.plate
        })
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo registrar el transportista.');
    }

    return payload;
}

export async function generateDispatchRequest({ apiBaseUrl, token, payload }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/despachos/generar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const result = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(result?.error || 'No se pudo generar el despacho.');
    }

    return result;
}
