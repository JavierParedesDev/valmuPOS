import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, View } from 'react-native';
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
        loadInventory(selectedBranch);
    };

    return (
        <Screen>
            <SectionHeader
                title={selectedBranch ? `Inventario: ${selectedBranch.nombreSucursal}` : 'Sucursales'}
                subtitle={selectedBranch ? 'Stock actual por producto' : 'Consulta de sucursales e inventario'}
                actions={selectedBranch ? <SecondaryButton title="Volver" onPress={() => setSelectedBranch(null)} /> : null}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#f58233" style={{ marginTop: 32 }} />
            ) : selectedBranch ? (
                <FlatList
                    data={inventory}
                    keyExtractor={(item) => `${selectedBranch.id_sucursal}-${item.id_producto}`}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                        <Card>
                            <Text style={styles.title}>{item.nombreProducto}</Text>
                            <Text style={styles.meta}>Codigo: {item.codigoBarras}</Text>
                            <Text style={styles.meta}>
                                Stock: {item.esPesable ? `${Number(item.cantidad).toFixed(3)} Kg` : `${Math.floor(Number(item.cantidad))} unidades`}
                            </Text>

                            <View style={styles.actions}>
                                <SecondaryButton
                                    title="Ajustar stock"
                                    onPress={() => {
                                        setCurrentItem(item);
                                        setAdjustForm({
                                            nuevaCantidad: String(item.esPesable ? item.cantidad : Math.floor(Number(item.cantidad))),
                                            motivoAjuste: 'INVENTARIO_MANUAL'
                                        });
                                        setAdjustVisible(true);
                                    }}
                                />
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay productos con stock en esta sucursal." />}
                />
            ) : (
                <FlatList
                    data={branches}
                    keyExtractor={(item) => String(item.id_sucursal)}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                        <Card>
                            <Text style={styles.title}>{item.nombreSucursal}</Text>
                            <Text style={styles.meta}>{item.direccion || 'Sin direccion'}</Text>
                            <Text style={styles.meta}>ID: {item.id_sucursal}</Text>

                            <View style={styles.actions}>
                                <PrimaryButton title="Ver inventario" onPress={() => loadInventory(item)} />
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay sucursales disponibles." />}
                />
            )}

            <FormModal
                visible={adjustVisible}
                title="Ajuste manual de stock"
                onClose={() => setAdjustVisible(false)}
                onSubmit={submitAdjustment}
                submitLabel="Guardar ajuste"
            >
                <Text style={styles.meta}>{currentItem?.nombreProducto || ''}</Text>
                <Field
                    label="Nueva cantidad"
                    value={adjustForm.nuevaCantidad}
                    onChangeText={(value) => setAdjustForm((prev) => ({ ...prev, nuevaCantidad: value }))}
                    keyboardType="numeric"
                />
                <PickerField
                    label="Motivo"
                    value={adjustForm.motivoAjuste}
                    onChange={(value) => setAdjustForm((prev) => ({ ...prev, motivoAjuste: value }))}
                    options={[
                        { label: 'Correccion de inventario', value: 'INVENTARIO_MANUAL' },
                        { label: 'Merma por dano', value: 'MERMA_DANO' },
                        { label: 'Merma por vencimiento', value: 'MERMA_VENCIMIENTO' },
                        { label: 'Sobrante encontrado', value: 'SOBRANTE' }
                    ]}
                />
            </FormModal>
        </Screen>
    );
}

const styles = {
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 6
    },
    meta: {
        color: '#475569',
        marginBottom: 4
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14
    }
};
