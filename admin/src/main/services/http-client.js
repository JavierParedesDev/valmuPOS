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

async function parseResponse(response, options = {}) {
    const text = await response.text();
    const headers = Object.fromEntries(response.headers.entries());
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();

    if (!text) {
        return { ok: response.ok, status: response.status, data: null, headers };
    }

    if (contentType.includes('xml') || contentType.startsWith('text/plain') || contentType.startsWith('text/xml')) {
        return { ok: response.ok, status: response.status, data: text, headers };
    }

    try {
        return { ok: response.ok, status: response.status, data: JSON.parse(text), headers };
    } catch (error) {
        if (!options.silentNonJson) {
            console.error('Non-JSON response from server:', text.slice(0, 500));
        }
        return {
            ok: false,
            status: response.status,
            error: 'Respuesta no valida del servidor (no es JSON)',
            headers
        };
    }
}

async function requestJson({ endpoint, url, method = 'GET', body, token, silentNonJson = false }) {
    const requestUrl = buildApiUrl(url || endpoint);
    try {
        const headers = { 'Content-Type': 'application/json' };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(requestUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        return parseResponse(response, { silentNonJson });
    } catch (error) {
        console.error('Network/Fetch Error:', error);
        return {
            ok: false,
            status: 0,
            error: `No se pudo conectar con la API (${requestUrl}): ${error.message}`
        };
    }
}

module.exports = {
    buildApiUrl,
    requestJson
};
