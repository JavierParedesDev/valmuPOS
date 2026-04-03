import React, { useEffect, useMemo, useState } from 'react';
import {
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    View,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ActivityIndicator,
    Avatar,
    Button,
    Card,
    Modal,
    Portal,
    Provider as PaperProvider,
    Surface,
    Text,
    TouchableRipple
} from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import LoginScreen from './screens/LoginScreen';
import { checkForAppUpdate, downloadAndInstallUpdate } from './services/updates';
import { appTheme, brandColors } from './theme';

const MODULES = [
    { key: 'products', label: 'Productos', metric: 'Catalogo', icon: { set: 'MaterialCommunityIcons', name: 'package-variant-closed' } },
    { key: 'categories', label: 'Categorías', metric: 'Orden', icon: { set: 'Ionicons', name: 'layers-outline' } },
    { key: 'suppliers', label: 'Proveedores', metric: 'Compras', icon: { set: 'Ionicons', name: 'storefront-outline' } },
    { key: 'branches', label: 'Sucursales', metric: 'Stock', icon: { set: 'Ionicons', name: 'location-outline' } }
];

const brandIcon = require('../assets/icon.png');

function ModuleIcon({ icon, color = '#ffffff', size = 20 }) {
    if (icon?.set === 'MaterialCommunityIcons') {
        return <MaterialCommunityIcons name={icon.name} size={size} color={color} />;
    }

    return <Ionicons name={icon?.name || 'ellipse'} size={size} color={color} />;
}

function resolveModuleComponent(moduleKey) {
    switch (moduleKey) {
        case 'products':
            return require('./screens/ProductsScreen').default;
        case 'categories':
            return require('./screens/CategoriesScreen').default;
        case 'suppliers':
            return require('./screens/SuppliersScreen').default;
        case 'branches':
            return require('./screens/BranchesScreen').default;
        default:
            return null;
    }
}

