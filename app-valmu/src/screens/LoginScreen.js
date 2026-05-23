import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { loginRequest } from '../services/api';
import { brandColors } from '../theme';
import appConfig from '../../app.json';

const APP_VERSION = appConfig.expo?.version || '0.0.0';

function isAllowedLoginRole(user) {
    const roleName = String(user?.rol || user?.nombreRol || '').trim().toLowerCase();
    const roleId = Number(user?.id_rol ?? user?.rol_id ?? user?.idRol ?? 0);

    return roleName === 'administrador'
        || roleName === 'bodeguero'
        || roleId === 1
        || roleId === 3;
}

export default function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [userFocused, setUserFocused] = useState(false);
    const [passFocused, setPassFocused] = useState(false);
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
                if (!isAllowedLoginRole(result.user)) {
                    setError('Este acceso solo permite los roles Administrador y Bodeguero');
                    return;
                }
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
                colors={['#070B16', '#0F1524']}
                style={StyleSheet.absoluteFill}
            />

            {/* Glowing background orbs for color depth */}
            <View style={styles.orb1} />
            <View style={styles.orb2} />
            <View style={styles.orb3} />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Brand Block */}
                        <View style={styles.brandContainer}>
                            <Image
                                source={require('../../assets/icon.png')}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>Bienvenido</Text>
                        </View>

                        {/* Login Glassmorphic Card */}
                        <View style={styles.glassCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Inicia sesión</Text>
                                <Text style={styles.cardSubtitle}>Accede con tu cuenta administrativa</Text>
                            </View>

                            {/* Usuario Field */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Usuario</Text>
                                <View style={[
                                    styles.inputWrapper,
                                    userFocused && styles.inputWrapperFocused
                                ]}>
                                    <Ionicons
                                        name="person-outline"
                                        size={20}
                                        color={userFocused ? brandColors.accent : 'rgba(255,255,255,0.4)'}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="Tu nombre de usuario"
                                        placeholderTextColor="rgba(255,255,255,0.35)"
                                        autoCapitalize="none"
                                        selectionColor={brandColors.accent}
                                        style={styles.textInput}
                                        onFocus={() => setUserFocused(true)}
                                        onBlur={() => setUserFocused(false)}
                                    />
                                </View>
                            </View>

                            {/* Contraseña Field */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Contraseña</Text>
                                <View style={[
                                    styles.inputWrapper,
                                    passFocused && styles.inputWrapperFocused
                                ]}>
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={20}
                                        color={passFocused ? brandColors.accent : 'rgba(255,255,255,0.4)'}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor="rgba(255,255,255,0.35)"
                                        selectionColor={brandColors.accent}
                                        style={styles.textInput}
                                        onFocus={() => setPassFocused(true)}
                                        onBlur={() => setPassFocused(false)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeButton}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                                            size={20}
                                            color="rgba(255,255,255,0.4)"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {error ? (
                                <View style={styles.errorBox}>
                                    <Ionicons name="alert-circle-outline" size={20} color="#F87171" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            {/* Gradient Log In Button */}
                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.8}
                                style={styles.buttonTouch}
                            >
                                <LinearGradient
                                    colors={loading ? ['rgba(255, 107, 0, 0.6)', 'rgba(226, 94, 0, 0.6)'] : ['#FF8A00', '#E25E00']}
                                    style={styles.buttonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 10 }} />
                                    ) : (
                                        <Ionicons name="log-in-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    )}
                                    <Text style={styles.buttonText}>
                                        {loading ? 'Iniciando sesión...' : 'Entrar al Sistema'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <Text style={styles.footerNote}>
                                Valmu App de administración.
                            </Text>
                        </View>

                        <Text style={styles.versionText}>Version {APP_VERSION}</Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#070B16'
    },
    safeArea: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: Platform.OS === 'ios' ? 20 : 40,
        paddingBottom: 30,
        maxWidth: 460,
        alignSelf: 'center',
        width: '100%'
    },
    orb1: {
        position: 'absolute',
        top: '10%',
        right: '-15%',
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(255, 107, 0, 0.12)'
    },
    orb2: {
        position: 'absolute',
        bottom: '8%',
        left: '-15%',
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(14, 165, 233, 0.08)'
    },
    orb3: {
        position: 'absolute',
        top: '45%',
        left: '25%',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(139, 92, 246, 0.06)'
    },
    brandContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Platform.OS === 'ios' ? 10 : 30,
        marginBottom: 24
    },
    logoImage: {
        width: 90,
        height: 90,
        borderRadius: 22,
        marginBottom: 12,
        ...Platform.select({
            web: {
                filter: 'drop-shadow(0px 8px 16px rgba(255, 107, 0, 0.2))'
            },
            ios: {
                shadowColor: brandColors.accent,
                shadowOpacity: 0.2,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 8 }
            }
        })
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: -0.5
    },
    glassCard: {
        backgroundColor: 'rgba(22, 30, 49, 0.65)',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        ...Platform.select({
            web: {
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            },
            ios: {
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 16 }
            },
            android: {
                elevation: 12
            }
        })
    },
    cardHeader: {
        marginBottom: 24
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    cardSubtitle: {
        marginTop: 6,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontWeight: '500'
    },
    inputGroup: {
        marginBottom: 20
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 8,
        marginLeft: 4
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(7, 11, 22, 0.65)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        height: 56,
        paddingHorizontal: 16
    },
    inputWrapperFocused: {
        borderColor: brandColors.accent,
        backgroundColor: 'rgba(7, 11, 22, 0.85)',
        ...Platform.select({
            web: {
                boxShadow: '0 0 10px rgba(255, 107, 0, 0.2)'
            },
            ios: {
                shadowColor: brandColors.accent,
                shadowOpacity: 0.2,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 }
            }
        })
    },
    inputIcon: {
        marginRight: 12
    },
    textInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        height: '100%',
        paddingVertical: 0
    },
    eyeButton: {
        padding: 4,
        marginLeft: 8
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        padding: 14,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.25)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    errorText: {
        color: '#F87171',
        fontSize: 14,
        fontWeight: '600',
        flex: 1
    },
    buttonTouch: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 8px 20px rgba(255, 107, 0, 0.35)'
            },
            ios: {
                shadowColor: brandColors.accent,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 }
            },
            android: {
                elevation: 6
            }
        })
    },
    buttonGradient: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 16,
        letterSpacing: 0.5
    },
    footerNote: {
        marginTop: 24,
        color: 'rgba(255,255,255,0.25)',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600'
    },
    versionText: {
        marginTop: 24,
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '800'
    }
});
