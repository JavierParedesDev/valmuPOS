const loginForm = document.getElementById('login-form');
const accessPreview = document.getElementById('login-access-preview');
const accessText = document.getElementById('login-access-text');
const loginShell = document.querySelector('.login-shell');
const loginPanel = document.querySelector('.login-panel');

function describeAccess(user) {
    const roleName = String(user?.rol || '').trim() || 'Usuario';
    const branchName = user?.nombreSucursal || user?.sucursalNombre || user?.sucursal || '';
    return branchName
        ? `${roleName} · ${branchName}`
        : roleName;
}

function getRoleThemeClass(user) {
    const roleName = String(user?.rol || '').trim().toLowerCase();
    if (roleName === 'administrador' || Number(user?.id_rol) === 1) {
        return 'role-admin';
    }

    if (roleName === 'bodeguero' || Number(user?.id_rol) === 3) {
        return 'role-bodeguero';
    }

    return 'role-default';
}

function applyLoginRoleTheme(roleClass = 'role-default') {
    if (!loginShell || !loginPanel) return;

    loginShell.classList.remove('role-admin', 'role-bodeguero', 'role-default');
    loginPanel.classList.remove('role-admin', 'role-bodeguero', 'role-default');
    loginShell.classList.add(roleClass);
    loginPanel.classList.add(roleClass);
}

applyLoginRoleTheme('role-default');

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        const btnLogin = document.getElementById('btn-login');

        errorMsg.textContent = '';
        btnLogin.disabled = true;
        btnLogin.textContent = 'Entrando...';
        if (accessPreview && accessText) {
            accessPreview.classList.remove('success');
            accessText.textContent = 'Validando acceso...';
        }
        applyLoginRoleTheme('role-default');

        try {
            if (!window.electronAPI || typeof window.electronAPI.login !== 'function') {
                throw new Error('La integracion con Electron no esta disponible en la pantalla de login.');
            }

            const result = await window.electronAPI.login({ username, password });

            if (result?.success) {
                saveSession({ token: result.token, user: result.user });
                applyLoginRoleTheme(getRoleThemeClass(result.user));
                if (accessPreview && accessText) {
                    accessPreview.classList.add('success');
                    accessText.textContent = `Acceso concedido · ${describeAccess(result.user)}`;
                }
                btnLogin.classList.add('is-success');
                btnLogin.textContent = 'Acceso listo';
                setTimeout(() => {
                    window.electronAPI.navigateToIndex();
                }, 220);
                return;
            }

            errorMsg.textContent = result?.message || 'No se pudo iniciar sesion.';
            applyLoginRoleTheme('role-default');
            if (accessPreview && accessText) {
                accessPreview.classList.remove('success');
                accessText.textContent = 'Revisa tus credenciales e intenta otra vez.';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = error?.message || 'Ocurrio un error inesperado al iniciar sesion.';
            applyLoginRoleTheme('role-default');
            if (accessPreview && accessText) {
                accessPreview.classList.remove('success');
                accessText.textContent = 'No fue posible validar el acceso.';
            }
        } finally {
            if (!btnLogin.classList.contains('is-success')) {
                btnLogin.disabled = false;
                btnLogin.textContent = 'Entrar';
            }
        }
    });
}
