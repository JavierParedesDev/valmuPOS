import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, View } from 'react-native';
import { apiRequest } from '../services/api';
import {
    Card,
    DangerButton,
    EmptyState,
    Field,
    FormModal,
    PrimaryButton,
    Screen,
    SecondaryButton,
    SectionHeader
} from '../components/UI';

function emptySupplierForm() {
    return {
        rutProveedor: '',
        nombreProveedor: '',
        telefono: '',
        email: '',
        direccion: ''
    };
}

export default function SuppliersScreen({ token }) {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [form, setForm] = useState(emptySupplierForm());

    const loadSuppliers = async () => {
        setLoading(true);

        try {
            const response = await apiRequest({ endpoint: '/proveedores', token });
            setSuppliers(response.ok && Array.isArray(response.data) ? response.data : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSuppliers();
    }, []);

    const openModal = (supplier = null) => {
        setEditingSupplier(supplier);
        setForm(
            supplier
                ? {
                    rutProveedor: supplier.rutProveedor || '',
                    nombreProveedor: supplier.nombreProveedor || '',
                    telefono: supplier.telefono || '',
                    email: supplier.email || '',
                    direccion: supplier.direccion || ''
                }
                : emptySupplierForm()
        );
        setVisible(true);
    };

    const submitSupplier = async () => {
        if (!form.rutProveedor.trim() || !form.nombreProveedor.trim()) {
            Alert.alert('Validacion', 'RUT y nombre son obligatorios');
            return;
        }

        const response = await apiRequest({
            endpoint: editingSupplier ? `/proveedores/${editingSupplier.id_proveedor}` : '/proveedores',
            method: editingSupplier ? 'PUT' : 'POST',
            body: {
                rutProveedor: form.rutProveedor.trim(),
                nombreProveedor: form.nombreProveedor.trim(),
                telefono: form.telefono.trim(),
                email: form.email.trim(),
                direccion: form.direccion.trim()
            },
            token
        });

        if (!response.ok) {
            Alert.alert('Error', response.error || 'No se pudo guardar el proveedor');
            return;
        }

        setVisible(false);
        setEditingSupplier(null);
        loadSuppliers();
    };

    const removeSupplier = (supplier) => {
        Alert.alert('Eliminar proveedor', `¿Quieres eliminar ${supplier.nombreProveedor}?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    const response = await apiRequest({
                        endpoint: `/proveedores/${supplier.id_proveedor}`,
                        method: 'DELETE',
                        token
                    });

                    if (!response.ok) {
                        Alert.alert('Error', response.error || 'No se pudo eliminar');
                        return;
                    }

                    loadSuppliers();
                }
            }
        ]);
    };

    return (
        <Screen>
            <SectionHeader
                title="Proveedores"
                subtitle="Directorio y mantenimiento"
                actions={<PrimaryButton title="+ Nuevo" onPress={() => openModal()} compact />}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#f58233" style={{ marginTop: 32 }} />
            ) : (
                <FlatList
                    data={suppliers}
                    keyExtractor={(item) => String(item.id_proveedor)}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                        <Card>
                            <Text style={styles.title}>{item.nombreProveedor}</Text>
                            <Text style={styles.meta}>RUT: {item.rutProveedor}</Text>
                            <Text style={styles.meta}>Email: {item.email || '-'}</Text>
                            <Text style={styles.meta}>Telefono: {item.telefono || '-'}</Text>
                            <Text style={styles.meta}>Direccion: {item.direccion || '-'}</Text>

                            <View style={styles.actions}>
                                <SecondaryButton title="Editar" onPress={() => openModal(item)} />
                                <DangerButton title="Eliminar" onPress={() => removeSupplier(item)} />
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay proveedores registrados." />}
                />
            )}

            <FormModal
                visible={visible}
                title={editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
                onClose={() => setVisible(false)}
                onSubmit={submitSupplier}
                submitLabel={editingSupplier ? 'Guardar cambios' : 'Crear proveedor'}
            >
                <Field label="RUT" value={form.rutProveedor} onChangeText={(value) => setForm((prev) => ({ ...prev, rutProveedor: value }))} />
                <Field label="Nombre comercial" value={form.nombreProveedor} onChangeText={(value) => setForm((prev) => ({ ...prev, nombreProveedor: value }))} />
                <Field label="Telefono" value={form.telefono} onChangeText={(value) => setForm((prev) => ({ ...prev, telefono: value }))} />
                <Field label="Email" value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} />
                <Field label="Direccion" value={form.direccion} onChangeText={(value) => setForm((prev) => ({ ...prev, direccion: value }))} multiline />
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
