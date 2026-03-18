import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { loginRequest } from '../services/api';
import { Field, PrimaryButton } from '../components/UI';

export default function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!username.trim() || !password) {
            setError('Debes ingresar usuario y contrasena');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await loginRequest(username.trim(), password);
            if (result.success) {
                onLogin({ token: result.token, user: result.user });
                return;
            }

            setError(result.message);
        } catch (loginError) {
            setError('No se pudo iniciar sesion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

            <View style={styles.content}>
                <View style={styles.brandBlock}>
                    <Text style={styles.brandPill}>Valmu Mobile</Text>
                    <Text style={styles.title}>Gestiona tu operacion con una entrada mas simple.</Text>
                    <Text style={styles.subtitle}>
                        Accede a inventario, categorias, proveedores y sucursales desde una sola app.
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardTop}>
                        <Text style={styles.cardEyebrow}>Acceso seguro</Text>
                        <Text style={styles.cardTitle}>Iniciar sesion</Text>
                        <Text style={styles.cardSubtitle}>Usa la misma cuenta del panel admin</Text>
                    </View>

                    <Field label="Usuario" value={username} onChangeText={setUsername} />
                    <Field label="Contrasena" value={password} onChangeText={setPassword} secureTextEntry />

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <PrimaryButton
                        title={loading ? 'Ingresando...' : 'Entrar a Valmu'}
                        onPress={handleLogin}
                        disabled={loading}
                    />

                    <Text style={styles.footerNote}>
                        Conexion directa con los modulos activos del ecosistema Valmu.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#edf3f9',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 28
    },
    glowTop: {
        position: 'absolute',
        top: -30,
        right: -10,
        width: 190,
        height: 190,
        borderRadius: 999,
        backgroundColor: '#ffd5b5'
    },
    glowBottom: {
        position: 'absolute',
        bottom: -20,
        left: -40,
        width: 170,
        height: 170,
        borderRadius: 999,
        backgroundColor: '#dbe8f4'
    },
    content: {
        width: '100%',
        maxWidth: 430,
        alignSelf: 'center'
    },
    brandBlock: {
        marginBottom: 18,
        paddingHorizontal: 4
    },
    brandPill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#ffffff',
        color: '#f58233',
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 12
    },
    title: {
        fontSize: 32,
        lineHeight: 38,
        fontWeight: '900',
        color: '#18385c'
    },
    subtitle: {
        marginTop: 10,
        fontSize: 16,
        lineHeight: 24,
        color: '#5a6b80',
        maxWidth: 360
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: '#ffffff',
        shadowColor: '#17365a',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
        elevation: 5
    },
    cardTop: {
        marginBottom: 10
    },
    cardEyebrow: {
        color: '#f58233',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontSize: 12,
        marginBottom: 6
    },
    cardTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: '#1e293b'
    },
    cardSubtitle: {
        marginTop: 6,
        marginBottom: 14,
        color: '#64748b',
        lineHeight: 20
    },
    error: {
        color: '#dc2626',
        marginBottom: 12,
        fontWeight: '600'
    },
    footerNote: {
        marginTop: 14,
        color: '#7a8797',
        fontSize: 13,
        lineHeight: 18
    }
});
