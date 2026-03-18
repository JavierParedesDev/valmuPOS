const SESSION_KEYS = {
    token: 'valmu_token',
    user: 'valmu_user'
};

function getAuthToken() {
    return localStorage.getItem(SESSION_KEYS.token);
}

function getCurrentUser() {
    const rawUser = localStorage.getItem(SESSION_KEYS.user);
    if (!rawUser) return null;

    try {
        return JSON.parse(rawUser);
    } catch (error) {
        console.error('No se pudo parsear la sesion del usuario:', error);
        return null;
    }
}

function saveSession({ token, user }) {
    localStorage.setItem(SESSION_KEYS.token, token);
    localStorage.setItem(SESSION_KEYS.user, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEYS.token);
    localStorage.removeItem(SESSION_KEYS.user);
}
