import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { Card, Screen, SectionHeader, Badge } from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency } from '../utils/format';

export default function MonitoringScreen({ token }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        salesToday: 0,
        profitToday: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        salesCount: 0
    });
    const [recentSales, setRecentSales] = useState([]);
    const [criticalItems, setCriticalItems] = useState([]);

    const fetchData = async () => {
        try {
            const [prodRes, salesRes, branchRes] = await Promise.all([
                apiRequest({ endpoint: '/productos?limit=10000', token }),
                apiRequest({ endpoint: '/ventas', token }),
                apiRequest({ endpoint: '/sucursales', token })
            ]);

            const products = Array.isArray(prodRes?.data) ? prodRes.data : [];
            const allSales = Array.isArray(salesRes?.data) ? salesRes.data : (Array.isArray(salesRes) ? salesRes : []);
            const branches = Array.isArray(branchRes?.data) ? branchRes.data : [];

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
                            branchName: branch.nombreSucursal,
                            stock
                        });
                    }
                });
            });

            setStats({
                salesToday: todaySales,
                profitToday: todayProfit,
                inventoryValue: totalValue,
                lowStockCount: tempCritical.length,
                salesCount: todayCount,
                salesByBranch // New field
            });

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
                        label="Ventas Hoy"
                        value={formatCurrency(stats.salesToday)}
                        caption={`${stats.salesCount} tickets`}
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

                {stats.salesByBranch && stats.salesByBranch.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="Ventas por Sucursal" compact />
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
                )}

                <View style={styles.section}>
                    <SectionHeader title="Productos Críticos" compact />
                    {criticalItems.length > 0 ? (
                        criticalItems.map((item, idx) => (
                            <CriticalRow key={idx} item={item} />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No hay alertas de stock crítico.</Text>
                    )}
                </View>

                <View style={[styles.section, { marginBottom: 40 }]}>
                    <SectionHeader title="Últimas Ventas" compact />
                    {recentSales.length > 0 ? (
                        recentSales.map((sale, idx) => (
                            <RecentSaleRow key={idx} sale={sale} />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No se registran ventas recientes.</Text>
                    )}
                </View>
            </ScrollView>
        </Screen>
    );
}

function StatCard({ label, value, caption, icon, color }) {
    return (
        <Card style={styles.statCard}>
            <View style={styles.statHeader}>
                <Text style={styles.statLabel}>{label}</Text>
                <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
                    <Ionicons name={icon} size={18} color={color} />
                </View>
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statCaption}>{caption}</Text>
        </Card>
    );
}

function CriticalRow({ item }) {
    return (
        <View style={styles.row}>
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.nombreProducto}</Text>
                <Text style={styles.rowSubtitle}>{item.branchName} • {item.codigoBarras || 'S/C'}</Text>
            </View>
            <Badge
                label={`${item.esPesable ? item.stock.toFixed(3) : Math.round(item.stock)} ${item.esPesable ? 'Kg' : 'un.'}`}
                type="danger"
            />
        </View>
    );
}

function RecentSaleRow({ sale }) {
    const total = Number(sale.total || sale.monto_total || 0);
    const dateStr = (sale.fecha_venta || sale.fechaVenta || sale.created_at || '').slice(11, 16);

    return (
        <View style={styles.row}>
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Ticket {sale.id_venta || sale.folio || '#'}</Text>
                <Text style={styles.rowSubtitle}>{dateStr} • {sale.medio_pago || 'Efectivo'}</Text>
            </View>
            <View style={styles.rowValueContainer}>
                <Text style={styles.rowValue}>{formatCurrency(total)}</Text>
                <Text style={styles.rowStatus}>COMPLETADA</Text>
            </View>
        </View>
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
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
        marginTop: 10
    },
    statCard: {
        width: '46.5%', // Slightly less than 50% to account for margins
        margin: 6,
        padding: 14,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
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
    }
});
