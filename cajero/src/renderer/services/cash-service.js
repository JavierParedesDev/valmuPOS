import { normalizeApiBaseUrl, parseJsonResponse } from '../utils/formatters.js';

export async function fetchCashStatus({ apiBaseUrl, token }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/caja/estado`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'Error al verificar estado de caja');
    }

    return payload;
}

export async function openCashTurn({ apiBaseUrl, token, openingAmount }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/caja/abrir`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            montoInicial: Math.round(openingAmount)
        })
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'Error al abrir la caja');
    }

    return payload;
}

export async function closeCashTurn({ apiBaseUrl, token, totals }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/caja/cerrar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            totalEfectivo: Math.round(totals.cash || 0),
            totalTarjeta: Math.round(totals.card || 0),
            totalTransferencia: Math.round(totals.transfer || 0)
        })
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo cerrar la caja.');
    }

    return payload;
}
