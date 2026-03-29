import { normalizeApiBaseUrl, parseJsonResponse } from '../utils/formatters.js';

async function authorizedGet(url, token, fallbackError) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || fallbackError);
    }

    return Array.isArray(payload) ? payload : [];
}

export async function fetchBranches({ apiBaseUrl, token }) {
    return authorizedGet(`${normalizeApiBaseUrl(apiBaseUrl)}/sucursales`, token, 'No se pudieron cargar las sucursales.');
}

export async function fetchCategories({ apiBaseUrl, token }) {
    return authorizedGet(`${normalizeApiBaseUrl(apiBaseUrl)}/categorias`, token, 'No se pudieron cargar las categorias.');
}

export async function fetchInventory({ apiBaseUrl, token, branchId }) {
    const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
    const inventoryUrl = branchId
        ? `${baseUrl}/productos/inventario?id_sucursal=${encodeURIComponent(branchId)}`
        : `${baseUrl}/productos/inventario`;

    return authorizedGet(inventoryUrl, token, 'No se pudo cargar el catalogo.');
}
