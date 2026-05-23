let cachedConfig = null;

async function getAppConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }

    cachedConfig = await window.electronAPI.getConfig();
    return cachedConfig;
}

async function apiRequest({ endpoint, method = 'GET', body, token = getAuthToken(), silentNonJson = false }) {
    const response = await window.electronAPI.apiRequest({
        endpoint,
        method,
        body,
        token,
        silentNonJson
    });

    if (response?.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        const payload = response.data;
        const hasEnvelope = Object.prototype.hasOwnProperty.call(payload, 'success')
            || Object.prototype.hasOwnProperty.call(payload, 'data');

        if (hasEnvelope) {
            return {
                ...response,
                ok: response.ok && payload.success !== false,
                data: Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload,
                envelope: payload,
                error: response.error || payload.error || null
            };
        }
    }

    return response;
}
