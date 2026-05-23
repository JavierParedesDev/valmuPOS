import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Divider, Modal, Portal, TextInput, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { apiRequest } from '../services/api';
import { Card, Screen, SectionHeader, EmptyState } from '../components/UI';
import { brandColors } from '../theme';

const DEFAULT_STOCK_MINIMO = 10;
const HIDDEN_FILE = `${FileSystem.documentDirectory || ''}critical-stock-hidden.json`;

function toSafeNumber(value, fallback = 0) {
    const numberValue = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeBranchName(value) {
    return String(value || '').trim();
}

function getCriticalKey(item = {}) {
    return `${item.id_sucursal || 's'}:${item.id_producto || item.id || 'p'}`;
}

function getBranchType(branchName = '') {
    const name = branchName.toLowerCase();
    if (name.includes('bodega')) return 'bodega';
    if (name.includes('matriz') || name.includes('casa')) return 'matriz';
    return 'otra';
}

function resolveUserBranchId(user) {
    const rawBranchId = user?.id_sucursal ?? user?.idSucursal ?? user?.sucursal_id ?? null;
    const numericBranchId = Number(rawBranchId);
    return Number.isInteger(numericBranchId) && numericBranchId > 0 ? numericBranchId : null;
}

function normalizeCriticalItem(item = {}, branchesById = new Map()) {
    const actual = toSafeNumber(item.stock_actual ?? item.stockActual ?? item.cantidad ?? item.stock, 0);
    const minimo = toSafeNumber(item.stock_minimo ?? item.stockMinimo ?? item.minimo ?? DEFAULT_STOCK_MINIMO, DEFAULT_STOCK_MINIMO);
    const esPesable = item.esPesable === true || item.esPesable === 1 || item.esPesable === '1';
    const branchId = item.id_sucursal ?? item.idSucursal ?? item.sucursal_id;
    const branchName = normalizeBranchName(
        item.nombreSucursal ?? item.sucursal ?? branchesById.get(Number(branchId))?.nombreSucursal ?? 'Sucursal'
    );

    return {
        ...item,
        id: item.id ?? item.id_producto,
        id_producto: item.id_producto ?? item.id,
        id_sucursal: branchId,
        nombre: item.nombre ?? item.nombreProducto ?? 'Producto sin nombre',
        codigo_interno: item.codigo_interno ?? item.codigoBarras ?? 'S/C',
        unidad: item.unidad ?? (esPesable ? 'KG' : 'UN'),
        stock_actual: actual,
        stock_minimo: minimo,
        nombreSucursal: branchName,
        branchType: getBranchType(branchName),
        esPesable
    };
}

async function readHiddenKeys() {
    try {
        if (!FileSystem.documentDirectory) return [];
        const info = await FileSystem.getInfoAsync(HIDDEN_FILE);
        if (!info.exists) return [];
        const raw = await FileSystem.readAsStringAsync(HIDDEN_FILE);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No se pudieron leer alertas ocultas:', error);
        return [];
    }
}

async function writeHiddenKeys(keys) {
    if (!FileSystem.documentDirectory) return;
    await FileSystem.writeAsStringAsync(HIDDEN_FILE, JSON.stringify(Array.from(new Set(keys))));
}

export default function CriticalStockScreen({ token, user }) {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [branchFilter, setBranchFilter] = useState('matriz');
    const [showHidden, setShowHidden] = useState(false);
    const [hiddenKeys, setHiddenKeys] = useState([]);

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [formStockActual, setFormStockActual] = useState('');
    const [formStockMinimo, setFormStockMinimo] = useState('');
    const [saving, setSaving] = useState(false);

    const branchOptions = useMemo(() => {
        const existingTypes = new Set(products.map((item) => item.branchType));
        const options = [{ key: 'all', label: 'Todos' }];
        if (existingTypes.has('matriz') || branches.some((branch) => getBranchType(branch.nombreSucursal) === 'matriz')) {
            options.push({ key: 'matriz', label: 'Casa matriz' });
        }
        if (existingTypes.has('bodega') || branches.some((branch) => getBranchType(branch.nombreSucursal) === 'bodega')) {
            options.push({ key: 'bodega', label: 'Bodega' });
        }
        return options;
    }, [products, branches]);

    const visibleProducts = useMemo(() => {
        const hiddenSet = new Set(hiddenKeys);
        return products
            .filter((item) => !hiddenSet.has(getCriticalKey(item)))
            .filter((item) => branchFilter === 'all' || item.branchType === branchFilter)
            .sort(sortByLowestStock);
    }, [products, hiddenKeys, branchFilter]);

    const hiddenProducts = useMemo(() => {
        const hiddenSet = new Set(hiddenKeys);
        return products
            .filter((item) => hiddenSet.has(getCriticalKey(item)))
            .filter((item) => branchFilter === 'all' || item.branchType === branchFilter)
            .sort(sortByLowestStock);
    }, [products, hiddenKeys, branchFilter]);

    const fetchInventory = async () => {
        try {
            const [hidden, branchResponse] = await Promise.all([
                readHiddenKeys(),
                apiRequest({ endpoint: '/sucursales', token })
            ]);

            const branchData = branchResponse.ok && Array.isArray(branchResponse.data) ? branchResponse.data : [];
            const branchesById = new Map(branchData.map((branch) => [Number(branch.id_sucursal || branch.id), branch]));
            const query = new URLSearchParams({ limite: String(DEFAULT_STOCK_MINIMO) });
            const userBranchId = resolveUserBranchId(user);

            if (user?.rol === 'Bodeguero' && userBranchId) {
                query.set('id_sucursal', String(userBranchId));
            }

            const response = await apiRequest({
                endpoint: `/reportes/alertas-stock?${query.toString()}`,
                token
            });

            if (response.ok && Array.isArray(response.data)) {
                const critical = response.data.map((item) => normalizeCriticalItem(item, branchesById)).filter((item) => {
                    const actual = toSafeNumber(item.stock_actual, 0);
                    const minimo = toSafeNumber(item.stock_minimo, DEFAULT_STOCK_MINIMO);
                    return actual <= minimo;
                });

                setBranches(branchData);
                setHiddenKeys(hidden);
                setProducts(critical);
            } else {
                setBranches(branchData);
                setHiddenKeys(hidden);
                setProducts([]);
            }
        } catch (error) {
            console.error('Error fetching critical stock:', error);
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    useEffect(() => {
        if (branchFilter !== 'matriz') return;
        if (!branchOptions.some((option) => option.key === 'matriz')) {
            setBranchFilter(branchOptions[0]?.key || 'all');
        }
    }, [branchOptions, branchFilter]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchInventory();
    };

    const hideProduct = async (product) => {
        const key = getCriticalKey(product);
        const nextKeys = Array.from(new Set([...hiddenKeys, key]));
        setHiddenKeys(nextKeys);
        await writeHiddenKeys(nextKeys);
    };

    const unhideProduct = async (product) => {
        const key = getCriticalKey(product);
        const nextKeys = hiddenKeys.filter((item) => item !== key);
        setHiddenKeys(nextKeys);
        await writeHiddenKeys(nextKeys);
    };

    const openEditModal = (product) => {
        setSelectedProduct(product);
        setFormStockActual(String(product.stock_actual ?? 0));
        setFormStockMinimo(String(product.stock_minimo ?? DEFAULT_STOCK_MINIMO));
        setEditModalVisible(true);
    };

    const closeEditModal = () => {
        setEditModalVisible(false);
        setSelectedProduct(null);
    };

    const handleSave = async () => {
        if (!selectedProduct) return;

        const actual = toSafeNumber(formStockActual, NaN);

        if (isNaN(actual) || actual < 0) {
            Alert.alert('Validacion', 'El stock actual debe ser un numero valido mayor o igual a 0');
            return;
        }

        if (!selectedProduct.id_producto || !selectedProduct.id_sucursal) {
            Alert.alert('Validacion', 'No se pudo identificar el producto o la sucursal para ajustar el stock.');
            return;
        }

        setSaving(true);
        try {
            const response = await apiRequest({
                endpoint: '/productos/inventario',
                method: 'PUT',
                body: {
                    id_producto: selectedProduct.id_producto,
                    id_sucursal: selectedProduct.id_sucursal,
                    nuevaCantidad: actual,
                    motivoAjuste: 'Ajuste desde Alerta de Stock Critico (App)'
                },
                token
            });

            if (response.ok) {
                closeEditModal();
                fetchInventory();
            } else {
                Alert.alert('Error', response.data?.error || response.error || 'Error desconocido');
            }
        } catch (error) {
            Alert.alert('Conexion', 'Error de conexion al guardar.');
        } finally {
            setSaving(false);
        }
    };

    const renderProduct = ({ item }) => (
        <CriticalProductCard
            item={item}
            hidden={showHidden}
            onPress={() => openEditModal(item)}
            onHide={() => hideProduct(item)}
            onUnhide={() => unhideProduct(item)}
        />
    );

    return (
        <Screen statusBarColor={brandColors.surface}>
            <FlatList
                data={showHidden ? hiddenProducts : visibleProducts}
                keyExtractor={(item) => `${item.id_sucursal || 's'}-${item.id || item.id_producto}`}
                renderItem={renderProduct}
                ListHeaderComponent={
                    <View>
                        <SectionHeader
                            title="Stock Critico"
                            subtitle="Ordenado desde el menor stock disponible"
                            icon="warning-outline"
                            iconColor={brandColors.danger}
                        />
                        <View style={styles.filterPanel}>
                            <View style={styles.segmentRow}>
                                {branchOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.key}
                                        style={[styles.segmentButton, branchFilter === option.key && styles.segmentButtonActive]}
                                        onPress={() => setBranchFilter(option.key)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[styles.segmentText, branchFilter === option.key && styles.segmentTextActive]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.segmentRow}>
                                <TouchableOpacity
                                    style={[styles.tabButton, !showHidden && styles.tabButtonActive]}
                                    onPress={() => setShowHidden(false)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="warning-outline" size={16} color={!showHidden ? '#fff' : brandColors.textMuted} />
                                    <Text style={[styles.tabText, !showHidden && styles.tabTextActive]}>
                                        Activos ({visibleProducts.length})
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabButton, showHidden && styles.tabButtonActive]}
                                    onPress={() => setShowHidden(true)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="eye-off-outline" size={16} color={showHidden ? '#fff' : brandColors.textMuted} />
                                    <Text style={[styles.tabText, showHidden && styles.tabTextActive]}>
                                        Ocultos ({hiddenProducts.length})
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    loading ? null : (
                        <EmptyState
                            text={showHidden
                                ? 'No hay alertas ocultas en este filtro.'
                                : 'No hay productos con stock critico para este filtro.'}
                        />
                    )
                }
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[brandColors.accent]} />
                }
            />
            {loading && !refreshing && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                </View>
            )}

            <Portal>
                <Modal
                    visible={editModalVisible}
                    onDismiss={closeEditModal}
                    contentContainerStyle={styles.modalContainer}
                >
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        {selectedProduct && (
                            <View>
                                <Text style={styles.modalTitle}>Ajustar Stock</Text>
                                <Text style={styles.modalSubtitle} numberOfLines={2}>
                                    {selectedProduct.nombre}
                                </Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Stock Actual ({selectedProduct.unidad})</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={formStockActual}
                                        onChangeText={setFormStockActual}
                                        keyboardType="numeric"
                                        style={styles.input}
                                        activeOutlineColor={brandColors.accent}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Umbral de alerta ({selectedProduct.unidad})</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={formStockMinimo}
                                        onChangeText={setFormStockMinimo}
                                        keyboardType="numeric"
                                        editable={false}
                                        style={styles.input}
                                        activeOutlineColor={brandColors.accent}
                                    />
                                </View>

                                <View style={styles.modalActions}>
                                    <Button
                                        mode="text"
                                        onPress={closeEditModal}
                                        textColor={brandColors.textMuted}
                                        style={styles.actionButton}
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        mode="contained"
                                        onPress={handleSave}
                                        buttonColor={brandColors.accent}
                                        style={styles.actionButton}
                                        loading={saving}
                                        disabled={saving}
                                    >
                                        Guardar
                                    </Button>
                                </View>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </Modal>
            </Portal>
        </Screen>
    );
}

function sortByLowestStock(a, b) {
    const stockDiff = toSafeNumber(a.stock_actual, 0) - toSafeNumber(b.stock_actual, 0);
    if (stockDiff !== 0) return stockDiff;
    const deficitA = toSafeNumber(a.stock_actual, 0) - toSafeNumber(a.stock_minimo, DEFAULT_STOCK_MINIMO);
    const deficitB = toSafeNumber(b.stock_actual, 0) - toSafeNumber(b.stock_minimo, DEFAULT_STOCK_MINIMO);
    return deficitA - deficitB;
}

function CriticalProductCard({ item, hidden, onPress, onHide, onUnhide }) {
    const actual = toSafeNumber(item.stock_actual, 0);
    const minimo = toSafeNumber(item.stock_minimo, DEFAULT_STOCK_MINIMO);

    let statusColor = brandColors.danger;
    let statusText = 'BAJO MINIMO';

    if (actual <= 0) {
        statusColor = '#991B1B';
        statusText = 'AGOTADO';
    }

    return (
        <Card style={styles.productCard}>
            <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
            <TouchableOpacity
                style={styles.cardContent}
                activeOpacity={0.7}
                onPress={onPress}
            >
                <View style={styles.headerRow}>
                    <View style={styles.mainInfo}>
                        <Text style={styles.prodName} numberOfLines={2}>{item.nombre}</Text>
                        <Text style={styles.sku}>{item.codigo_interno || 'S/C'} - {item.nombreSucursal}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.stockGrid}>
                    <View style={styles.stockBlock}>
                        <Text style={styles.stockLabel}>STOCK ACTUAL</Text>
                        <Text style={[styles.stockValue, { color: statusColor }]}>
                            {item.unidad === 'KG' ? actual.toFixed(3) : Math.round(actual)}
                            <Text style={styles.unitText}> {item.unidad}</Text>
                        </Text>
                    </View>
                    <Ionicons name="warning" size={16} color={statusColor} style={{ marginTop: 10 }} />
                    <View style={styles.stockBlock}>
                        <Text style={styles.stockLabel}>STOCK MINIMO</Text>
                        <Text style={styles.stockValue}>
                            {item.unidad === 'KG' ? minimo.toFixed(3) : Math.round(minimo)}
                            <Text style={styles.unitText}> {item.unidad}</Text>
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.hideButton, hidden && styles.restoreButton]}
                    onPress={(event) => {
                        event.stopPropagation();
                        hidden ? onUnhide() : onHide();
                    }}
                    activeOpacity={0.75}
                >
                    <Ionicons
                        name={hidden ? 'eye-outline' : 'eye-off-outline'}
                        size={16}
                        color={hidden ? brandColors.success : brandColors.textMuted}
                    />
                    <Text style={[styles.hideButtonText, hidden && styles.restoreButtonText]}>
                        {hidden ? 'Desocultar' : 'Ocultar'}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Card>
    );
}

