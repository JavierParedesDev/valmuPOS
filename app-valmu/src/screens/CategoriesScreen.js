import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Text, View } from 'react-native';
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

function getCategoryDeleteErrorMessage(response) {
    const rawMessage = String(
        response?.data?.error ||
        response?.error ||
        'No se pudo eliminar la categoria'
    );
    const normalizedMessage = rawMessage.toLowerCase();

    if (
        normalizedMessage.includes('foreign key') ||
        normalizedMessage.includes('constraint') ||
        normalizedMessage.includes('producto') ||
        normalizedMessage.includes('referenc')
    ) {
        return 'No puedes eliminar esta categoria porque tiene productos asociados.';
    }

    return rawMessage;
}

export default function CategoriesScreen({ token }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [form, setForm] = useState({ nombreCategoria: '', descripcionCategoria: '' });

    const loadCategories = async () => {
        setLoading(true);

        try {
            const response = await apiRequest({ endpoint: '/categorias', token });
            setCategories(response.ok && Array.isArray(response.data) ? response.data : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const openModal = (category = null) => {
        setEditingCategory(category);
        setForm({
            nombreCategoria: category?.nombreCategoria || '',
            descripcionCategoria: category?.descripcionCategoria || ''
        });
        setVisible(true);
    };

    const submitCategory = async () => {
        if (!form.nombreCategoria.trim()) {
            Alert.alert('Validacion', 'El nombre es obligatorio');
            return;
        }

        const response = await apiRequest({
            endpoint: editingCategory ? `/categorias/${editingCategory.id_categoria}` : '/categorias',
            method: editingCategory ? 'PUT' : 'POST',
            body: {
                nombreCategoria: form.nombreCategoria.trim(),
                descripcionCategoria: form.descripcionCategoria.trim()
            },
            token
        });

        if (!response.ok) {
            Alert.alert('Error', response.error || 'No se pudo guardar la categoria');
            return;
        }

        setVisible(false);
        setEditingCategory(null);
        loadCategories();
    };

    const removeCategory = (category) => {
        const executeDelete = async () => {
            const response = await apiRequest({
                endpoint: `/categorias/${category.id_categoria}`,
                method: 'DELETE',
                token
            });

            if (!response.ok) {
                Alert.alert('Error', getCategoryDeleteErrorMessage(response));
                return;
            }

            if (Platform.OS === 'web') {
                window.alert('Categoria eliminada correctamente');
            } else {
                Alert.alert('Exito', 'Categoria eliminada correctamente');
            }

            loadCategories();
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Quieres eliminar ${category.nombreCategoria}?`);
            if (confirmed) {
                executeDelete();
            }
            return;
        }

        Alert.alert('Eliminar categoria', `Quieres eliminar ${category.nombreCategoria}?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: executeDelete
            }
        ]);
    };

    return (
        <Screen>
            <SectionHeader
                title="Categorias"
                subtitle="Listado y mantenimiento"
                actions={<PrimaryButton title="+ Nueva" onPress={() => openModal()} compact />}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#f58233" style={{ marginTop: 32 }} />
            ) : (
                <FlatList
                    data={categories}
                    keyExtractor={(item) => String(item.id_categoria)}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                        <Card>
                            <Text style={styles.title}>{item.nombreCategoria}</Text>
                            <Text style={styles.meta}>ID: {item.id_categoria}</Text>
                            <Text style={styles.meta}>{item.descripcionCategoria || 'Sin descripcion'}</Text>

                            <View style={styles.actions}>
                                <SecondaryButton title="Editar" onPress={() => openModal(item)} />
                                <DangerButton title="Eliminar" onPress={() => removeCategory(item)} />
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay categorias registradas." />}
                />
            )}

            <FormModal
                visible={visible}
                title={editingCategory ? 'Editar categoria' : 'Nueva categoria'}
                onClose={() => setVisible(false)}
                onSubmit={submitCategory}
                submitLabel={editingCategory ? 'Guardar cambios' : 'Crear categoria'}
            >
                <Field
                    label="Nombre"
                    value={form.nombreCategoria}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, nombreCategoria: value }))}
                />
                <Field
                    label="Descripcion"
                    value={form.descripcionCategoria}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, descripcionCategoria: value }))}
                    multiline
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
