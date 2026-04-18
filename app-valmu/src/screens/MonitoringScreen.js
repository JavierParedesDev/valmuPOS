import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Modal, Portal, Divider } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { Card, Screen, SectionHeader, Badge } from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency } from '../utils/format';

export default function MonitoringScreen({ token, navigateTo }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        salesToday: 0,
        profitToday: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        salesCount: 0
    });
    const [salesSplit, setSalesSplit] = useState({
        caja: { ventasSII: 0, ventasInternas: 0, gananciaNeta: 0 },
        despacho: { ventasSII: 0, ventasInternas: 0, gananciaNeta: 0 }
    });
    const [branchSplitRows, setBranchSplitRows] = useState([]);
    const [recentSales, setRecentSales] = useState([]);
    const [criticalItems, setCriticalItems] = useState([]);

    // Modal para detalle de venta
    const [showModal, setShowModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleDetail, setSaleDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Modal para ingreso rápido de stock
    const [showStockModal, setShowStockModal] = useState(false);
    const [stockItem, setStockItem] = useState(null);
    const [stockQty, setStockQty] = useState('1');
    const [savingStock, setSavingStock] = useState(false);

    const fetchData = async () => {
        try {
            const [prodRes, salesRes, branchRes, kpisRes, branchSplitRes] = await Promise.all([
                apiRequest({ endpoint: '/productos?limit=10000', token }),
                apiRequest({ endpoint: '/ventas', token }),
                apiRequest({ endpoint: '/sucursales', token }),
                apiRequest({ endpoint: '/reportes/kpis-diarios', token }),
                apiRequest({ endpoint: '/reportes/ventas-por-sucursal', token })
            ]);

            const products = Array.isArray(prodRes?.data) ? prodRes.data : [];
            const allSales = Array.isArray(salesRes?.data) ? salesRes.data : (Array.isArray(salesRes) ? salesRes : []);
            const branches = Array.isArray(branchRes?.data) ? branchRes.data : [];
            const kpiData = kpisRes?.ok && kpisRes?.data ? kpisRes.data : null;
            const branchSplitData = branchSplitRes?.ok && Array.isArray(branchSplitRes?.data) ? branchSplitRes.data : [];

            // Hoy (local)
            const today = new Date();
            const hoyStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const productMap = {};
            products.forEach(p => {
                productMap[p.id_producto] = { costo: parseFloat(p.precioCosto) || 0 };
            });

            // Stats hoy
            let todaySales = 0;
            let todayProfit = 0;
            let todayCount = 0;
            const branchSalesMap = {}; // id_sucursal -> { total: 0, count: 0, name: '' }

            branches.forEach(b => {
                branchSalesMap[b.id_sucursal] = { total: 0, count: 0, name: b.nombreSucursal };
            });

            allSales.forEach(s => {
                const rawDate = (s.fecha_venta || s.fechaVenta || s.created_at || '');
                if (!rawDate) return;

                const dateObj = new Date(rawDate);
                if (isNaN(dateObj.getTime())) return;

                const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

                if (dateStr === hoyStr && (s.estado || s.status || '').toLowerCase() !== 'anulada') {
                    const total = Number(s.total || s.monto_total || 0);
                    todaySales += total;
                    todayCount++;
                    const cost = Number(s.costo_total) || (total * 0.78);
                    todayProfit += (total - cost);

                    const sid = s.id_sucursal || s.branchId;
                    if (sid && branchSalesMap[sid]) {
                        branchSalesMap[sid].total += total;
                        branchSalesMap[sid].count += 1;
                    }
                }
            });

            // Convert to array for easier rendering
            const salesByBranch = Object.values(branchSalesMap).filter(b => b.total > 0 || b.count > 0);

            // Valorización e Inventario Crítico
            let totalValue = 0;
            const tempCritical = [];
            const lowStockThreshold = 10;

            const inventoryPromises = branches.map(b =>
                apiRequest({ endpoint: `/productos/inventario?id_sucursal=${b.id_sucursal}`, token })
            );
            const invResults = await Promise.all(inventoryPromises);

            invResults.forEach((res, index) => {
                const branch = branches[index];
                const stockItems = Array.isArray(res?.data) ? res.data : [];

                stockItems.forEach(item => {
                    const stock = parseFloat(item.stockActual || item.cantidad || item.stock || 0);
                    const itemCosto = parseFloat(item.precioCosto || item.costo || 0) || (productMap[item.id_producto]?.costo || 0);

                    totalValue += (stock * itemCosto);

                    if (stock >= 0 && stock <= lowStockThreshold) {
                        tempCritical.push({
                            ...item,
                            id_sucursal: branch.id_sucursal,
                            branchName: branch.nombreSucursal,
                            stock
                        });
                    }
                });
            });

            setStats({
                salesToday: kpiData
                    ? Number(kpiData.ventasSII || 0) + Number(kpiData.ventasInternas || 0)
                    : todaySales,
                profitToday: kpiData
                    ? Number(kpiData.gananciaNeta || 0)
                    : todayProfit,
                inventoryValue: totalValue,
                lowStockCount: tempCritical.length,
                salesCount: todayCount,
                salesByBranch // New field
            });
            setSalesSplit({
                caja: {
                    ventasSII: Number(kpiData?.caja?.ventasSII || 0),
                    ventasInternas: Number(kpiData?.caja?.ventasInternas || 0),
                    gananciaNeta: Number(kpiData?.caja?.gananciaNeta || 0)
                },
                despacho: {
                    ventasSII: Number(kpiData?.despacho?.ventasSII || 0),
                    ventasInternas: Number(kpiData?.despacho?.ventasInternas || 0),
                    gananciaNeta: Number(kpiData?.despacho?.gananciaNeta || 0)
                }
            });
            setBranchSplitRows(branchSplitData);

            setRecentSales(allSales.slice(0, 10));
            setCriticalItems(tempCritical.slice(0, 15));

        } catch (error) {
            console.error('Error fetching monitoring data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchSaleDetail = async (sale) => {
        setSelectedSale(sale);
        setShowModal(true);
        setLoadingDetail(true);
        setSaleDetail(null);
        try {
            const saleId = sale.id_venta || sale.folio || sale.id;
            // Usamos la ruta real de tu servidor: /api/ventas/:id
            const res = await apiRequest({ endpoint: `/ventas/${saleId}`, token });
            
            if (res.ok && res.data) {
                // Adaptamos tu estructura { cabecera, productos, pagos } a lo que la vista espera
                setSaleDetail({
                    items: res.data.productos || [],
                    pagos: res.data.pagos || []
                });
            }
        } catch (error) {
            console.error('Error loading sale detail:', error);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleQuickInbound = async () => {
        if (!stockItem || !stockQty || parseFloat(stockQty) <= 0) return;
        
        setSavingStock(true);
        try {
            const res = await apiRequest({
                endpoint: '/productos/ingreso',
                method: 'POST',
                body: {
                    id_producto: parseInt(stockItem.id_producto),
                    id_sucursal: parseInt(stockItem.id_sucursal),
                    cantidadIngreso: parseFloat(stockQty),
                    numeroFactura: 'AJUSTE-RAPIDO'
                },
                token
            });

            if (res.ok) {
                Alert.alert('Éxito', 'Stock actualizado correctamente.');
                setShowStockModal(false);
                fetchData(); // Recargar datos
            } else {
                Alert.alert('Error', res.error || 'No se pudo actualizar el stock');
            }
        } catch (error) {
            Alert.alert('Error', 'Fallo en la comunicación con el servidor');
        } finally {
            setSavingStock(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <View style={styles.loaderArea}>
                <ActivityIndicator size="large" color={brandColors.accent} />
                <Text style={styles.loaderText}>Sincronizando monitoreo...</Text>
            </View>
        );
    }

    return (
        <Screen statusBarColor={brandColors.surface}>
            <ScrollView
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={styles.scrollContent}
            >
                <SectionHeader
                    title="Estado del Negocio"
                    subtitle="Monitoreo en tiempo real"
                    icon="pulse-outline"
                />

                <View style={styles.grid}>
                    <StatCard
                        label="Ventas hoy consolidadas"
                        value={formatCurrency(stats.salesToday)}
                        caption={`${stats.salesCount} tickets de sucursales`}
                        icon="cash-outline"
                        color={brandColors.accent}
                    />
                    <StatCard
                        label="Utilidad Bruta"
                        value={formatCurrency(stats.profitToday)}
                        caption="Margen estimado"
                        icon="trending-up-outline"
                        color={brandColors.success}
                    />
                    <StatCard
                        label="Inversión Stock"
                        value={formatCurrency(stats.inventoryValue)}
                        caption="Valor de inventario"
                        icon="cube-outline"
                        color={brandColors.shell}
                    />
                    <StatCard
                        label="Stock Crítico"
                        value={stats.lowStockCount}
                        caption="Bajo umbral (10)"
                        icon="warning-outline"
                        color={brandColors.danger}
                    />
                </View>

                <View style={styles.section}>
                    <SectionHeader
                        title="Canales de venta"
                        subtitle="Caja y despacho separados como en Admin"
                        compact
                    />
                    <SplitChannelCard
                        tone="caja"
                        title="Total caja de sucursales"
                        subtitle="Solo caja"
                        icon="storefront-outline"
                        data={salesSplit.caja}
                    />
                    <SplitChannelCard
                        tone="despacho"
                        title="Total despacho de sucursales"
                        subtitle="Despacho + en ruta"
                        icon="bus-outline"
                        data={salesSplit.despacho}
                    />
                </View>

                {branchSplitRows && branchSplitRows.length > 0 ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title="Detalle por sucursal"
                            subtitle="Caja y despacho separados por local"
                            compact
                        />
                        <Card style={styles.branchContainer}>
                            {branchSplitRows.map((branch, idx) => (
                                <View key={branch.id_sucursal || idx} style={[styles.branchSplitBlock, idx === branchSplitRows.length - 1 && { borderBottomWidth: 0 }]}>
                                    <View style={styles.branchSplitHeader}>
                                        <View style={styles.branchInfo}>
                                            <Text style={styles.branchName}>{branch.nombreSucursal || 'Desconocida'}</Text>
                                            <Text style={styles.branchCount}>Separacion por canal del dia</Text>
                                        </View>
                                    </View>
                                    <View style={styles.branchSplitGrid}>
                                        <BranchMetricCard
                                            label="Caja SII"
                                            value={branch.ventasSIICaja}
                                            tone="caja"
                                        />
                                        <BranchMetricCard
                                            label="Caja Internas"
                                            value={branch.ventasInternasCaja}
                                            tone="caja"
                                        />
                                        <BranchMetricCard
                                            label="Caja Ganancia"
                                            value={branch.gananciaCaja}
                                            tone="gain"
                                        />
                                        <BranchMetricCard
                                            label="Despacho SII"
                                            value={branch.ventasSIIDespacho}
                                            tone="despacho"
                                        />
                                        <BranchMetricCard
                                            label="Despacho Internas"
                                            value={branch.ventasInternasDespacho}
                                            tone="despacho"
                                        />
                                        <BranchMetricCard
                                            label="Despacho Ganancia"
                                            value={branch.gananciaDespacho}
                                            tone="gain"
                                        />
                                    </View>
                                </View>
                            ))}
                        </Card>
                    </View>
                ) : stats.salesByBranch && stats.salesByBranch.length > 0 ? (
                    <View style={styles.section}>
                        <SectionHeader title="Totales por sucursal" compact />
                        <Card style={styles.branchContainer}>
                            {stats.salesByBranch.map((b, idx) => (
                                <View key={idx} style={[styles.branchRow, idx === stats.salesByBranch.length - 1 && { borderBottomWidth: 0 }]}>
                                    <View style={styles.branchInfo}>
                                        <Text style={styles.branchName}>{b.name || 'Desconocida'}</Text>
                                        <Text style={styles.branchCount}>{b.count} ventas</Text>
                                    </View>
                                    <Text style={styles.branchTotal}>{formatCurrency(b.total)}</Text>
                                </View>
                            ))}
                        </Card>
                    </View>
                ) : null}

                <View style={styles.section}>
                    <SectionHeader title="Productos Críticos" compact />
                    {criticalItems.length > 0 ? (
                        criticalItems.map((item, idx) => (
                            <CriticalRow 
                                key={idx} 
                                item={item} 
                                onAddStock={() => {
                                    setStockItem(item);
                                    setStockQty('1');
                                    setShowStockModal(true);
                                }}
                            />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No hay alertas de stock crítico.</Text>
                    )}
                </View>

                <View style={[styles.section, { marginBottom: 120 }]}>
                    <SectionHeader title="Últimas Ventas" compact />
                    {recentSales.length > 0 ? (
                        recentSales.map((sale, idx) => (
                            <RecentSaleRow key={idx} sale={sale} onPress={() => fetchSaleDetail(sale)} />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No se registran ventas recientes.</Text>
                    )}
                </View>
            </ScrollView>

            <Portal>
                <Modal
                    visible={showModal}
                    onDismiss={() => setShowModal(false)}
                    contentContainerStyle={styles.modalScroll}
                >
                    <View style={styles.modalHeader}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Detalle de Venta</Text>
                        <Text style={styles.modalSubtitle}>Ticket #{selectedSale?.id_venta || selectedSale?.folio || '#'}</Text>
                    </View>

                    <View style={styles.modalBody}>
                        {loadingDetail ? (
                            <View style={styles.modalLoader}>
                                <ActivityIndicator color={brandColors.accent} />
                                <Text style={styles.modalLoaderText}>Cargando productos...</Text>
                            </View>
                        ) : saleDetail ? (
                            <>
                                <View style={styles.itemsList}>
                                    {(saleDetail.items || []).map((item, index) => (
                                        <View key={index} style={styles.itemRow}>
                                            <View style={styles.itemInfo}>
                                                <Text style={styles.itemName}>{item.nombreProducto}</Text>
                                                <Text style={styles.itemQty}>{item.cantidad} x {formatCurrency(item.precioVenta)}</Text>
                                            </View>
                                            <Text style={styles.itemSubtotal}>{formatCurrency(item.subtotalLinea || (item.cantidad * item.precioVenta))}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Divider style={styles.modalDivider} />

                                <View style={styles.totalBlock}>
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>Subtotal</Text>
                                        <Text style={styles.totalVal}>{formatCurrency(selectedSale?.total / 1.19)}</Text>
                                    </View>
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>IVA (19%)</Text>
                                        <Text style={styles.totalVal}>{formatCurrency(selectedSale?.total - (selectedSale?.total / 1.19))}</Text>
                                    </View>
                                    <View style={[styles.totalRow, styles.finalRow]}>
                                        <Text style={styles.finalLabel}>TOTAL</Text>
                                        <Text style={styles.finalVal}>{formatCurrency(selectedSale?.total)}</Text>
                                    </View>
                                </View>

                                {saleDetail.pagos && saleDetail.pagos.length > 0 && (
                                    <View style={styles.paymentInfo}>
                                        <Ionicons name="card-outline" size={14} color={brandColors.textMuted} />
                                        <Text style={styles.paymentText}>Pagado con {saleDetail.pagos[0].metodoPago}</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <Text style={styles.errorText}>No se pudo cargar el detalle.</Text>
                        )}
                    </View>

                    <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)}>
                        <Text style={styles.closeBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                </Modal>

                <Modal
                    visible={showStockModal}
                    onDismiss={() => !savingStock && setShowStockModal(false)}
                    contentContainerStyle={styles.modalSmall}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Ingreso Rápido</Text>
                        <Text style={styles.modalSubtitle}>{stockItem?.nombreProducto}</Text>
                        <Text style={styles.branchBadge}>{stockItem?.branchName}</Text>
                    </View>
                    <View style={styles.modalBodySmall}>
                        <Text style={styles.inputLabel}>Cantidad a ingresar:</Text>
                        <TextInput
                            style={styles.bigInput}
                            value={stockQty}
                            onChangeText={setStockQty}
                            keyboardType="numeric"
                            autoFocus
                            selectTextOnFocus
                        />
                        
                        <TouchableOpacity 
                            style={[styles.confirmBtn, savingStock && { opacity: 0.7 }]} 
                            onPress={handleQuickInbound}
                            disabled={savingStock}
                        >
                            {savingStock ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.confirmBtnText}>REGISTRAR STOCK</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.cancelBtn} 
                            onPress={() => setShowStockModal(false)}
                            disabled={savingStock}
                        >
                            <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            </Portal>
        </Screen>
    );
}

function StatCard({ label, value, caption, icon, color }) {
    return (
        <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: color + '15', marginRight: 16 }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text 
                    style={styles.statValue} 
                    numberOfLines={1} 
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                >
                    {value}
                </Text>
                <Text style={styles.statCaption}>{caption}</Text>
            </View>
        </Card>
    );
}

function SplitChannelCard({ title, subtitle, icon, data, tone = 'caja' }) {
    const toneStyles = getChannelToneStyles(tone);

    return (
        <Card style={styles.splitCard}>
            <View style={styles.splitCardHeader}>
                <View style={styles.splitTitleBlock}>
                    <Text style={[styles.splitEyebrow, { color: toneStyles.accent }]}>
                        {tone === 'despacho' ? 'DESPACHO' : 'CAJA'}
                    </Text>
                    <Text style={styles.splitTitle}>{title}</Text>
                    <Text style={styles.splitSubtitle}>{subtitle}</Text>
                </View>
                <View style={[styles.splitIconWrap, { backgroundColor: toneStyles.soft }]}>
                    <Ionicons name={icon} size={20} color={toneStyles.accent} />
                </View>
            </View>

            <View style={styles.splitMetricsRow}>
                <MiniMetric label="SII" value={data?.ventasSII} accent={toneStyles.accent} />
                <MiniMetric label="Internas" value={data?.ventasInternas} accent={toneStyles.accent} />
                <MiniMetric label="Ganancia" value={data?.gananciaNeta} accent={brandColors.success} />
            </View>
        </Card>
    );
}

function MiniMetric({ label, value, accent }) {
    return (
        <View style={styles.miniMetric}>
            <Text style={styles.miniMetricLabel}>{label}</Text>
            <Text style={[styles.miniMetricValue, { color: accent || brandColors.text }]}>
                {formatCurrency(Number(value || 0))}
            </Text>
        </View>
    );
}

function BranchMetricCard({ label, value, tone = 'caja' }) {
    const toneStyles = getChannelToneStyles(tone);

    return (
        <View style={[styles.branchMetricCard, { backgroundColor: toneStyles.soft }]}>
            <Text style={styles.branchMetricLabel}>{label}</Text>
            <Text style={[styles.branchMetricValue, { color: toneStyles.accent }]}>
                {formatCurrency(Number(value || 0))}
            </Text>
        </View>
    );
}

function getChannelToneStyles(tone) {
    if (tone === 'despacho') {
        return {
            accent: '#0284C7',
            soft: '#E0F2FE'
        };
    }

    if (tone === 'gain') {
        return {
            accent: brandColors.success,
            soft: '#DCFCE7'
        };
    }

    return {
        accent: brandColors.accent,
        soft: brandColors.accentSoft
    };
}

function CriticalRow({ item, onAddStock }) {
    return (
        <TouchableOpacity style={styles.row} onPress={onAddStock} activeOpacity={0.7}>
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.nombreProducto}</Text>
                <Text style={styles.rowSubtitle}>{item.branchName} • {item.codigoBarras || 'S/C'}</Text>
            </View>
            <Badge
                label={`${item.esPesable ? item.stock.toFixed(3) : Math.round(item.stock)} ${item.esPesable ? 'Kg' : 'un.'}`}
                type="danger"
            />
            <Ionicons name="chevron-forward" size={16} color={brandColors.outline} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
    );
}

function RecentSaleRow({ sale, onPress }) {
    const total = Number(sale.total || sale.monto_total || 0);
    const dateStr = (sale.fecha_venta || sale.fechaVenta || sale.created_at || '').slice(11, 16);

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Ticket {sale.id_venta || sale.folio || '#'}</Text>
                <Text style={styles.rowSubtitle}>{dateStr} • {sale.medio_pago || 'Efectivo'}</Text>
            </View>
            <View style={styles.rowValueContainer}>
                <Text style={styles.rowValue}>{formatCurrency(total)}</Text>
                <Text style={styles.rowStatus}>COMPLETADA</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
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
    grid: {
        marginTop: 10,
        gap: 12
    },
    statCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: brandColors.textMuted,
        textTransform: 'uppercase'
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text
    },
    statCaption: {
        fontSize: 10,
        color: brandColors.textMuted,
        marginTop: 2
    },
    statIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    section: {
        marginTop: 24
    },
    splitCard: {
        padding: 16,
        marginBottom: 12
    },
    splitCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14
    },
    splitTitleBlock: {
        flex: 1,
        marginRight: 12
    },
    splitEyebrow: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 6
    },
    splitTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text
    },
    splitSubtitle: {
        marginTop: 3,
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    splitIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    splitMetricsRow: {
        flexDirection: 'row',
        gap: 10
    },
    miniMetric: {
        flex: 1,
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12
    },
    miniMetricLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: brandColors.textMuted,
        textTransform: 'uppercase'
    },
    miniMetricValue: {
        fontSize: 14,
        fontWeight: '900',
        marginTop: 6
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.outline,
    },
    rowInfo: {
        flex: 1,
        marginRight: 10
    },
    rowTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: brandColors.text
    },
    rowSubtitle: {
        fontSize: 11,
        color: brandColors.textMuted,
        marginTop: 1
    },
    rowValueContainer: {
        alignItems: 'flex-end'
    },
    rowValue: {
        fontSize: 14,
        fontWeight: '900',
        color: brandColors.text
    },
    rowStatus: {
        fontSize: 8,
        fontWeight: '900',
        color: brandColors.success,
        marginTop: 2
    },
    emptyText: {
        textAlign: 'center',
        color: brandColors.textMuted,
        fontSize: 13,
        paddingVertical: 30,
        fontStyle: 'italic'
    },
    branchContainer: {
        padding: 0,
        overflow: 'hidden'
    },
    branchSplitBlock: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.background
    },
    branchSplitHeader: {
        marginBottom: 12
    },
    branchSplitGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    branchMetricCard: {
        width: '48%',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12
    },
    branchMetricLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: brandColors.textMuted,
        textTransform: 'uppercase'
    },
    branchMetricValue: {
        fontSize: 14,
        fontWeight: '900',
        marginTop: 6
    },
    branchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.background
    },
    branchInfo: {
        flex: 1
    },
    branchName: {
        fontSize: 14,
        fontWeight: '800',
        color: brandColors.text
    },
    branchCount: {
        fontSize: 10,
        fontWeight: '600',
        color: brandColors.textMuted,
        marginTop: 2
    },
    branchTotal: {
        fontSize: 15,
        fontWeight: '900',
        color: brandColors.accent
    },
    modalScroll: {
        backgroundColor: brandColors.surface,
        margin: 20,
        borderRadius: 28,
        paddingBottom: 20,
        overflow: 'hidden'
    },
    modalHeader: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 20,
        backgroundColor: brandColors.backgroundAlt
    },
    modalHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: brandColors.outline,
        marginBottom: 16
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: brandColors.text
    },
    modalSubtitle: {
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '700',
        marginTop: 2
    },
    modalBody: {
        padding: 20,
        minHeight: 200
    },
    modalLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40
    },
    modalLoaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '700',
        fontSize: 12
    },
    itemsList: {
        gap: 14
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    itemInfo: {
        flex: 1,
        marginRight: 10
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: brandColors.text
    },
    itemQty: {
        fontSize: 11,
        color: brandColors.textMuted,
        marginTop: 2
    },
    itemSubtotal: {
        fontSize: 14,
        fontWeight: '900',
        color: brandColors.text
    },
    modalDivider: {
        marginVertical: 20,
        backgroundColor: brandColors.outline
    },
    totalBlock: {
        gap: 8
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    totalLabel: {
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    totalVal: {
        fontSize: 13,
        color: brandColors.text,
        fontWeight: '700'
    },
    finalRow: {
        marginTop: 4,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: brandColors.outline
    },
    finalLabel: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text
    },
    finalVal: {
        fontSize: 20,
        fontWeight: '900',
        color: brandColors.accent
    },
    paymentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 20,
        padding: 10,
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    paymentText: {
        fontSize: 11,
        fontWeight: '800',
        color: brandColors.textMuted,
        textTransform: 'uppercase'
    },
    errorText: {
        textAlign: 'center',
        color: brandColors.danger,
        fontWeight: '700',
        paddingVertical: 40
    },
    closeBtn: {
        marginHorizontal: 20,
        padding: 16,
        borderRadius: 16,
        backgroundColor: brandColors.shell,
        alignItems: 'center'
    },
    closeBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14,
        textTransform: 'uppercase'
    },
    modalSmall: {
        backgroundColor: brandColors.surface,
        margin: 40,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10
    },
    modalBodySmall: {
        padding: 24,
        alignItems: 'center'
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: brandColors.textMuted,
        marginBottom: 12
    },
    bigInput: {
        width: '100%',
        height: 60,
        backgroundColor: brandColors.background,
        borderRadius: 16,
        fontSize: 28,
        fontWeight: '900',
        color: brandColors.text,
        textAlign: 'center',
        borderWidth: 2,
        borderColor: brandColors.outline,
        marginBottom: 24
    },
    confirmBtn: {
        width: '100%',
        height: 54,
        backgroundColor: brandColors.accent,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: brandColors.accent,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    confirmBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 15
    },
    cancelBtn: {
        padding: 12
    },
    cancelBtnText: {
        color: brandColors.textMuted,
        fontWeight: '700',
        fontSize: 14
    },
    branchBadge: {
        fontSize: 10,
        fontWeight: '900',
        color: brandColors.accent,
        backgroundColor: brandColors.accentSoft,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 6,
        textTransform: 'uppercase'
    }
});
