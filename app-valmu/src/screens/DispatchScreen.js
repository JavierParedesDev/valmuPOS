import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
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

function normalizeDispatch(item = {}) {
    const status = String(item.estado || item.estadoDespacho || 'PENDIENTE').trim().toUpperCase();
    const dispatchId = item.id || item.id_despacho || item.idDespacho || null;

    return {
        ...item,
        dispatchId,
        status,
        saleLabel: item.venta || item.folioDocumento || `Venta #${item.id_venta || dispatchId || '-'}`,
        carrierLabel: item.transporte || item.nombreTransporte || 'Particular',
        plateLabel: item.patenteTransporte || item.patente || 'S/P',
        dateValue: item.fecha || item.fechaVenta || item.fechaCreacion || null,
        totalValue: Number(item.total || 0)
    };
}

export default function DispatchScreen({ token }) {
    const [loading, setLoading] = useState(true);
    const [dispatches, setDispatches] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');

    const [carrierModalVisible, setCarrierModalVisible] = useState(false);
    const [carrierForm, setCarrierForm] = useState({ nombreTransporte: '', patenteTransporte: '' });

    const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
    const [selectedDispatch, setSelectedDispatch] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');

    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dispRes, carrRes] = await Promise.all([
                apiRequest({ endpoint: '/despachos', token }),
                apiRequest({ endpoint: '/despachos/transportes', token })
            ]);

            const dispatchRows = Array.isArray(dispRes?.data) ? dispRes.data : (Array.isArray(dispRes) ? dispRes : []);
            const carrierRows = Array.isArray(carrRes?.data) ? carrRes.data : (Array.isArray(carrRes) ? carrRes : []);

            setDispatches(dispatchRows.map(normalizeDispatch));
            setCarriers(carrierRows);
        } catch (error) {
            console.error('Error fetching dispatches:', error);
            Alert.alert('Error', 'No se pudieron cargar los datos de despachos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const closeCarrierModal = () => {
        setCarrierModalVisible(false);
        setCarrierForm({ nombreTransporte: '', patenteTransporte: '' });
    };

    const closeDeliveryModal = () => {
        setDeliveryModalVisible(false);
        setSelectedDispatch(null);
        setPaymentMethod('EFECTIVO');
    };

    const handleAddCarrier = async () => {
        if (!carrierForm.nombreTransporte || !carrierForm.patenteTransporte) {
            Alert.alert('Incompleto', 'Por favor completa todos los campos.');
            return;
        }

        setSaving(true);
        try {
            const res = await apiRequest({
                endpoint: '/despachos/transportes',
                method: 'POST',
                body: carrierForm,
                token
            });

            if (res.ok || res?.data?.id_transporte) {
                Alert.alert('Éxito', 'Transportista agregado');
                closeCarrierModal();
                fetchData();
            } else {
                Alert.alert('Error', res?.error || 'No se pudo agregar el transportista');
            }
        } catch (_error) {
            Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCarrier = (carrier) => {
        Alert.alert(
            'Eliminar Transportista',
            `¿Estás seguro de que deseas eliminar a ${carrier.nombreTransporte}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        const res = await apiRequest({
                            endpoint: `/despachos/transportes/${carrier.id_transporte}`,
                            method: 'DELETE',
                            token
                        });

                        if (res.ok || res?.data?.mensaje) {
                            fetchData();
                        } else {
                            Alert.alert('Error', res?.error || 'No se pudo eliminar el transportista.');
                        }
                    }
                }
            ]
        );
    };

    const handleConfirmDelivery = async () => {
        if (!selectedDispatch?.dispatchId) {
            Alert.alert('Error', 'No se pudo identificar el despacho a entregar.');
            return;
        }

        setSaving(true);
        try {
            const res = await apiRequest({
                endpoint: `/despachos/${selectedDispatch.dispatchId}/estado`,
                method: 'PUT',
                body: {
                    estado: 'ENTREGADO',
                    metodoPago: paymentMethod
                },
                token
            });

            if (res.ok || res?.data?.mensaje) {
                Alert.alert('Éxito', 'Despacho marcado como entregado');
                closeDeliveryModal();
                fetchData();
            } else {
                Alert.alert('Error', res?.error || 'No se pudo procesar la entrega');
            }
        } catch (_error) {
            Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelDispatch = (item) => {
        const performCancel = async () => {
            if (!item?.dispatchId) {
                Alert.alert('Error', 'No se pudo identificar el despacho a cancelar.');
                return;
            }

            try {
                const res = await apiRequest({
                    endpoint: `/despachos/${item.dispatchId}/estado`,
                    method: 'PUT',
                    body: { estado: 'CANCELADO' },
                    token
                });

                if (res.ok || res?.data?.mensaje) {
                    fetchData();
                    if (Platform.OS === 'web') alert('Despacho cancelado');
                    else Alert.alert('Éxito', 'Despacho cancelado');
                } else {
                    if (Platform.OS === 'web') alert(res?.error || 'No se pudo cancelar el despacho');
                    else Alert.alert('Error', res?.error || 'No se pudo cancelar el despacho');
                }
            } catch (_error) {
                if (Platform.OS === 'web') alert('Error de conexión');
                else Alert.alert('Error', 'Error de conexión');
            }
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm('¿Realmente deseas cancelar este despacho? El stock será devuelto y la venta anulada.');
            if (confirmed) performCancel();
            return;
        }

        Alert.alert(
            'Cancelar Despacho',
            '¿Realmente deseas cancelar este despacho? El stock será devuelto y la venta anulada.',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Sí, Cancelar',
                    style: 'destructive',
                    onPress: performCancel
                }
            ]
        );
    };

    const pendingDispatches = dispatches.filter((dispatch) => dispatch.status === 'EN_RUTA');
    const historyDispatches = dispatches.filter((dispatch) => dispatch.status !== 'EN_RUTA');

    const renderDispatchItem = ({ item }) => {
        const isPending = item.status === 'EN_RUTA';
        const isDelivered = item.status === 'ENTREGADO' || item.status === 'FINALIZADO';

        return (
            <Card style={styles.dispatchCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.refInfo}>
                        <Text style={styles.refLabel}>VENTA / REF</Text>
                        <Text style={styles.refValue}>{item.saleLabel}</Text>
                    </View>
                    <View
                        style={[
                            styles.statusBadge,
                            {
                                backgroundColor: isPending
                                    ? brandColors.accentSoft
                                    : isDelivered
                                        ? '#ECFDF5'
                                        : brandColors.backgroundAlt
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusText,
                                {
                                    color: isPending
                                        ? brandColors.accent
                                        : isDelivered
                                            ? brandColors.success
                                            : brandColors.textMuted
                                }
                            ]}
                        >
                            {item.status.replace('_', ' ')}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <Ionicons name="car-outline" size={16} color={brandColors.textMuted} />
                        <Text style={styles.infoText}>{item.carrierLabel} - {item.plateLabel}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={16} color={brandColors.textMuted} />
                        <Text style={styles.infoText}>
                            {item.dateValue ? new Date(item.dateValue).toLocaleString() : 'Pendiente'}
                        </Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalValue}>${item.totalValue.toLocaleString('es-CL')}</Text>
                    </View>
                </View>

                {isPending && (
                    <View style={styles.cardActions}>
                        <View style={styles.actionColumn}>
                            <SecondaryButton
                                title="Entregar"
                                onPress={() => {
                                    setSelectedDispatch(item);
                                    setPaymentMethod('EFECTIVO');
                                    setDeliveryModalVisible(true);
                                }}
                                style={styles.actionBtn}
                            />
                        </View>
                        <View style={styles.actionColumn}>
                            <DangerButton
                                title="Cancelar"
                                onPress={() => handleCancelDispatch(item)}
                                style={styles.actionBtn}
                            />
                        </View>
                    </View>
                )}
            </Card>
        );
    };

    const renderCarrierItem = ({ item }) => (
        <Card style={styles.carrierCard}>
            <View style={styles.carrierInfo}>
                <View style={styles.carrierAvatar}>
                    <Ionicons name="person" size={20} color={brandColors.accent} />
                </View>
                <View style={styles.carrierDetails}>
                    <Text style={styles.carrierName}>{item.nombreTransporte}</Text>
                    <Text style={styles.carrierPlate}>{item.patenteTransporte || 'NO REGISTRADO'}</Text>
                </View>
            </View>
            <TouchableOpacity onPress={() => handleDeleteCarrier(item)} style={styles.deleteCarrierBtn}>
                <Ionicons name="trash-outline" size={20} color={brandColors.danger} />
            </TouchableOpacity>
        </Card>
    );

    const renderTabs = () => (
        <View style={styles.tabBar}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                onPress={() => setActiveTab('pending')}
            >
                <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>PENDIENTES</Text>
                {pendingDispatches.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pendingDispatches.length}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                onPress={() => setActiveTab('history')}
            >
                <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>HISTORIAL</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.tab, activeTab === 'carriers' && styles.activeTab]}
                onPress={() => setActiveTab('carriers')}
            >
                <Text style={[styles.tabText, activeTab === 'carriers' && styles.activeTabText]}>FLOTA</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Screen statusBarColor={brandColors.surface}>
            <View style={styles.container}>
                <SectionHeader
                    title="Despachos"
                    subtitle="Logística y flujos de entrega"
                    icon="bus-outline"
                    style={styles.header}
                />

                {renderTabs()}

                {loading ? (
                    <View style={styles.loaderArea}>
                        <ActivityIndicator size="large" color={brandColors.accent} />
                        <Text style={styles.loaderText}>Sincronizando rutas...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={activeTab === 'pending' ? pendingDispatches : activeTab === 'history' ? historyDispatches : carriers}
                        keyExtractor={(item) => String(item.dispatchId || item.id || item.id_despacho || item.id_transporte)}
                        renderItem={activeTab === 'carriers' ? renderCarrierItem : renderDispatchItem}
                        ListEmptyComponent={
                            <EmptyState
                                title={activeTab === 'carriers' ? 'Sin flota registrada' : 'Sin despachos'}
                                message="No hay datos para mostrar en esta sección."
                            />
                        }
                        contentContainerStyle={styles.listContent}
                    />
                )}

                {activeTab === 'carriers' && (
                    <PrimaryButton
                        title="Registrar Transportista"
                        onPress={() => setCarrierModalVisible(true)}
                        style={styles.fab}
                    />
                )}
            </View>

            <FormModal
                visible={carrierModalVisible}
                title="Nuevo Transportista"
                onClose={closeCarrierModal}
                onSubmit={handleAddCarrier}
                submitLabel={saving ? 'Guardando...' : 'Guardar'}
            >
                <Field
                    label="Nombre / Empresa"
                    value={carrierForm.nombreTransporte}
                    onChangeText={(value) => setCarrierForm({ ...carrierForm, nombreTransporte: value })}
                    placeholder="Ej: Transportes Valmu"
                />
                <Field
                    label="Patente Vehículo"
                    value={carrierForm.patenteTransporte}
                    onChangeText={(value) => setCarrierForm({ ...carrierForm, patenteTransporte: value })}
                    placeholder="Ej: ABCD-12"
                    autoCapitalize="characters"
                />
            </FormModal>

            <FormModal
                visible={deliveryModalVisible}
                title="Confirmar Entrega"
                onClose={closeDeliveryModal}
                onSubmit={handleConfirmDelivery}
                submitLabel={saving ? 'Confirmando...' : 'Confirmar'}
            >
                <Text style={styles.modalText}>
                    ¿Cómo realizó el pago el cliente para el despacho de la venta {selectedDispatch?.saleLabel}?
                </Text>
                <PickerField
                    label="Método de Pago"
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value)}
                    options={[
                        { label: 'Efectivo', value: 'EFECTIVO' },
                        { label: 'Tarjeta', value: 'TARJETA' },
                        { label: 'Transferencia', value: 'TRANSFERENCIA' }
                    ]}
                />
            </FormModal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 16
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 16
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.border,
        marginBottom: 8
    },
    tab: {
        paddingVertical: 12,
        marginRight: 24,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center'
    },
    activeTab: {
        borderBottomColor: brandColors.accent
    },
    tabText: {
        fontSize: 12,
        fontWeight: '900',
        color: brandColors.textMuted,
        letterSpacing: 1
    },
    activeTabText: {
        color: brandColors.accent
    },
    badge: {
        backgroundColor: brandColors.accent,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
        paddingHorizontal: 4
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900'
    },
    listContent: {
        padding: 16,
        paddingBottom: 120
    },
    dispatchCard: {
        padding: 16,
        marginBottom: 16
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: brandColors.background,
        paddingBottom: 12,
        marginBottom: 12
    },
    refInfo: {
        flex: 1,
        paddingRight: 12
    },
    refLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: brandColors.textMuted,
        letterSpacing: 1,
        marginBottom: 4
    },
    refValue: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase'
    },
    cardBody: {
        marginBottom: 16
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    infoText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: brandColors.text,
        fontWeight: '600'
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 10
    },
    totalLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: brandColors.textMuted,
        letterSpacing: 1
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: brandColors.text
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between'
    },
    actionColumn: {
        flex: 1
    },
    actionBtn: {
        width: '100%'
    },
    carrierCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        marginBottom: 12
    },
    carrierInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    carrierAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: brandColors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    carrierDetails: {
        flex: 1
    },
    carrierName: {
        fontSize: 15,
        fontWeight: '900',
        color: brandColors.text
    },
    carrierPlate: {
        fontSize: 11,
        fontWeight: '800',
        color: brandColors.accent,
        backgroundColor: brandColors.accentSoft,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 4
    },
    deleteCarrierBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loaderArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '700'
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
        shadowColor: brandColors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5
    },
    modalText: {
        fontSize: 14,
        color: brandColors.text,
        marginBottom: 16,
        lineHeight: 20
    }
});
