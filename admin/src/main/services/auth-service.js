const { requestJson } = require('./http-client');

async function loginUser(credentials) {
    const response = await requestJson({
        endpoint: '/auth/login',
        method: 'POST',
        body: {
            nombreUsuario: credentials.username,
            contrasena: credentials.password
        }
    });

    if (response.ok) {
        return {
            success: true,
            user: response.data?.usuario,
            token: response.data?.token
        };
    }

    return {
        success: false,
        message: response.data?.error || response.error || 'Error de autenticacion'
    };
}

module.exports = {
    loginUser
};
