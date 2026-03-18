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

    const response = await fetch(buildUrl(endpoint), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

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
        return {
            success: true,
            token: response.data?.token,
            user: response.data?.usuario
        };
    }

    return {
        success: false,
        message: response.data?.error || response.error || 'No se pudo iniciar sesion'
    };
}
