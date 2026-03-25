import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

function getCategoryDeleteErrorMessage(response) {
    const rawMessage = String(
        response?.data?.error ||
        response?.error ||
        'No se pudo eliminar la categoría'
    );
    const normalizedMessage = rawMessage.toLowerCase();

    if (
        normalizedMessage.includes('foreign key') ||
        normalizedMessage.includes('constraint') ||
        normalizedMessage.includes('producto') ||
        normalizedMessage.includes('referenc')
    ) {
        return 'No puedes eliminar esta categoría porque tiene productos asociados.';
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
            Alert.alert('Validación', 'El nombre es obligatorio');
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
            Alert.alert('Error', response.error || 'No se pudo guardar la categoría');
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
                window.alert('Categoría eliminada correctamente');
            } else {
                Alert.alert('Éxito', 'Categoría eliminada correctamente');
            }

            loadCategories();
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`¿Quieres eliminar ${category.nombreCategoria}?`);
            if (confirmed) {
                executeDelete();
            }
            return;
        }

        Alert.alert('Eliminar categoría', `¿Quieres eliminar ${category.nombreCategoria}?`, [
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
                title="Categorías"
                subtitle="Organiza tu catálogo por grupos"
                actions={<PrimaryButton title="+ Nueva" onPress={() => openModal()} compact style={{ borderRadius: 12, height: 44 }} />}
            />

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.loaderText}>Cargando categorías...</Text>
                </View>
            ) : (
                <FlatList
                    data={categories}
                    keyExtractor={(item) => String(item.id_categoria)}
                    contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 4 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Card style={styles.categoryCard}>
                            <View style={styles.cardContent}>
                                <View style={styles.iconContainer}>
                                    <Ionicons name="folder-outline" size={24} color={brandColors.accent} />
                                </View>
                                <View style={styles.infoContainer}>
                                    <Text style={styles.title}>{item.nombreCategoria}</Text>
                                    <Text style={styles.description} numberOfLines={2}>
                                        {item.descripcionCategoria || 'Sin descripción adicional'}
                                    </Text>
                                    <View style={styles.idBadge}>
                                        <Text style={styles.idText}>ID: {item.id_categoria}</Text>
                                    </View>
                                </View>
                                <View style={styles.actionsColumn}>
                                    <TouchableOpacity style={styles.actionIconButton} onPress={() => openModal(item)}>
                                        <Ionicons name="create-outline" size={20} color={brandColors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionIconButton, styles.deleteButton]} onPress={() => removeCategory(item)}>
                                        <Ionicons name="trash-outline" size={20} color={brandColors.danger} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay categorías registradas." />}
                />
            )}

            <FormModal
                visible={visible}
                title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                onClose={() => setVisible(false)}
                onSubmit={submitCategory}
                submitLabel={editingCategory ? 'Guardar cambios' : 'Crear categoría'}
            >
                <Field
                    label="Nombre de la categoría"
                    value={form.nombreCategoria}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, nombreCategoria: value }))}
                    placeholder="Ej: Abarrotes, Bebestibles..."
                />
                <Field
                    label="Descripción (opcional)"
                    value={form.descripcionCategoria}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, descripcionCategoria: value }))}
                    multiline
                    placeholder="Breve descripción del grupo..."
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
    categoryCard: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 24
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: brandColors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16
    },
    infoContainer: {
        flex: 1
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text,
        marginBottom: 2
    },
    description: {
        fontSize: 13,
        color: brandColors.textMuted,
        fontWeight: '500',
        lineHeight: 18,
        marginBottom: 6
    },
    idBadge: {
        alignSelf: 'flex-start',
        backgroundColor: brandColors.backgroundAlt,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6
    },
    idText: {
        fontSize: 10,
        fontWeight: '800',
        color: brandColors.textMuted
    },
    actionsColumn: {
        gap: 8,
        marginLeft: 12
    },
    actionIconButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: brandColors.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center'
    },
    deleteButton: {
        backgroundColor: '#FEE2E2'
    }
});

