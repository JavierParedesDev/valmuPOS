const DEFAULT_API_URL = 'http://64.176.17.147:3000/api';

function normalizeApiBaseUrl(rawUrl) {
    return (rawUrl || DEFAULT_API_URL).replace(/\/+$/, '');
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.VALMU_API_URL);

module.exports = {
    API_BASE_URL
};
