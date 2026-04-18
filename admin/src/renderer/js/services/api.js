let cachedConfig = null;

async function getAppConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }

    cachedConfig = await window.electronAPI.getConfig();
    return cachedConfig;
}

async function apiRequest({ endpoint, method = 'GET', body, token = getAuthToken(), silentNonJson = false }) {
    return window.electronAPI.apiRequest({
        endpoint,
        method,
        body,
        token,
        silentNonJson
    });
}