export default function MobileApp() {
    const [iconsReady, setIconsReady] = useState(false);
    const [session, setSession] = useState({ token: '', user: null });
    const [moduleKey, setModuleKey] = useState('products');
    const [showIntro, setShowIntro] = useState(true);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [moduleSummary, setModuleSummary] = useState({
        value: '--',
        label: 'total productos'
    });
    const [updateState, setUpdateState] = useState({
        checking: true,
        info: null,
        visible: false,
        downloading: false,
        error: ''
    });
    const [moduleLoadError, setModuleLoadError] = useState('');

    const currentModule = useMemo(
        () => MODULES.find((item) => item.key === moduleKey) || MODULES[0],
        [moduleKey]
    );

    useEffect(() => {
        let mounted = true;

        async function reviewUpdates() {
            const result = await checkForAppUpdate();
            if (!mounted) return;

            setUpdateState({
                checking: false,
                info: result,
                visible: Boolean(result?.ok && result?.updateAvailable),
                downloading: false,
                error: result?.ok ? '' : (result?.error || '')
            });
        }

        reviewUpdates();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        async function warmIconFonts() {
            try {
                await Promise.race([
                    Font.loadAsync({
                        ...Ionicons.font,
                        ...MaterialCommunityIcons.font
                    }),
                    new Promise((resolve) => setTimeout(resolve, 2500))
                ]);
            } catch (error) {
                console.warn('No se pudieron precargar los iconos:', error);
            } finally {
                if (mounted) {
                    setIconsReady(true);
                }
            }
        }

        warmIconFonts();
        return () => {
            mounted = false;
        };
    }, []);

    async function handleInstallUpdate() {
        if (!updateState.info) return;

        setUpdateState((current) => ({
            ...current,
            downloading: true,
            error: ''
        }));

        const result = await downloadAndInstallUpdate(updateState.info);

        setUpdateState((current) => ({
            ...current,
            downloading: false,
            error: result.ok ? '' : (result.error || 'No se pudo abrir la descarga de la nueva APK.')
        }));
    }

    useEffect(() => {
        if (moduleKey !== 'products') {
            setModuleSummary({
                value: '--',
                label: 'total productos'
            });
        }
    }, [moduleKey]);

    useEffect(() => {
        setModuleLoadError('');
    }, [moduleKey, session.token]);

    function handleLogout() {
        setDrawerVisible(false);
        setSession({ token: '', user: null });
        setShowIntro(false);
        setModuleLoadError('');
    }

    function renderCurrentModule() {
        try {
            const ModuleScreen = resolveModuleComponent(currentModule.key);

            if (!ModuleScreen) {
                return (
                    <View style={styles.fallbackCard}>
                        <Text style={styles.fallbackTitle}>Módulo no disponible</Text>
                        <Text style={styles.fallbackText}>No se pudo abrir esta sección.</Text>
                    </View>
                );
            }

            if (currentModule.key === 'products') {
                return <ModuleScreen token={session.token} onSummaryChange={setModuleSummary} />;
            }

            return <ModuleScreen token={session.token} />;
        } catch (error) {
            const message = error?.message || 'No se pudo cargar este módulo.';
            if (moduleLoadError !== message) {
                setModuleLoadError(message);
            }

            return (
                <View style={styles.fallbackCard}>
                    <Text style={styles.fallbackTitle}>Error al abrir {currentModule.label}</Text>
                    <Text style={styles.fallbackText}>{message}</Text>
                </View>
            );
        }
    }

    const initials = (session.user?.nombreCompleto || 'Valmu')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    if (!iconsReady) {
        return (
            <PaperProvider theme={appTheme}>
                <View style={styles.bootSplash}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.bootText}>Cargando recursos...</Text>
                </View>
            </PaperProvider>
        );
    }

    return (
        <PaperProvider theme={appTheme}>
            {!session.token ? (
                <>
                    <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
                    {showIntro ? (
                        <LaunchScreen onContinue={() => setShowIntro(false)} />
                    ) : (
                        <LoginScreen onLogin={setSession} />
                    )}
                    <UpdatePrompt
                        state={updateState}
                        onClose={() => setUpdateState((current) => ({ ...current, visible: false }))}
                        onInstall={handleInstallUpdate}
                    />
                </>
            ) : (
                <>
                    <StatusBar barStyle="dark-content" backgroundColor={brandColors.surface} translucent={false} />
                    <SafeAreaView style={styles.safeArea}>
                        <View style={styles.shell}>
                            <View style={styles.topRibbon}>
                                <View style={styles.headerRow}>
                                    <TouchableRipple borderless style={styles.headerIconButton} onPress={() => setDrawerVisible(true)}>
                                        <Ionicons name="grid-outline" size={24} color={brandColors.shell} />
                                    </TouchableRipple>

                                    <View style={styles.headerBrand}>
                                        <Text style={styles.headerTitle}>{currentModule.label}</Text>
                                        <Text style={styles.headerCaption}>Panel de control · Valmu</Text>
                                    </View>

                                    <Avatar.Text size={44} label={initials} style={styles.avatar} labelStyle={styles.avatarLabel} />
                                </View>
                            </View>



                            {updateState.info?.ok && updateState.info?.updateAvailable && !updateState.visible ? (
                                <TouchableRipple
                                    style={styles.updateBanner}
                                    onPress={() => setUpdateState((current) => ({ ...current, visible: true }))}
                                >
                                    <View style={styles.updateBannerInner}>
                                        <View style={styles.updateBannerIcon}>
                                            <Ionicons name="cloud-download" size={20} color={brandColors.accent} />
                                        </View>
                                        <View style={styles.updateBannerCopy}>
                                            <Text style={styles.updateBannerTitle}>Actualización disponible</Text>
                                            <Text style={styles.updateBannerText}>Versión {updateState.info.latestVersion} lista.</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={brandColors.accent} />
                                    </View>
                                </TouchableRipple>
                            ) : null}

                            <View style={styles.contentContainer}>
                                {moduleLoadError ? (
                                    <View style={styles.moduleWarning}>
                                        <Ionicons name="warning-outline" size={18} color={brandColors.danger} />
                                        <Text style={styles.moduleWarningText} numberOfLines={2}>{moduleLoadError}</Text>
                                    </View>
                                ) : null}
                                {renderCurrentModule()}
                            </View>
                        </View>

                        <Surface style={styles.bottomDock} elevation={4}>
                            {MODULES.map((item) => {
                                const active = item.key === moduleKey;
                                return (
                                    <TouchableRipple
                                        key={item.key}
                                        style={[styles.dockItem, active && styles.dockItemActive]}
                                        onPress={() => setModuleKey(item.key)}
                                        borderless
                                    >
                                        <View style={styles.dockItemInner}>
                                            <ModuleIcon icon={item.icon} color={active ? brandColors.accent : brandColors.textMuted} size={22} />
                                            {active && <View style={styles.activeDot} />}
                                        </View>
                                    </TouchableRipple>
                                );
                            })}
                        </Surface>
                    </SafeAreaView>

                    <UpdatePrompt
                        state={updateState}
                        onClose={() => setUpdateState((current) => ({ ...current, visible: false }))}
                        onInstall={handleInstallUpdate}
                    />
                    <DrawerMenu
                        visible={drawerVisible}
                        onClose={() => setDrawerVisible(false)}
                        onLogout={handleLogout}
                    />
                </>
            )}
        </PaperProvider>
    );
}

