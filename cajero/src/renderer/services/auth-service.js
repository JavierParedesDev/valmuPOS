import { normalizeApiBaseUrl, parseJsonResponse } from '../utils/formatters.js';

export async function loginCashier({ apiBaseUrl, username, password }) {
    const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl || '');

    if (!normalizedApiBaseUrl || !username || !password) {
        throw new Error('Completa API, usuario y contrasena.');
    }

    const response = await fetch(`${normalizedApiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            nombreUsuario: username,
            contrasena: password
        })
    });

    const payload = await parseJsonResponse(response);

    if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'No se pudo iniciar sesion.');
    }

    if (!payload?.token || !payload?.usuario) {
        throw new Error('La respuesta de login no incluye token o usuario.');
    }

    return {
        apiBaseUrl: normalizedApiBaseUrl,
        token: payload.token,
        user: payload.usuario
    };
}
