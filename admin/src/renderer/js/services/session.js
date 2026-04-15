const SESSION_KEYS = {
    token: 'valmu_token',
    user: 'valmu_user',
    activeBranchId: 'valmu_active_branch_id',
    activeBranchName: 'valmu_active_branch_name'
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

function getCurrentUserRoleId() {
    const user = getCurrentUser();
    if (!user) return null;

    const rawRoleId = user.id_rol ?? user.rol_id ?? user.idRol ?? null;
    const numericRoleId = Number(rawRoleId);
    return Number.isNaN(numericRoleId) ? null : numericRoleId;
}

function getCurrentUserRoleName() {
    const user = getCurrentUser();
    return String(user?.rol || '').trim().toLowerCase();
}

function isBodeguero() {
    return getCurrentUserRoleId() === 3 || getCurrentUserRoleName() === 'bodeguero';
}

function getAssignedBranchId() {
    const user = getCurrentUser();
    if (!user) return null;

    const rawBranchId = user.id_sucursal ?? user.idSucursal ?? user.sucursal_id ?? null;
    const numericBranchId = Number(rawBranchId);
    return Number.isNaN(numericBranchId) ? null : numericBranchId;
}

function getAssignedBranchName() {
    const user = getCurrentUser();
    return user?.nombreSucursal || user?.sucursalNombre || user?.sucursal || '';
}

function getActiveBranchId() {
    const storedValue = localStorage.getItem(SESSION_KEYS.activeBranchId);
    if (storedValue != null && storedValue !== '') {
        const numericValue = Number(storedValue);
        if (!Number.isNaN(numericValue)) {
            return numericValue;
        }
    }

    return getAssignedBranchId();
}

function getActiveBranchName() {
    return localStorage.getItem(SESSION_KEYS.activeBranchName) || getAssignedBranchName() || '';
}

function setActiveBranch({ id, name }) {
    if (id == null || id === '') {
        localStorage.removeItem(SESSION_KEYS.activeBranchId);
        localStorage.removeItem(SESSION_KEYS.activeBranchName);
        return;
    }

    localStorage.setItem(SESSION_KEYS.activeBranchId, String(id));
    localStorage.setItem(SESSION_KEYS.activeBranchName, String(name || ''));
}

function saveSession({ token, user }) {
    localStorage.setItem(SESSION_KEYS.token, token);
    localStorage.setItem(SESSION_KEYS.user, JSON.stringify(user));

    if (!localStorage.getItem(SESSION_KEYS.activeBranchId)) {
        const assignedBranchId = user?.id_sucursal ?? user?.idSucursal ?? user?.sucursal_id ?? null;
        const assignedBranchName = user?.nombreSucursal || user?.sucursalNombre || user?.sucursal || '';
        if (assignedBranchId != null && assignedBranchId !== '') {
            setActiveBranch({ id: assignedBranchId, name: assignedBranchName });
        }
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEYS.token);
    localStorage.removeItem(SESSION_KEYS.user);
    localStorage.removeItem(SESSION_KEYS.activeBranchId);
    localStorage.removeItem(SESSION_KEYS.activeBranchName);
}
