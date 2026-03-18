import React, { useMemo, useState } from 'react';
import { Modal, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import ProductsScreen from './screens/ProductsScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import SuppliersScreen from './screens/SuppliersScreen';
import BranchesScreen from './screens/BranchesScreen';

const MODULES = [
    { key: 'products', label: 'Productos', caption: 'Inventario y movimientos' },
    { key: 'categories', label: 'Categorias', caption: 'Orden del catalogo' },
    { key: 'suppliers', label: 'Proveedores', caption: 'Red comercial' },
    { key: 'branches', label: 'Sucursales', caption: 'Inventario por sede' }
];

export default function MobileApp() {
    const [session, setSession] = useState({ token: '', user: null });
    const [moduleKey, setModuleKey] = useState('products');
    const [drawerOpen, setDrawerOpen] = useState(false);

    const currentModule = useMemo(
        () => MODULES.find((item) => item.key === moduleKey) || MODULES[0],
        [moduleKey]
    );

    if (!session.token) {
        return <LoginScreen onLogin={setSession} />;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#143454" />

            <View style={styles.topBar}>
                <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
                    <Text style={styles.menuIcon}>☰</Text>
                </TouchableOpacity>

                <View style={styles.topBarText}>
                    <Text style={styles.topBarTitle}>{currentModule.label}</Text>
                    <Text style={styles.topBarSubtitle}>{currentModule.caption}</Text>
                </View>

                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {(session.user?.nombreCompleto || 'AD').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.contentArea}>
                {currentModule.key === 'products' ? <ProductsScreen token={session.token} /> : null}
                {currentModule.key === 'categories' ? <CategoriesScreen token={session.token} /> : null}
                {currentModule.key === 'suppliers' ? <SuppliersScreen token={session.token} /> : null}
                {currentModule.key === 'branches' ? <BranchesScreen token={session.token} /> : null}
            </View>

            <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
                <View style={styles.drawerBackdrop}>
                    <TouchableOpacity style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)} />

                    <View style={styles.drawerPanel}>
                        <View style={styles.drawerHeader}>
                            <View>
                                <Text style={styles.drawerBrand}>Valmu Mobile</Text>
                                <Text style={styles.drawerUser}>{session.user?.nombreCompleto || 'Administrador'}</Text>
                            </View>

                            <TouchableOpacity style={styles.drawerClose} onPress={() => setDrawerOpen(false)}>
                                <Text style={styles.drawerCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.drawerMenu}>
                            {MODULES.map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.drawerItem, item.key === moduleKey && styles.drawerItemActive]}
                                    onPress={() => {
                                        setModuleKey(item.key);
                                        setDrawerOpen(false);
                                    }}
                                >
                                    <Text style={[styles.drawerItemTitle, item.key === moduleKey && styles.drawerItemTitleActive]}>
                                        {item.label}
                                    </Text>
                                    <Text style={[styles.drawerItemCaption, item.key === moduleKey && styles.drawerItemCaptionActive]}>
                                        {item.caption}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.logoutCard}
                            onPress={() => {
                                setDrawerOpen(false);
                                setSession({ token: '', user: null });
                            }}
                        >
                            <Text style={styles.logoutCardTitle}>Cerrar sesion</Text>
                            <Text style={styles.logoutCardText}>Volver al acceso seguro</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0f2d49'
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: '#143454'
    },
    menuButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    menuIcon: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '800'
    },
    topBarText: {
        flex: 1,
        marginLeft: 12
    },
    topBarTitle: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '800'
    },
    topBarSubtitle: {
        color: '#c7d5e4',
        marginTop: 2
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#f58233',
        alignItems: 'center',
        justifyContent: 'center'
    },
    avatarText: {
        color: '#ffffff',
        fontWeight: '800'
    },
    contentArea: {
        flex: 1,
        backgroundColor: '#eef3f9',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        padding: 16
    },
    drawerBackdrop: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'rgba(5, 16, 29, 0.32)'
    },
    drawerOverlay: {
        flex: 1
    },
    drawerPanel: {
        width: '78%',
        maxWidth: 320,
        backgroundColor: '#112f4b',
        paddingTop: 26,
        paddingHorizontal: 18,
        paddingBottom: 24
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24
    },
    drawerBrand: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '900'
    },
    drawerUser: {
        color: '#c2d4e7',
        marginTop: 6
    },
    drawerClose: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    drawerCloseText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700'
    },
    drawerMenu: {
        gap: 10
    },
    drawerItem: {
        padding: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.06)'
    },
    drawerItemActive: {
        backgroundColor: '#f58233'
    },
    drawerItemTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '800'
    },
    drawerItemTitleActive: {
        color: '#ffffff'
    },
    drawerItemCaption: {
        marginTop: 4,
        color: '#bed0e2'
    },
    drawerItemCaptionActive: {
        color: '#fff1e7'
    },
    logoutCard: {
        marginTop: 'auto',
        backgroundColor: '#fff1e7',
        borderRadius: 20,
        padding: 16
    },
    logoutCardTitle: {
        color: '#c2410c',
        fontWeight: '900',
        fontSize: 16
    },
    logoutCardText: {
        marginTop: 4,
        color: '#9a3412'
    }
});