const styles = StyleSheet.create({
    list: {
        padding: 16,
        paddingBottom: 40
    },
    filterPanel: {
        gap: 10,
        marginBottom: 14
    },
    segmentRow: {
        flexDirection: 'row',
        gap: 8
    },
    segmentButton: {
        flex: 1,
        minHeight: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: brandColors.outline,
        backgroundColor: brandColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8
    },
    segmentButtonActive: {
        borderColor: brandColors.accent,
        backgroundColor: brandColors.accent
    },
    segmentText: {
        fontSize: 12,
        fontWeight: '900',
        color: brandColors.textMuted
    },
    segmentTextActive: {
        color: '#fff'
    },
    tabButton: {
        flex: 1,
        minHeight: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: brandColors.outline,
        backgroundColor: brandColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 8
    },
    tabButtonActive: {
        borderColor: brandColors.shell,
        backgroundColor: brandColors.shell
    },
    tabText: {
        fontSize: 12,
        fontWeight: '900',
        color: brandColors.textMuted
    },
    tabTextActive: {
        color: '#fff'
    },
    productCard: {
        marginBottom: 12,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: 16
    },
    statusStrip: {
        width: 6,
        height: '100%'
    },
    cardContent: {
        flex: 1,
        padding: 14
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    mainInfo: {
        flex: 1,
        marginRight: 10
    },
    prodName: {
        fontSize: 15,
        fontWeight: '800',
        color: brandColors.text,
        marginBottom: 2
    },
    sku: {
        fontSize: 11,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900'
    },
    divider: {
        marginVertical: 10,
        backgroundColor: brandColors.outline,
        opacity: 0.5
    },
    stockGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: brandColors.background,
        padding: 10,
        borderRadius: 12
    },
    stockBlock: {
        alignItems: 'center',
        flex: 1
    },
    stockLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: brandColors.textMuted,
        marginBottom: 4
    },
    stockValue: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text
    },
    unitText: {
        fontSize: 10,
        fontWeight: '700'
    },
    hideButton: {
        marginTop: 10,
        minHeight: 34,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: brandColors.outline,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6
    },
    restoreButton: {
        borderColor: brandColors.success,
        backgroundColor: '#ECFDF5'
    },
    hideButtonText: {
        fontSize: 12,
        fontWeight: '900',
        color: brandColors.textMuted
    },
    restoreButtonText: {
        color: brandColors.success
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.7)'
    },
    modalContainer: {
        backgroundColor: 'white',
        margin: 20,
        padding: 24,
        borderRadius: 24,
        elevation: 4
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: brandColors.text,
        marginBottom: 4
    },
    modalSubtitle: {
        fontSize: 14,
        color: brandColors.textMuted,
        marginBottom: 20,
        fontWeight: '500'
    },
    inputGroup: {
        marginBottom: 16
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: brandColors.textMuted,
        marginBottom: 6
    },
    input: {
        backgroundColor: '#fff',
        fontSize: 15
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
        gap: 8
    },
    actionButton: {
        borderRadius: 10
    }
});
