import { API_BASE_URL } from '../config/api';

function buildUrl(endpoint) {
    if (/^https?:\/\//i.test(endpoint)) {
        return endpoint;
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${normalizedEndpoint}`;
}

export async function apiRequest({ endpoint, method = 'GET', body, token }) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const url = buildUrl(endpoint);
    let response;

    try {
        response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (error) {
        return {
            ok: false,
            status: 0,
            error: 'No se pudo conectar con el servidor'
        };
    }

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            return {
                ok: false,
                status: response.status,
                error: 'Respuesta no valida del servidor (no es JSON)'
            };
        }
    }

    return {
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? null : data?.error || null
    };
}

export async function multipartApiRequest({ endpoint, method = 'POST', body, token }) {
    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const url = buildUrl(endpoint);
    let response;

    try {
        response = await fetch(url, {
            method,
            headers,
            body
        });
    } catch (error) {
        return {
            ok: false,
            status: 0,
            error: 'No se pudo conectar con el servidor'
        };
    }

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            return {
                ok: false,
                status: response.status,
                error: 'Respuesta no valida del servidor'
            };
        }
    }

    return {
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? null : data?.error || null
    };
}

export async function loginRequest(username, password) {
    const response = await apiRequest({
        endpoint: '/auth/login',
        method: 'POST',
        body: {
            nombreUsuario: username,
            contrasena: password
        }
    });

    if (response.ok) {
        const user = response.data?.usuario || null;
        const normalizedUser = user ? {
            ...user,
            id_usuario: user.id_usuario ?? user.idUsuario ?? user.usuario_id ?? user.id ?? null,
            idUsuario: user.idUsuario ?? user.id_usuario ?? user.usuario_id ?? user.id ?? null,
            id_sucursal: user.id_sucursal ?? user.idSucursal ?? user.sucursal_id ?? null,
            idSucursal: user.idSucursal ?? user.id_sucursal ?? user.sucursal_id ?? null,
            nombreSucursal: user.nombreSucursal || user.sucursalNombre || user.sucursal || ''
        } : null;

        return {
            success: true,
            token: response.data?.token,
            user: normalizedUser
        };
    }

    return {
        success: false,
        message: response.data?.error || response.error || 'No se pudo iniciar sesion'
    };
}
