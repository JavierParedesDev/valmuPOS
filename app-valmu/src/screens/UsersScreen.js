import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import {
    Card,
    Screen,
    SectionHeader,
    PrimaryButton,
    SecondaryButton,
    DangerButton,
    FormModal,
    Field,
    PickerField,
    EmptyState
} from '../components/UI';
import { brandColors } from '../theme';

export default function UsersScreen({ token }) {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [branches, setBranches] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState(emptyUserForm());
    const [saving, setSaving] = useState(false);

    const buildRolesFromUsers = (usersList) => {
        const roleMap = new Map();
        (usersList || []).forEach((u) => {
            const id = u.id_rol || u.idRol || u.rol_id || u.roleId;
            const name = u.nombreRol || u.rol || u.role || u.nombre_rol;
            if (id && name) {
                roleMap.set(String(id), { id_rol: String(id), nombreRol: name });
            }
        });

        if (roleMap.size) {
            return Array.from(roleMap.values());
        }

        return [
            { id_rol: '1', nombreRol: 'Administrador' },
            { id_rol: '2', nombreRol: 'Vendedor' },
            { id_rol: '3', nombreRol: 'Bodeguero' }
        ];
    };

    const apiRequestWithFallback = async ({ endpoints, method = 'GET', body, token }) => {
        let lastResponse = null;
        for (const endpoint of endpoints) {
            const response = await apiRequest({ endpoint, method, body, token });
            lastResponse = response;
            if (response.ok || response.status !== 404) {
                return response;
            }
        }
        return lastResponse || { ok: false, status: 0, error: 'No se pudo conectar con el servidor' };
    };

    function emptyUserForm() {
        return {
            nombreCompleto: '',
            nombreUsuario: '',
            contrasena: '',
            id_rol: '',
            id_sucursal: 'null'
        };
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, branchRes] = await Promise.all([
                apiRequestWithFallback({ endpoints: ['/auth/usuarios', '/usuarios'], token }),
                apiRequest({ endpoint: '/sucursales', token })
            ]);

            const usersData = unwrapArrayResponse(usersRes);
            setUsers(usersData);
            setRoles(buildRolesFromUsers(usersData));
            setBranches(unwrapArrayResponse(branchRes));
        } catch (error) {
            console.error('Error fetching users:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos de usuarios.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenCreate = () => {
        setEditingUser(null);
        setForm(emptyUserForm());
        setModalVisible(true);
    };

    const handleOpenEdit = (user) => {
        setEditingUser(user);
        setForm({
            nombreCompleto: user.nombreCompleto || '',
            nombreUsuario: user.nombreUsuario || user.username || '',
            contrasena: '', // Empty to keep password
            id_rol: String(user.id_rol || user.idRol || ''),
            id_sucursal: (user.id_sucursal !== null && user.id_sucursal !== undefined) ? String(user.id_sucursal) : 'null'
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!form.nombreUsuario || (!editingUser && !form.contrasena) || !form.id_rol || !form.id_sucursal) {
            Alert.alert('Incompleto', 'Por favor completa todos los campos requeridos.');
            return;
        }

        setSaving(true);
        try {
            const userId = editingUser?.id_usuario || editingUser?.id;
            const endpoints = editingUser ? [`/auth/usuarios/${userId}`, `/usuarios/${userId}`] : ['/auth/usuarios', '/usuarios'];
            const method = editingUser ? 'PUT' : 'POST';

            const submitBody = {
                nombreCompleto: form.nombreCompleto,
                nombreUsuario: form.nombreUsuario,
                contrasena: form.contrasena,
                id_rol: form.id_rol,
                id_sucursal: form.id_sucursal === 'null' || form.id_sucursal === '' ? null : form.id_sucursal,
                activo: true,
                username: form.nombreUsuario,
                password: form.contrasena
            };
            if (editingUser && !form.contrasena) {
                delete submitBody.contrasena;
                delete submitBody.password;
            }

            const res = await apiRequestWithFallback({
                endpoints,
                method,
                body: submitBody,
                token
            });

            if (res.ok) {
                Alert.alert('Éxito', editingUser ? 'Usuario actualizado' : 'Usuario creado');
                setModalVisible(false);
                fetchData();
            } else {
                Alert.alert('Error', res.data?.error || 'No se pudo guardar el usuario');
            }
        } catch (error) {
            Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (user) => {
        Alert.alert(
            'Eliminar Usuario',
            `¿Estás seguro de que deseas eliminar a ${user.nombreUsuario}`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        const userId = user.id_usuario || user.id;
                        const res = await apiRequestWithFallback({
                            endpoints: [`/auth/usuarios/${userId}`, `/usuarios/${userId}`],
                            method: 'DELETE',
                            token
                        });
                        if (res.ok) {
                            fetchData();
                        } else {
                            Alert.alert('Error', res.data?.error || 'No se pudo eliminar');
                        }
                    }
                }
            ]
        );
    };

    const renderUser = ({ item }) => (
        <Card style={styles.userCard}>
            <View style={styles.userInfo}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(item.nombreCompleto || item.nombreUsuario || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userDetails}>
                    <Text style={styles.userName}>{item.nombreUsuario || item.username}</Text>
                    <Text style={styles.userRole}>{item.rol || item.nombreRol || 'Sin rol'}</Text>
                    <Text style={styles.userBranch}>{item.id_sucursal ? (item.nombreSucursal || item.sucursal || 'Sin sucursal') : 'Ambas sucursales'}</Text>
                </View>
            </View>
            <View style={styles.actions}>
                <SecondaryButton
                    icon="pencil-outline"
                    onPress={() => handleOpenEdit(item)}
                    style={styles.actionBtn}
                />
                <DangerButton
                    icon="trash-outline"
                    onPress={() => handleDelete(item)}
                    style={styles.actionBtn}
                />
            </View>
        </Card>
    );

    if (loading && !modalVisible) {
        return (
            <View style={styles.loaderArea}>
                <ActivityIndicator size="large" color={brandColors.accent} />
                <Text style={styles.loaderText}>Cargando usuarios...</Text>
            </View>
        );
    }

    return (
        <Screen statusBarColor={brandColors.surface}>
            <FlatList
                data={users}
                keyExtractor={(item) => String(item.id_usuario || item.id)}
                renderItem={renderUser}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <SectionHeader
                            title="Operadores"
                            subtitle="Gestión de accesos y roles"
                            icon="people-outline"
                        />
                        <PrimaryButton
                            title="Nuevo Usuario"
                            icon="add-outline"
                            onPress={handleOpenCreate}
                            style={styles.addBtn}
                        />
                    </View>
                }
                ListEmptyComponent={<EmptyState text="No hay usuarios registrados." />}
                contentContainerStyle={styles.listContent}
            />

            <FormModal
                visible={modalVisible}
                title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                onClose={() => setModalVisible(false)}
                onSubmit={handleSave}
                submitLabel={saving ? 'Guardando...' : (editingUser ? 'Guardar cambios' : 'Crear usuario')}
                submitDisabled={saving}
            >
                <Field
                    label="Nombre Completo"
                    value={form.nombreCompleto}
                    onChangeText={(val) => setForm({ ...form, nombreCompleto: val })}
                    placeholder="Ej: Juan Pérez"
                />
                <Field
                    label="Nombre de Usuario"
                    value={form.nombreUsuario}
                    onChangeText={(val) => setForm({ ...form, nombreUsuario: val })}
                    placeholder="Ej: jperez"
                    autoCapitalize="none"
                />
                <Field
                    label={editingUser ? "Cambiar Contraseña (opcional)" : "Contraseña"}
                    value={form.contrasena}
                    onChangeText={(val) => setForm({ ...form, contrasena: val })}
                    isPassword
                    placeholder="**********"
                />
                <PickerField
                    label="Rol de Usuario"
                    value={form.id_rol}
                    onChange={(val) => setForm({ ...form, id_rol: val })}
                    options={roles.map(r => ({ label: r.nombreRol || r.nombre || r.rol, value: String(r.id_rol || r.id) }))}
                    emptyLabel="Seleccionar rol..."
                />
                <PickerField
                    label="Sucursal Asignada"
                    value={form.id_sucursal}
                    onChange={(val) => setForm({ ...form, id_sucursal: val })}
                    options={[
                        { label: 'Ambas sucursales', value: 'null' },
                        ...branches.map(b => ({ label: b.nombreSucursal || b.nombre, value: String(b.id_sucursal || b.id) }))
                    ]}
                    emptyLabel="Seleccionar sucursal..."
                />
            </FormModal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        marginBottom: 16
    },
    listContent: {
        padding: 16,
        paddingBottom: 100
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
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        marginBottom: 10
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: brandColors.accentSoft,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        color: brandColors.accentStrong,
        fontWeight: '900',
        fontSize: 18
    },
    userDetails: {
        flex: 1
    },
    userName: {
        fontSize: 15,
        fontWeight: '800',
        color: brandColors.text
    },
    userRole: {
        fontSize: 11,
        fontWeight: '700',
        color: brandColors.accent,
        textTransform: 'uppercase',
        marginTop: 1
    },
    userBranch: {
        fontSize: 10,
        color: brandColors.textMuted,
        marginTop: 1
    },
    actions: {
        flexDirection: 'row',
        gap: 8
    },
    actionBtn: {
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: 10
    },
    addBtn: {
        marginTop: 8
    }
});

function unwrapArrayResponse(response) {
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response)) return response;
    return [];
}
