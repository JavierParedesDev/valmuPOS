import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { Card, Screen, SectionHeader, EmptyState } from '../components/UI';
import { brandColors } from '../theme';

export default function InventoryReportScreen({ token, user }) {
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMovements = async () => {
        try {
            const response = await apiRequest({ 
                endpoint: '/reportes/movimientos-inventario', 
                token 
            });
            if (response.ok) {
                setMovements(Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []));
            }
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMovements();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMovements();
    };

    const handleDelete = (id) => {
        Alert.alert(
            'Eliminar Registro',
            '¿Estás seguro de que deseas eliminar este registro del historial? Esta acción no se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'Eliminar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiRequest({
                                endpoint: `/reportes/movimientos-inventario/${id}`,
                                method: 'DELETE',
                                token
                            });
                            if (response.ok) {
                                fetchMovements();
                            } else {
                                Alert.alert('Error', response.data?.error || 'No se pudo eliminar el registro.');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Error de conexión con el servidor.');
                        }
                    }
                }
            ]
        );
    };

    const getTipoInfo = (tipo) => {
        const t = (tipo || '').toUpperCase();
        if (t.includes('INGRESO') || t.includes('ENTRADA')) {
            return { color: brandColors.success, icon: 'arrow-down-circle', label: 'INGRESO' };
        }
        if (t.includes('SALIDA') || t.includes('VENTA') || t.includes('EGRESO')) {
            return { color: brandColors.danger, icon: 'arrow-up-circle', label: 'SALIDA' };
        }
        return { color: brandColors.accent, icon: 'swap-horizontal', label: t };
    };

    const renderMovement = ({ item }) => {
        const info = getTipoInfo(item.tipoMovimiento);
        const date = item.fechaMov ? new Date(item.fechaMov).toLocaleString('es-CL', { 
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
        }) : '--';

        const roleId = user?.id_rol ?? user?.rol_id ?? user?.idRol;
        const roleName = String(user?.rol || '').toLowerCase();
        const isAdmin = true; // DEBUG: Forzado para confirmar visualización

        return (
            <Card style={styles.moveCard}>
                <View style={[styles.typeStrip, { backgroundColor: info.color }]} />
                <View style={styles.cardContent}>
                    <View style={styles.row}>
                        <View style={styles.mainInfo}>
                            <Text style={styles.prodName} numberOfLines={1}>{item.nombreProducto}</Text>
                            <Text style={styles.sku}>{item.codigoBarras || 'S/C'}</Text>
                        </View>
                        <View style={styles.qtyBadge}>
                            <Text style={[styles.qtyText, { color: info.color }]}>
                                {item.esPesable 
                                    ? `${parseFloat(item.cantidadMov).toFixed(3)} KG` 
                                    : `${Math.round(item.cantidadMov)} UN.`}
                            </Text>
                        </View>
                        
                        {isAdmin && (
                            <TouchableOpacity onPress={() => handleDelete(item.id_movimiento)} style={styles.deleteBtn}>
                                <Ionicons name="trash-outline" size={18} color={brandColors.danger} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Divider style={styles.divider} />

                    <View style={styles.metaGrid}>
                        <View style={styles.metaItem}>
                            <Ionicons name="person-outline" size={12} color={brandColors.textMuted} />
                            <Text style={styles.metaText} numberOfLines={1}>{item.usuarioResponsable}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={12} color={brandColors.textMuted} />
                            <Text style={styles.metaText}>{date}</Text>
                        </View>
                    </View>

                    <View style={styles.locationRow}>
                        <View style={styles.locBlock}>
                            <Text style={styles.locLabel}>ORIGEN</Text>
                            <Text style={styles.locName} numberOfLines={1}>{item.sucursalOrigen}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={14} color={brandColors.outline} />
                        <View style={styles.locBlock}>
                            <Text style={styles.locLabel}>DESTINO</Text>
                            <Text style={styles.locName} numberOfLines={1}>{item.sucursalDestino}</Text>
                        </View>
                    </View>
                    
                    {item.comprobanteMov && (
                        <View style={styles.docChip}>
                            <Text style={styles.docText}>Doc: {item.comprobanteMov}</Text>
                        </View>
                    )}
                </View>
            </Card>
        );
    };

    return (
        <Screen statusBarColor={brandColors.surface}>
            <FlatList
                data={movements}
                keyExtractor={(item) => String(item.id_movimiento)}
                renderItem={renderMovement}
                ListHeaderComponent={
                    <SectionHeader 
                        title="Auditoría de Stock" 
                        subtitle="Historial completo de movimientos"
                        icon="shield-checkmark-outline"
                        actions={
                            <TouchableOpacity 
                                onPress={() => {
                                    Alert.alert(
                                        'Limpiar Historial',
                                        '¿Deseas eliminar TODOS los registros de movimientos? Esta acción es irreversible.',
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            { 
                                                text: 'Limpiar Todo', 
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        const response = await apiRequest({
                                                            endpoint: '/reportes/movimientos-inventario/limpiar-todo',
                                                            method: 'POST',
                                                            token
                                                        });
                                                        if (response.ok) fetchMovements();
                                                    } catch (e) {}
                                                }
                                            }
                                        ]
                                    );
                                }}
                                style={styles.headerAction}
                            >
                                <Ionicons name="trash-bin-outline" size={24} color={brandColors.danger} />
                            </TouchableOpacity>
                        }
                    />
                }
                ListEmptyComponent={
                    loading ? null : (
                        <EmptyState 
                            title="Sin movimientos" 
                            message="No se han registrado movimientos de inventario aún."
                            icon="list-outline"
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
        </Screen>
    );
}

const styles = StyleSheet.create({
    list: {
        padding: 16,
        paddingBottom: 40
    },
    moveCard: {
        marginBottom: 12,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: 16
    },
    typeStrip: {
        width: 6,
        height: '100%'
    },
    cardContent: {
        flex: 1,
        padding: 14,
    },
    row: {
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
    qtyBadge: {
        backgroundColor: brandColors.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: brandColors.outline
    },
    qtyText: {
        fontSize: 13,
        fontWeight: '900'
    },
    divider: {
        marginVertical: 10,
        backgroundColor: brandColors.outline,
        opacity: 0.5
    },
    metaGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 10
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    metaText: {
        fontSize: 11,
        fontWeight: '600',
        color: brandColors.textMuted
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: brandColors.background,
        padding: 8,
        borderRadius: 12
    },
    locBlock: {
        flex: 1
    },
    locLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: brandColors.textMuted,
        marginBottom: 2
    },
    locName: {
        fontSize: 11,
        fontWeight: '700',
        color: brandColors.text
    },
    docChip: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: brandColors.accentSoft,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderBottomLeftRadius: 8
    },
    docText: {
        fontSize: 9,
        fontWeight: '900',
        color: brandColors.accent
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.7)'
    },
    deleteBtn: {
        padding: 4,
        marginLeft: 8
    },
    headerAction: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#FEE2E2'
    }
});
