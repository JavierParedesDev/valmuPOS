export function getSessionValue(key) {
    return localStorage.getItem(key) || '';
}

export function setSessionValue(key, value) {
    if (value === null || value === undefined || value === '') {
        localStorage.removeItem(key);
        return;
    }

    localStorage.setItem(key, value);
}

export function getJsonSessionValue(key) {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue);
    } catch (_error) {
        return null;
    }
}

export function setJsonSessionValue(key, value) {
    if (value === null || value === undefined) {
        localStorage.removeItem(key);
        return;
    }

    localStorage.setItem(key, JSON.stringify(value));
}

export function removeSessionValues(keys) {
    keys.forEach((key) => localStorage.removeItem(key));
}
