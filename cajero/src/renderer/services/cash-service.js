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

export async function closeCashTurn({ apiBaseUrl, token, totals, differences, observation }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/caja/cerrar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            monto_efectivo: Math.round(totals.cash || 0),
            monto_tarjeta: Math.round(totals.card || 0),
            monto_transferencia: Math.round(totals.transfer || 0),
            monto_interno: Math.round(totals.internal || 0),
            diferencia_efectivo: Math.round(differences?.cash || 0),
            diferencia_tarjeta: Math.round(differences?.card || 0),
            diferencia_transferencia: Math.round(differences?.transfer || 0),
            observaciones: observation || ''
        })
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo cerrar la caja.');
    }

    return payload;
}

export async function registerCashWithdrawal({ apiBaseUrl, token, amount, reason }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/caja/retiro`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            monto: Math.round(amount || 0),
            motivo: String(reason || '').trim()
        })
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo registrar el retiro de caja.');
    }

    return payload;
}

export async function fetchCashWithdrawals({ apiBaseUrl, token }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/caja/retiros`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo consultar los retiros de caja.');
    }

    return payload;
}
