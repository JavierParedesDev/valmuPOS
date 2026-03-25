import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { brandColors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

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
            Alert.alert('Validación', 'RUT y nombre son obligatorios');
            return;
        }

        const response = await apiRequest({
            endpoint: editingSupplier ? `/proveedores/${editingSupplier.id_provider}` : '/proveedores',
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
                subtitle="Directorio de socios comerciales"
                actions={<PrimaryButton title="+ Nuevo" onPress={() => openModal()} compact style={{ borderRadius: 12, height: 44 }} />}
            />

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.loaderText}>Sincronizando proveedores...</Text>
                </View>
            ) : (
                <FlatList
                    data={suppliers}
                    keyExtractor={(item) => String(item.id_proveedor)}
                    contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 4 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Card style={styles.supplierCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.businessIcon}>
                                    <Ionicons name="business-outline" size={24} color={brandColors.accent} />
                                </View>
                                <View style={styles.headerInfo}>
                                    <Text style={styles.title}>{item.nombreProveedor}</Text>
                                    <Text style={styles.rutText}>RUT: {item.rutProveedor}</Text>
                                </View>
                                <TouchableOpacity style={styles.editButton} onPress={() => openModal(item)}>
                                    <Ionicons name="create-outline" size={20} color={brandColors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.contactSection}>
                                <ContactItem icon="call-outline" label="Teléfono" value={item.telefono || 'Sin registrar'} />
                                <ContactItem icon="mail-outline" label="Correo" value={item.email || 'Sin registrar'} />
                            </View>

                            <View style={styles.addressSection}>
                                <Ionicons name="location-outline" size={16} color={brandColors.textMuted} />
                                <Text style={styles.addressText} numberOfLines={1}>
                                    {item.direccion || 'Sin dirección registrada'}
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.deleteAction} onPress={() => removeSupplier(item)}>
                                <Ionicons name="trash-outline" size={18} color={brandColors.danger} />
                                <Text style={styles.deleteText}>Eliminar proveedor</Text>
                            </TouchableOpacity>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay proveedores registrados." />}
                />
            )}

            <FormModal
                visible={visible}
                title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                onClose={() => setVisible(false)}
                onSubmit={submitSupplier}
                submitLabel={editingSupplier ? 'Guardar cambios' : 'Crear proveedor'}
            >
                <View style={styles.formGrid}>
                    <View style={styles.formCol}>
                        <Field label="RUT" value={form.rutProveedor} onChangeText={(value) => setForm((prev) => ({ ...prev, rutProveedor: value }))} placeholder="12.345.678-9" />
                    </View>
                    <View style={styles.formCol}>
                        <Field label="Nombre Comercial" value={form.nombreProveedor} onChangeText={(value) => setForm((prev) => ({ ...prev, nombreProveedor: value }))} placeholder="Nombre Empresa" />
                    </View>
                </View>

                <View style={styles.formGrid}>
                    <View style={styles.formCol}>
                        <Field label="Teléfono" value={form.telefono} onChangeText={(value) => setForm((prev) => ({ ...prev, telefono: value }))} keyboardType="phone-pad" placeholder="+56 9..." />
                    </View>
                    <View style={styles.formCol}>
                        <Field label="Email" value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} keyboardType="email-address" placeholder="contacto@empresa.com" />
                    </View>
                </View>

                <Field label="Dirección" value={form.direccion} onChangeText={(value) => setForm((prev) => ({ ...prev, direccion: value }))} multiline placeholder="Dirección completa..." />
            </FormModal>
        </Screen>
    );
}

function ContactItem({ icon, label, value }) {
    return (
        <View style={styles.contactItem}>
            <View style={styles.contactIcon}>
                <Ionicons name={icon} size={14} color={brandColors.accentStrong} />
            </View>
            <View>
                <Text style={styles.contactLabel}>{label}</Text>
                <Text style={styles.contactValue} numberOfLines={1}>{value}</Text>
            </View>
        </View>
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
    supplierCard: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 24
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    businessIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: brandColors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    headerInfo: {
        flex: 1
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text,
        marginBottom: 2
    },
    rutText: {
        fontSize: 12,
        fontWeight: '700',
        color: brandColors.accentStrong,
        opacity: 0.8
    },
    editButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: brandColors.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center'
    },
    divider: {
        height: 1,
        backgroundColor: brandColors.outline,
        marginVertical: 14,
        opacity: 0.5
    },
    contactSection: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12
    },
    contactItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: brandColors.backgroundAlt,
        padding: 10,
        borderRadius: 14,
        gap: 8
    },
    contactIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: brandColors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center'
    },
    contactLabel: {
        fontSize: 10,
        color: brandColors.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    contactValue: {
        fontSize: 12,
        fontWeight: '800',
        color: brandColors.text
    },
    addressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16
    },
    addressText: {
        flex: 1,
        fontSize: 12,
        color: brandColors.text,
        fontWeight: '600'
    },
    deleteAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        gap: 8
    },
    deleteText: {
        color: brandColors.danger,
        fontWeight: '800',
        fontSize: 13
    },
    formGrid: {
        flexDirection: 'row',
        gap: 12
    },
    formCol: {
        flex: 1
    }
});

