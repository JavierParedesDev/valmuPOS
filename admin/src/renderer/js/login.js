const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        const btnLogin = document.getElementById('btn-login');

        errorMsg.textContent = '';
        btnLogin.disabled = true;
        btnLogin.textContent = 'Iniciando sesion...';

        try {
            if (!window.electronAPI || typeof window.electronAPI.login !== 'function') {
                throw new Error('La integracion con Electron no esta disponible en la pantalla de login.');
            }

            const result = await window.electronAPI.login({ username, password });

            if (result?.success) {
                saveSession({ token: result.token, user: result.user });
                window.electronAPI.navigateToIndex();
                return;
            }

            errorMsg.textContent = result?.message || 'No se pudo iniciar sesion.';
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = error?.message || 'Ocurrio un error inesperado al iniciar sesion.';
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = 'Iniciar sesion';
        }
    });
}