function LaunchScreen({ onContinue }) {
    return (
        <View style={styles.launchShell}>
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.launchContent}>
                <View style={styles.launchHero}>
                    <View style={styles.launchLogoCircle}>
                        <Image source={brandIcon} style={styles.launchLogo} />
                    </View>
                    <Text style={styles.launchBrand}>Valmu</Text>
                    <Text style={styles.launchTagline}>Software de administración</Text>
                </View>

                <View style={styles.launchFooter}>
                    <Text style={styles.launchTitle}>Software Valmu de administración.</Text>
                    <Text style={styles.launchText}>
                        Gestión de productos, inventario, sucursales y proveedores.
                    </Text>

                    <Button
                        mode="contained"
                        buttonColor={brandColors.accent}
                        textColor="#ffffff"
                        onPress={onContinue}
                        style={styles.launchButton}
                        contentStyle={styles.launchButtonContent}
                        labelStyle={styles.launchButtonLabel}
                    >
                        Comenzar Ahora
                    </Button>
                    <Text style={styles.versionTag}>v1.0.6 · © 2026 Valmu</Text>
                </View>
            </View>
        </View>
    );
}

function UpdatePrompt({ state, onClose, onInstall }) {
    if (!state.visible || !state.info?.updateAvailable) {
        return null;
    }

    const notes = (state.info.notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5);

    return (
        <Portal>
            <Modal visible contentContainerStyle={styles.updateModal} onDismiss={onClose}>
                <View style={styles.sheetHandle} />
                <Text style={styles.updateEyebrow}>Mejoras listas</Text>
                <Text style={styles.updateTitle}>Nueva versión {state.info.latestVersion}</Text>
                <Text style={styles.updateText}>
                    Hemos optimizado el sistema para una mejor experiencia. Descarga la nueva APK ahora.
                </Text>

                <View style={styles.updateMetaRow}>
                    <View style={styles.updateMetaCard}>
                        <Text style={styles.updateMetaLabel}>INSTALADA</Text>
                        <Text style={styles.updateMetaValue}>{state.info.installedVersion}</Text>
                    </View>
                    <View style={styles.updateMetaCardActive}>
                        <Text style={styles.updateMetaLabelActive}>DISPONIBLE</Text>
                        <Text style={styles.updateMetaValueActive}>{state.info.latestVersion}</Text>
                    </View>
                </View>

                <View style={styles.notesCard}>
                    <Text style={styles.notesTitle}>Novedades en esta versión</Text>
                    {notes.length ? notes.map((note, index) => (
                        <Text key={index} style={styles.noteLine}>• {note.replace(/^[-*]\s*/, '')}</Text>
                    )) : (
                        <Text style={styles.noteLine}>Mejoras generales de estabilidad y diseño.</Text>
                    )}
                </View>

                {state.downloading ? (
                    <View style={styles.progressRow}>
                        <ActivityIndicator color={brandColors.accent} size="small" />
                        <Text style={styles.progressText}>Preparando descarga...</Text>
                    </View>
                ) : null}

                {state.error ? <Text style={styles.updateError}>{state.error}</Text> : null}

                <View style={styles.updateActions}>
                    <Button mode="text" onPress={onClose} textColor={brandColors.textMuted} style={styles.flexOne}>
                        Más tarde
                    </Button>
                    <Button
                        mode="contained"
                        onPress={onInstall}
                        buttonColor={brandColors.accent}
                        textColor="#ffffff"
                        disabled={state.downloading}
                        style={[styles.flexOne, { borderRadius: 14 }]}
                    >
                        {state.downloading ? 'Abriendo...' : 'Actualizar'}
                    </Button>
                </View>
            </Modal>
        </Portal>
    );
}

