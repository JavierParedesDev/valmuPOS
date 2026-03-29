import { normalizeApiBaseUrl, parseJsonResponse } from '../utils/formatters.js';

export async function fetchClients({ apiBaseUrl, token }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/clientes`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar los clientes.');
    }

    return Array.isArray(payload) ? payload : [];
}

export async function createQuickCustomer({ apiBaseUrl, token, customer }) {
    const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/clientes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            rut_cliente: customer.rut,
            nombreCliente: customer.name,
            giroCliente: customer.business
        })
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo guardar el cliente.');
    }

    return payload;
}
