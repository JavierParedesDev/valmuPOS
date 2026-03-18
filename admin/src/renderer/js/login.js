document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    errorMsg.textContent = '';
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando sesion...';

    try {
        const result = await window.electronAPI.login({ username, password });

        if (result.success) {
            saveSession({ token: result.token, user: result.user });
            window.electronAPI.navigateToIndex();
            return;
        }

        errorMsg.textContent = result.message;
    } catch (error) {
        errorMsg.textContent = 'Ocurrio un error inesperado';
    }

    btnLogin.disabled = false;
    btnLogin.textContent = 'Iniciar sesion';
});