function DrawerMenu({ visible, onClose, onLogout }) {
    const items = [
        { label: 'Monitoreo en vivo', icon: 'pulse-outline' },
        { label: 'Movimientos', icon: 'swap-horizontal-outline' },
        { label: 'Finanzas', icon: 'cash-outline' },
        { label: 'Configuración', icon: 'settings-outline' }
    ];

    return (
        <Portal>
            <Modal visible={visible} contentContainerStyle={styles.drawerModal} onDismiss={onClose}>
                <View style={styles.sheetHandle} />
                <View style={styles.drawerHeader}>
                    <Text style={styles.drawerTitle}>Menu</Text>
                </View>

                <View style={styles.drawerContent}>
                    {items.map((item) => (
                        <TouchableRipple key={item.label} style={styles.drawerItem} onPress={onClose} borderless>
                            <View style={styles.drawerItemInner}>
                                <View style={styles.drawerIconWrap}>
                                    <Ionicons name={item.icon} size={20} color={brandColors.shell} />
                                </View>
                                <Text style={styles.drawerItemText}>{item.label}</Text>
                            </View>
                        </TouchableRipple>
                    ))}
                </View>

                <Button
                    mode="contained"
                    onPress={onLogout}
                    buttonColor="#FEE2E2"
                    textColor={brandColors.danger}
                    style={styles.drawerLogout}
                    labelStyle={{ fontWeight: '900' }}
                >
                    Cerrar sesión
                </Button>
            </Modal>
        </Portal>
    );
}

