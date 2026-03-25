import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loginRequest } from '../services/api';
import { Field, PrimaryButton } from '../components/UI';
import { brandColors } from '../theme';

export default function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!username.trim() || !password) {
            setError('Ingresa tus credenciales');
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
            setError('Error de conexión con el servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={StyleSheet.absoluteFill}
            />

            {/* Background Orbs for Glassmorphism effect */}
            <View style={styles.orb1} />
            <View style={styles.orb2} />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <View style={styles.brandBlock}>
                        <View style={styles.logoPill}>
                            <Text style={styles.logoText}>VALMU</Text>
                        </View>
                        <Text style={styles.title}>Gestión de nivel empresarial.</Text>
                        <Text style={styles.subtitle}>
                            Administra productos, inventario y sucursales con una interfaz de alto rendimiento.
                        </Text>
                    </View>

                    <View style={styles.glassCard}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Inicia sesión</Text>
                            <Text style={styles.cardSubtitle}>Accede con tu cuenta administrativa</Text>
                        </View>

                        <Field
                            label="Usuario"
                            value={username}
                            onChangeText={setUsername}
                            placeholder="Tu nombre de usuario"
                            autoCapitalize="none"
                        />
                        <Field
                            label="Contraseña"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholder="••••••••"
                        />

                        {error ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <PrimaryButton
                            title={loading ? 'Iniciando...' : 'Entrar al Sistema'}
                            onPress={handleLogin}
                            disabled={loading}
                            style={styles.loginButton}
                        />

                        <Text style={styles.footerNote}>
                            Protección de datos y cifrado activo por Valmu Security.
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    safeArea: {
        flex: 1
    },
    orb1: {
        position: 'absolute',
        top: '15%',
        right: '-10%',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(255, 107, 0, 0.15)',
    },
    orb2: {
        position: 'absolute',
        bottom: '10%',
        left: '-15%',
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        maxWidth: 500,
        alignSelf: 'center',
        width: '100%'
    },
    brandBlock: {
        marginBottom: 32
    },
    logoPill: {
        backgroundColor: brandColors.accent,
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 16
    },
    logoText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1
    },
    title: {
        fontSize: 36,
        lineHeight: 42,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1
    },
    subtitle: {
        marginTop: 12,
        fontSize: 16,
        lineHeight: 24,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500'
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        ...Platform.select({
            web: {
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.3)'
            },
            ios: {
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 }
            },
            android: {
                elevation: 10
            }
        })
    },
    cardHeader: {
        marginBottom: 20
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    cardSubtitle: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontWeight: '500'
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 0.5,
        borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    errorText: {
        color: '#F87171',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center'
    },
    loginButton: {
        marginTop: 8,
        height: 60,
        borderRadius: 16
    },
    footerNote: {
        marginTop: 20,
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600'
    }
});

