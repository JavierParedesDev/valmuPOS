const { API_BASE_URL } = require('../config');

function buildApiUrl(endpointOrUrl) {
    if (!endpointOrUrl) {
        throw new Error('Se requiere una URL o endpoint para la peticion');
    }

    if (/^https?:\/\//i.test(endpointOrUrl)) {
        return endpointOrUrl;
    }

    const normalizedEndpoint = endpointOrUrl.startsWith('/') ? endpointOrUrl : `/${endpointOrUrl}`;
    return `${API_BASE_URL}${normalizedEndpoint}`;
}

async function parseResponse(response) {
    const text = await response.text();

    if (!text) {
        return { ok: response.ok, status: response.status, data: null };
    }

    try {
        return { ok: response.ok, status: response.status, data: JSON.parse(text) };
    } catch (error) {
        console.error('Non-JSON response from server:', text.slice(0, 500));
        return {
            ok: false,
            status: response.status,
            error: 'Respuesta no valida del servidor (no es JSON)'
        };
    }
}

async function requestJson({ endpoint, url, method = 'GET', body, token }) {
    try {
        const headers = { 'Content-Type': 'application/json' };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(buildApiUrl(url || endpoint), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        return parseResponse(response);
    } catch (error) {
        console.error('Network/Fetch Error:', error);
        return { ok: false, error: error.message };
    }
}

module.exports = {
    buildApiUrl,
    requestJson
};