const styles = StyleSheet.create({
    bootSplash: {
        flex: 1,
        backgroundColor: brandColors.shell,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16
    },
    bootText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700'
    },
    safeArea: {
        flex: 1,
        backgroundColor: brandColors.surface,
        paddingTop: Platform.OS === 'android' ? 10 : 8
    },
    shell: {
        flex: 1,
        backgroundColor: brandColors.background
    },
    topRibbon: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 18,
        backgroundColor: brandColors.surface,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
    },
    headerIconButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brandColors.backgroundAlt
    },
    headerBrand: {
        flex: 1,
        alignItems: 'center'
    },
    headerTitle: {
        color: brandColors.text,
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5
    },
    headerCaption: {
        marginTop: 1,
        color: brandColors.textMuted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    avatar: {
        backgroundColor: brandColors.accentSoft
    },
    avatarLabel: {
        color: brandColors.accentStrong,
        fontWeight: '900'
    },
    metricWrapper: {
        paddingHorizontal: 20,
        marginTop: -36,
        zIndex: 10
    },
    metricCard: {
        backgroundColor: brandColors.shell,
        borderRadius: 24,
        padding: 4,
        ...Platform.select({
            web: {
                boxShadow: '0 12px 16px rgba(15, 23, 42, 0.25)'
            },
            ios: {
                shadowColor: brandColors.shell,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.25,
                shadowRadius: 16
            },
            android: {
                elevation: 8
            }
        })
    },
    metricCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    metricBlock: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8
    },
    metricValue: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900'
    },
    metricLabel: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    activeIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: brandColors.success,
        justifyContent: 'center',
        alignItems: 'center'
    },
    activePulse: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        position: 'absolute'
    },
    updateBanner: {
        borderRadius: 20,
        backgroundColor: brandColors.accentSoft,
        marginHorizontal: 20,
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 0, 0.1)'
    },
    updateBannerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14
    },
    updateBannerIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    updateBannerCopy: {
        flex: 1
    },
    updateBannerTitle: {
        color: brandColors.text,
        fontWeight: '900',
        fontSize: 14
    },
    updateBannerText: {
        marginTop: 2,
        color: brandColors.textMuted,
        fontSize: 12
    },
    moduleWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 4,
        marginBottom: 10,
        backgroundColor: '#FEE2E2',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    moduleWarningText: {
        flex: 1,
        color: brandColors.danger,
        fontSize: 12,
        fontWeight: '700'
    },
    contentContainer: {
        flex: 1,
        paddingTop: 6,
        paddingHorizontal: 16
    },
    fallbackCard: {
        backgroundColor: brandColors.surface,
        borderRadius: 24,
        padding: 24,
        marginTop: 8,
        alignItems: 'center'
    },
    fallbackTitle: {
        color: brandColors.text,
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center'
    },
    fallbackText: {
        color: brandColors.textMuted,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 8
    },
    bottomDock: {
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: 30,
        height: 72,
        borderRadius: 36,
        backgroundColor: brandColors.shell,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        ...Platform.select({
            web: {
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.3)'
            },
            ios: {
                shadowColor: brandColors.shell,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20
            },
            android: {
                elevation: 10
            }
        })
    },
    dockItem: {
        flex: 1,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center'
    },
    dockItemActive: {
        backgroundColor: 'rgba(255,255,255,0.08)'
    },
    dockItemInner: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: brandColors.accent,
        marginTop: 4
    },
    launchShell: {
        flex: 1,
        backgroundColor: brandColors.shell
    },
    launchContent: {
        flex: 1,
        paddingHorizontal: 30,
        paddingVertical: 60,
        justifyContent: 'space-between'
    },
    launchHero: {
        alignItems: 'center',
        marginTop: 40
    },
    launchLogoCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    launchLogo: {
        width: 80,
        height: 80,
        borderRadius: 20
    },
    launchBrand: {
        marginTop: 20,
        color: '#ffffff',
        fontSize: 40,
        fontWeight: '900',
        letterSpacing: -1
    },
    launchTagline: {
        marginTop: 6,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    launchFooter: {
        marginBottom: 20
    },
    launchTitle: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: '900',
        lineHeight: 40,
        letterSpacing: -0.5
    },
    launchText: {
        marginTop: 16,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        lineHeight: 24
    },
    launchButton: {
        marginTop: 32,
        borderRadius: 20,
        shadowColor: brandColors.accent,
        shadowOpacity: 0.4,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 }
    },
    launchButtonContent: {
        height: 64
    },
    launchButtonLabel: {
        fontSize: 18,
        fontWeight: '900'
    },
    versionTag: {
        marginTop: 24,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        fontWeight: '600'
    },
    updateModal: {
        marginHorizontal: 20,
        borderRadius: 32,
        backgroundColor: brandColors.surface,
        padding: 24,
        alignItems: 'center'
    },
    sheetHandle: {
        width: 40,
        height: 5,
        backgroundColor: brandColors.outline,
        borderRadius: 999,
        marginBottom: 20
    },
    updateEyebrow: {
        color: brandColors.accent,
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8
    },
    updateTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: brandColors.text,
        textAlign: 'center'
    },
    updateText: {
        marginTop: 10,
        color: brandColors.textMuted,
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center'
    },
    updateMetaRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        width: '100%'
    },
    updateMetaCard: {
        flex: 1,
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 20,
        padding: 14,
        alignItems: 'center'
    },
    updateMetaCardActive: {
        flex: 1,
        backgroundColor: brandColors.accentSoft,
        borderRadius: 20,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: brandColors.accent
    },
    updateMetaLabel: {
        fontSize: 10,
        color: brandColors.textMuted,
        fontWeight: '800'
    },
    updateMetaValue: {
        marginTop: 4,
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text
    },
    updateMetaLabelActive: {
        fontSize: 10,
        color: brandColors.accentStrong,
        fontWeight: '800'
    },
    updateMetaValueActive: {
        marginTop: 4,
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.accentStrong
    },
    notesCard: {
        marginTop: 20,
        width: '100%',
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 20,
        padding: 16
    },
    notesTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: brandColors.text,
        marginBottom: 10
    },
    noteLine: {
        fontSize: 13,
        color: brandColors.textMuted,
        lineHeight: 20,
        marginBottom: 6
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        gap: 10
    },
    progressText: {
        color: brandColors.accentStrong,
        fontWeight: '700',
        fontSize: 14
    },
    updateError: {
        marginTop: 12,
        color: brandColors.danger,
        fontWeight: '700',
        fontSize: 13
    },
    updateActions: {
        flexDirection: 'row',
        marginTop: 24,
        gap: 12,
        width: '100%'
    },
    flexOne: {
        flex: 1
    },
    drawerModal: {
        backgroundColor: brandColors.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '80%',
        alignItems: 'center'
    },
    drawerHeader: {
        marginBottom: 20
    },
    drawerTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: brandColors.text
    },
    drawerContent: {
        width: '100%',
        gap: 12
    },
    drawerItem: {
        borderRadius: 20,
        backgroundColor: brandColors.backgroundAlt
    },
    drawerItemInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 16
    },
    drawerIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 }
    },
    drawerItemText: {
        fontSize: 16,
        fontWeight: '700',
        color: brandColors.text
    },
    drawerLogout: {
        marginTop: 30,
        width: '100%',
        borderRadius: 20,
        height: 56,
        justifyContent: 'center'
    }
});
