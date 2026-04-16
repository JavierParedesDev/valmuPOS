import React, { useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { apiRequest } from '../services/api';
import {
    Card,
    Screen,
    SectionHeader,
    PrimaryButton,
    SecondaryButton,
    DangerButton,
    Field,
    PickerField,
    EmptyState,
    Badge
} from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency, filterProductsLocally } from '../utils/format';

export default function MovementsScreen({ token, navigateTo, params, clearParams }) {
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [inboundItems, setInboundItems] = useState([]); // { product, quantity }

    const [scannerVisible, setScannerVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // Cache products for local search
    const productsRef = useRef([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [branchRes, prodRes] = await Promise.all([
                apiRequest({ endpoint: '/sucursales', token }),
                apiRequest({ endpoint: '/productos?limit=1000', token })
            ]);

            const branchData = Array.isArray(branchRes?.data) ? branchRes.data : [];
            setBranches(branchData);
            if (branchData.length > 0) {
                setSelectedBranch(String(branchData[0].id_sucursal));
            }

            productsRef.current = Array.isArray(prodRes?.data) ? prodRes.data : [];
        } catch (error) {
            console.error('Error fetching data for movements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (params?.product && productsRef.current.length > 0) {
            addProductToInbound(params.product);
            clearParams(); // Importante limpiar para no re-agregar al volver
        }
    }, [params, productsRef.current]);

    const handleSearch = (text) => {
        setSearchQuery(text);
        if (text.length > 1) {
            setIsSearching(true);
            const filtered = filterProductsLocally(text, productsRef.current);
            setSearchResults(filtered.slice(0, 20));
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }
    };

    const addProductToInbound = (product) => {
        const existing = inboundItems.find(item => item.product.id_producto === product.id_producto);
        if (existing) {
            setInboundItems(inboundItems.map(item =>
                item.product.id_producto === product.id_producto
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setInboundItems([...inboundItems, { product, quantity: 1 }]);
        }
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    };

    const handleBarcodeScanned = ({ data }) => {
        setScannerVisible(false);
        const product = productsRef.current.find(p => p.codigoBarras === data);
        if (product) {
            addProductToInbound(product);
        } else {
            Alert.alert('No encontrado', `No se encontró un producto con el código ${data}`);
        }
    };

    const updateQuantity = (productId, qty) => {
        const numQty = parseFloat(qty) || 0;
        setInboundItems(inboundItems.map(item =>
            item.product.id_producto === productId
                ? { ...item, quantity: numQty }
                : item
        ));
    };

    const removeItem = (productId) => {
        setInboundItems(inboundItems.filter(item => item.product.id_producto !== productId));
    };

    const handleSubmit = async () => {
        if (inboundItems.length === 0) {
            Alert.alert('Vacio', 'Debes agregar al menos un producto.');
            return;
        }
        if (!selectedBranch) {
            Alert.alert('Sucursal', 'Debes seleccionar una sucursal de destino.');
            return;
        }

        setSubmitting(true);
        try {
            for (const item of inboundItems) {
                const res = await apiRequest({
                    endpoint: '/productos/ingreso',
                    method: 'POST',
                    body: {
                        id_producto: item.product.id_producto,
                        id_sucursal: parseInt(selectedBranch),
                        cantidadIngreso: item.quantity,
                        numeroFactura: invoiceNumber || null
                    },
                    token
                });

                if (!res.ok) {
                    Alert.alert('Error Parcial', `Error al ingresar ${item.product.nombreProducto}: ${res.error}`);
                    setSubmitting(false);
                    return;
                }
            }

            Alert.alert('Exito', `Se han ingresado ${inboundItems.length} productos correctamente.`);
            setInboundItems([]);
            setInvoiceNumber('');
        } catch (error) {
            Alert.alert('Error', 'Hubo un fallo en la conexión.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderItem = ({ item }) => (
        <Card style={styles.inboundCard}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product.nombreProducto}</Text>
                <Text style={styles.itemCode}>{item.product.codigoBarras || 'Sin código'}</Text>
            </View>
            <View style={styles.itemActions}>
                <TextInput
                    style={styles.qtyInput}
                    value={String(item.quantity)}
                    onChangeText={(val) => updateQuantity(item.product.id_producto, val)}
                    keyboardType="numeric"
                    selectTextOnFocus
                />
                <TouchableOpacity onPress={() => removeItem(item.product.id_producto)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={20} color={brandColors.danger} />
                </TouchableOpacity>
            </View>
        </Card>
    );

    if (loading) {
        return (
            <View style={styles.loaderArea}>
                <ActivityIndicator size="large" color={brandColors.accent} />
                <Text style={styles.loaderText}>Iniciando módulo...</Text>
            </View>
        );
    }

    return (
        <Screen statusBarColor={brandColors.surface}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <FlatList
                    data={inboundItems}
                    keyExtractor={(item) => String(item.product.id_producto)}
                    renderItem={renderItem}
                    ListHeaderComponent={
                        <View style={styles.header}>
                            <SectionHeader
                                title="Ingreso Stock"
                                subtitle="Carga masiva por factura"
                                icon="swap-horizontal-outline"
                            />

                            <Card style={styles.configCard}>
                                <PickerField
                                    label="Sucursal Destino"
                                    value={selectedBranch}
                                    onValueChange={setSelectedBranch}
                                    options={branches.map(b => ({ label: b.nombreSucursal, value: String(b.id_sucursal) }))}
                                />
                                <Field
                                    label="Número de Factura"
                                    value={invoiceNumber}
                                    onChangeText={setInvoiceNumber}
                                    placeholder="Ej: 12345 (Opcional)"
                                    keyboardType="numeric"
                                />
                            </Card>

                            <View style={styles.searchRow}>
                                <View style={styles.searchBox}>
                                    <Ionicons name="search" size={18} color={brandColors.textMuted} style={styles.searchIcon} />
                                    <TextInput
                                        placeholder="Buscar producto..."
                                        style={styles.searchInput}
                                        value={searchQuery}
                                        onChangeText={handleSearch}
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => handleSearch('')}>
                                            <Ionicons name="close-circle" size={18} color={brandColors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.scanBtn}
                                    onPress={async () => {
                                        if (!permission?.granted) {
                                            const status = await requestPermission();
                                            if (!status.granted) return;
                                        }
                                        setScannerVisible(true);
                                    }}
                                >
                                    <Ionicons name="barcode-outline" size={24} color={brandColors.accent} />
                                </TouchableOpacity>
                            </View>

                            {isSearching && searchResults.length > 0 && (
                                <View style={styles.resultsBox}>
                                    {searchResults.map(p => (
                                        <TouchableOpacity
                                            key={p.id_producto}
                                            style={styles.resultItem}
                                            onPress={() => addProductToInbound(p)}
                                        >
                                            <Text style={styles.resultName}>{p.nombreProducto}</Text>
                                            <Text style={styles.resultCode}>{p.codigoBarras}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <EmptyState
                            title="Lista vacía"
                            message="Busca o escanea productos para registrar el ingreso de mercadería."
                            icon="cloud-upload-outline"
                        />
                    }
                    contentContainerStyle={styles.listContent}
                />

                <View style={styles.footer}>
                    <PrimaryButton
                        title={submitting ? "Procesando Ingresos..." : `Finalizar (${inboundItems.length})`}
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={inboundItems.length === 0}
                    />
                </View>
            </KeyboardAvoidingView>

            <Modal visible={scannerVisible} animationType="slide">
                <CameraView
                    style={StyleSheet.absoluteFill}
                    onBarcodeScanned={handleBarcodeScanned}
                >
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerTop}>
                            <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.closeScanner}>
                                <Ionicons name="close" size={32} color="#ffffff" />
                            </TouchableOpacity>
                            <Text style={styles.scannerTitle}>Escanear Producto</Text>
                        </View>
                        <View style={styles.scannerTarget} />
                        <Text style={styles.scannerHint}>Ubica el código de barras en el recuadro</Text>
                    </View>
                </CameraView>
            </Modal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        marginBottom: 16
    },
    listContent: {
        padding: 16,
        paddingBottom: 220
    },
    configCard: {
        padding: 16,
        marginBottom: 16
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: brandColors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: brandColors.outline
    },
    searchIcon: {
        marginRight: 8
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: brandColors.text,
        fontWeight: '600'
    },
    scanBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: brandColors.accentSoft,
        justifyContent: 'center',
        alignItems: 'center'
    },
    resultsBox: {
        backgroundColor: brandColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: brandColors.outline,
        overflow: 'hidden',
        marginTop: 4,
        zIndex: 100,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
            android: { elevation: 4 }
        })
    },
    resultItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.outline
    },
    resultName: {
        fontSize: 14,
        fontWeight: '700',
        color: brandColors.text
    },
    resultCode: {
        fontSize: 11,
        color: brandColors.textMuted,
        marginTop: 2
    },
    inboundCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8
    },
    itemInfo: {
        flex: 1,
        marginRight: 10
    },
    itemName: {
        fontSize: 14,
        fontWeight: '800',
        color: brandColors.text
    },
    itemCode: {
        fontSize: 11,
        color: brandColors.textMuted
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    qtyInput: {
        width: 60,
        height: 40,
        backgroundColor: brandColors.background,
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '900',
        color: brandColors.text,
        borderWidth: 1,
        borderColor: brandColors.outline
    },
    removeBtn: {
        padding: 4
    },
    footer: {
        position: 'absolute',
        bottom: 110, // Elevado para que no quede detrás del dock (que está a bottom:30 + 72 height)
        left: 20,
        right: 20,
        backgroundColor: brandColors.surface,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: brandColors.outline,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
            android: { elevation: 6 }
        })
    },
    loaderArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: brandColors.background
    },
    loaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '700'
    },
    scannerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    scannerTop: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center'
    },
    closeScanner: {
        padding: 8
    },
    scannerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        marginLeft: 10
    },
    scannerTarget: {
        width: 250,
        height: 150,
        borderWidth: 2,
        borderColor: brandColors.accent,
        borderRadius: 16,
        backgroundColor: 'transparent'
    },
    scannerHint: {
        color: '#ffffff',
        marginTop: 24,
        fontSize: 14,
        fontWeight: '600'
    }
});
