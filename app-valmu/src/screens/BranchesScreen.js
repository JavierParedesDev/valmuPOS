import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../services/api';
import {
    Card,
    EmptyState,
    Field,
    FormModal,
    PickerField,
    PrimaryButton,
    Screen,
    SecondaryButton,
    SectionHeader
} from '../components/UI';
import { toNumber } from '../utils/format';
import { brandColors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

function resolveBranchItemQuantity(item) {
    const rawValue = item?.stockActual ?? item?.cantidad ?? 0;
    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function BranchesScreen({ token }) {
    const [branches, setBranches] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [adjustVisible, setAdjustVisible] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [adjustForm, setAdjustForm] = useState({ nuevaCantidad: '', motivoAjuste: 'INVENTARIO_MANUAL' });

    const loadBranches = async () => {
        setLoading(true);
        try {
            const response = await apiRequest({ endpoint: '/sucursales', token });
            setBranches(response.ok && Array.isArray(response.data) ? response.data : []);
        } finally {
            setLoading(false);
        }
    };

    const loadInventory = async (branch) => {
        setSelectedBranch(branch);
        setLoading(true);

        try {
            const response = await apiRequest({
                endpoint: `/productos/inventario?id_sucursal=${branch.id_sucursal}`,
                token
            });

            setInventory(response.ok && Array.isArray(response.data) ? response.data : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBranches();
    }, []);

    const submitAdjustment = async () => {
        if (!currentItem) return;

        const response = await apiRequest({
            endpoint: '/productos/inventario',
            method: 'PUT',
            body: {
                id_producto: currentItem.id_producto,
                id_sucursal: selectedBranch.id_sucursal,
                nuevaCantidad: toNumber(adjustForm.nuevaCantidad),
                motivoAjuste: adjustForm.motivoAjuste
            },
            token
        });

        if (!response.ok) {
            Alert.alert('Error', response.error || 'No se pudo ajustar el stock');
            return;
        }

        setAdjustVisible(false);
        Alert.alert('Stock actualizado', 'El stock se actualizo correctamente.');
        loadInventory(selectedBranch);
    };

    return (
        <Screen>
            <SectionHeader
                title={selectedBranch ? `Stock: ${selectedBranch.nombreSucursal}` : 'Sucursales'}
                subtitle={selectedBranch ? 'Gestión de inventario local' : 'Red de distribución y bodegas'}
                actions={selectedBranch ? (
                    <TouchableOpacity style={styles.backCircle} onPress={() => setSelectedBranch(null)}>
                        <Ionicons name="arrow-back" size={24} color={brandColors.accent} />
                    </TouchableOpacity>
                ) : null}
            />

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.loaderText}>Sincronizando datos...</Text>
                </View>
            ) : selectedBranch ? (
                <FlatList
                    data={inventory}
                    keyExtractor={(item) => `${selectedBranch.id_sucursal}-${item.id_producto}`}
                    contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 4 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Card style={styles.inventoryCard}>
                            {(() => {
                                const quantity = resolveBranchItemQuantity(item);
                                return (
                                    <View style={styles.inventoryTop}>
                                <View style={styles.inventoryInfo}>
                                    <Text style={styles.inventoryTitle} numberOfLines={1}>{item.nombreProducto}</Text>
                                    <View style={styles.codeRow}>
                                        <Ionicons name="barcode-outline" size={14} color={brandColors.textMuted} />
                                        <Text style={styles.inventoryCode}>{item.codigoBarras}</Text>
                                    </View>
                                </View>
                                <View style={styles.stockColumn}>
                                    <Text style={styles.stockLabel}>DISPONIBLE</Text>
                                    <Text style={[styles.stockValue, quantity <= 5 && styles.lowStock]}>
                                        {item.esPesable ? `${quantity.toFixed(3)} Kg` : Math.floor(quantity)}
                                    </Text>
                                </View>
                            </View>
                                );
                            })()}

                            <TouchableOpacity
                                style={styles.adjustButton}
                                onPress={() => {
                                    const quantity = resolveBranchItemQuantity(item);
                                    setCurrentItem(item);
                                    setAdjustForm({
                                        nuevaCantidad: String(item.esPesable ? quantity : Math.floor(quantity)),
                                        motivoAjuste: 'INVENTARIO_MANUAL'
                                    });
                                    setAdjustVisible(true);
                                }}
                            >
                                <Ionicons name="options-outline" size={18} color={brandColors.accentStrong} />
                                <Text style={styles.adjustText}>Ajustar Stock</Text>
                            </TouchableOpacity>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay productos registrados en esta sucursal." />}
                />
            ) : (
                <FlatList
                    data={branches}
                    keyExtractor={(item) => String(item.id_sucursal)}
                    contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 4 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Card style={styles.branchCard}>
                            <View style={styles.branchContent}>
                                <View style={styles.branchIcon}>
                                    <Ionicons name="storefront-outline" size={24} color={brandColors.accent} />
                                </View>
                                <View style={styles.branchInfo}>
                                    <Text style={styles.branchTitle}>{item.nombreSucursal}</Text>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-outline" size={14} color={brandColors.textMuted} />
                                        <Text style={styles.branchAddress} numberOfLines={1}>{item.direccion || 'Sin dirección'}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.viewButton} onPress={() => loadInventory(item)}>
                                    <Ionicons name="chevron-forward" size={20} color={brandColors.accent} />
                                </TouchableOpacity>
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No se encontraron sucursales." />}
                />
            )}

            <FormModal
                visible={adjustVisible}
                title="Ajuste de Stock"
                onClose={() => setAdjustVisible(false)}
                onSubmit={submitAdjustment}
                submitLabel="Guardar ajuste"
            >
                <View style={styles.adjustHeader}>
                    <Text style={styles.adjustProductTitle}>{currentItem?.nombreProducto}</Text>
                    <Text style={styles.adjustProductMeta}>Código {currentItem?.codigoBarras}</Text>
                </View>

                <Field
                    label="Nueva cantidad total"
                    value={adjustForm.nuevaCantidad}
                    onChangeText={(value) => setAdjustForm((prev) => ({ ...prev, nuevaCantidad: value }))}
                    keyboardType="numeric"
                    placeholder="Ingrese el stock real..."
                />
                <PickerField
                    label="Motivo del ajuste"
                    value={adjustForm.motivoAjuste}
                    onChange={(value) => setAdjustForm((prev) => ({ ...prev, motivoAjuste: value }))}
                    options={[
                        { label: 'Corrección manual', value: 'INVENTARIO_MANUAL' },
                        { label: 'Merma por daño', value: 'MERMA_DANO' },
                        { label: 'Merma por vencimiento', value: 'MERMA_VENCIMIENTO' },
                        { label: 'Sobrante encontrado', value: 'SOBRANTE' }
                    ]}
                />
            </FormModal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40
    },
    loaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    backCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: brandColors.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center'
    },
    branchCard: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 24
    },
    branchContent: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    branchIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: brandColors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    branchInfo: {
        flex: 1
    },
    branchTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text,
        marginBottom: 4
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    branchAddress: {
        fontSize: 13,
        color: brandColors.textMuted,
        fontWeight: '500'
    },
    viewButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: brandColors.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center'
    },
    inventoryCard: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 24
    },
    inventoryTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    inventoryInfo: {
        flex: 1,
        marginRight: 12
    },
    inventoryTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text,
        lineHeight: 20
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4
    },
    inventoryCode: {
        color: brandColors.textMuted,
        fontSize: 12,
        fontWeight: '600'
    },
    stockColumn: {
        alignItems: 'flex-end'
    },
    stockLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: brandColors.textMuted,
        marginBottom: 2
    },
    stockValue: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.accentStrong
    },
    lowStock: {
        color: brandColors.danger
    },
    adjustButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brandColors.accentSoft,
        height: 48,
        borderRadius: 14,
        gap: 8
    },
    adjustText: {
        fontSize: 14,
        fontWeight: '800',
        color: brandColors.accentStrong
    },
    adjustHeader: {
        backgroundColor: brandColors.backgroundAlt,
        padding: 16,
        borderRadius: 18,
        marginBottom: 20
    },
    adjustProductTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text
    },
    adjustProductMeta: {
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600',
        marginTop: 4
    }
});
