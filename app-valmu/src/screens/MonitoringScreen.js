import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Modal, Portal, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { Card, Screen, SectionHeader } from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency } from '../utils/format';

const APP_TIMEZONE = 'America/Santiago';

export default function MonitoringScreen({ token, navigateTo }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        salesToday: 0,
        profitToday: 0,
        inventoryValue: 0,
        salesCount: 0
    });
    const [salesSplit, setSalesSplit] = useState({
        caja: { ventasSII: 0, ventasInternas: 0, gananciaNeta: 0 },
        despacho: { ventasSII: 0, ventasInternas: 0, gananciaNeta: 0 }
    });
    const [branchSplitRows, setBranchSplitRows] = useState([]);
    const [shiftPaymentRows, setShiftPaymentRows] = useState([]);
    const [recentSales, setRecentSales] = useState([]);

    // Modal para detalle de venta
    const [showModal, setShowModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleDetail, setSaleDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const fetchData = async () => {
        try {
            const [prodRes, salesRes, branchRes, kpisRes, branchSplitRes] = await Promise.all([
                apiRequest({ endpoint: '/productos?limit=10000', token }),
                apiRequest({ endpoint: '/ventas', token }),
                apiRequest({ endpoint: '/sucursales', token }),
                apiRequest({ endpoint: '/reportes/kpis-diarios', token }),
                apiRequest({ endpoint: '/reportes/ventas-por-sucursal', token })
            ]);

            const products = unwrapArrayResponse(prodRes);
            const allSales = unwrapArrayResponse(salesRes);
            const branches = unwrapArrayResponse(branchRes);
            const kpiData = kpisRes?.ok ? unwrapObjectResponse(kpisRes) : null;
            const branchSplitData = unwrapArrayResponse(branchSplitRes);

            const hoyStr = getChileDateKey(new Date());

            const productMap = {};
            products.forEach(p => {
                const cost = resolveProductCost(p);
                const productId = resolveProductId(p);
                if (productId) productMap[productId] = { costo: cost };
                resolveProductLookupKeys(p).forEach((key) => {
                    productMap[key] = { costo: cost };
                });
            });
            const salesForCalculations = await enrichTodaySalesForGain(allSales, productMap, hoyStr, token);

            // Stats hoy
            let todaySales = 0;
            let todayProfit = 0;
            let todayCount = 0;
            const branchSalesMap = {}; // id_sucursal -> { total: 0, count: 0, name: '' }
            const branchSplitMap = {};
            const localSplit = {
                caja: { ventasSII: 0, ventasInternas: 0, gananciaNeta: 0 },
                despacho: { ventasSII: 0, ventasInternas: 0, gananciaNeta: 0 }
            };

            branches.forEach(b => {
                const branchId = resolveBranchId(b);
                if (!branchId) return;
                branchSalesMap[branchId] = { total: 0, count: 0, name: resolveBranchName(b) };
                branchSplitMap[branchId] = createEmptyBranchSplit(b);
            });

            salesForCalculations.forEach(s => {
                const rawDate = (s.fecha_venta || s.fechaVenta || s.fecha || s.created_at || '');
                if (!rawDate) return;

                const dateObj = parseSaleDateValue(rawDate);
                if (!dateObj) return;

                if (getChileDateKey(dateObj) === hoyStr && isSaleReportable(s)) {
                    const total = resolveSaleTotal(s);
                    todaySales += total;
                    todayCount++;
                    const gain = resolveSaleGain(s, total, productMap);
                    todayProfit += gain;

                    const channel = resolveSaleOrigin(s) === 'DESPACHO' ? 'despacho' : 'caja';
                    const fiscal = isFiscalSale(s);
                    if (fiscal) {
                        localSplit[channel].ventasSII += total;
                    } else {
                        localSplit[channel].ventasInternas += total;
                    }
                    localSplit[channel].gananciaNeta += gain;

                    const sid = s.id_sucursal || s.branchId;
                    if (sid && !branchSplitMap[sid]) {
                        branchSplitMap[sid] = createEmptyBranchSplit({
                            id_sucursal: sid,
                            nombreSucursal: s.nombreSucursal || 'Desconocida'
                        });
                    }
                    if (sid && branchSplitMap[sid]) {
                        addSaleToBranchSplit(branchSplitMap[sid], { channel, fiscal, total, gain });
                    }
                    if (sid && branchSalesMap[sid]) {
                        branchSalesMap[sid].total += total;
                        branchSalesMap[sid].count += 1;
                    }
                }
            });

            // Convert to array for easier rendering
            const salesByBranch = Object.values(branchSalesMap).filter(b => b.total > 0 || b.count > 0);
            const kpiTotal = parseMoney(kpiData?.ventasSII) + parseMoney(kpiData?.ventasInternas);
            const kpiProfit = parseMoney(kpiData?.gananciaNeta);
            const kpiHasUsefulTotals = kpiData && (kpiTotal > 0 || kpiProfit > 0 || todayCount === 0);
            const resolvedSplit = resolveSalesSplit(kpiData, localSplit, todayCount);
            const splitSales = getSplitSalesTotal(resolvedSplit);
            const splitProfit = getSplitProfitTotal(resolvedSplit);
            const resolvedProfit = Math.max(splitProfit, kpiProfit, todayProfit);
            const totalGains = getSplitProfitTotal(resolvedSplit) || resolvedProfit;
            const localBranchSplitRows = Object.values(branchSplitMap).filter(hasBranchSplitAmounts);

            // Valorizacion de inventario
            let totalValue = 0;

            const inventoryPromises = branches.map(b =>
                apiRequest({ endpoint: `/productos/inventario?id_sucursal=${resolveBranchId(b)}`, token })
            );
            const invResults = await Promise.all(inventoryPromises);

            invResults.forEach((res, index) => {
                const branch = branches[index];
                const stockItems = Array.isArray(res?.data) ? res.data : [];

                stockItems.forEach(item => {
                    const stock = parseFloat(item.stockActual || item.cantidad || item.stock || 0);
                    const itemCosto = resolveProductCost(item) || lookupProductCost(productMap, item);

                    totalValue += (stock * itemCosto);
                });
            });

            setStats({
                salesToday: kpiHasUsefulTotals ? (splitSales || kpiTotal) : todaySales,
                profitToday: totalGains,
                inventoryValue: totalValue,
                salesCount: todayCount,
                salesByBranch // New field
            });
            setSalesSplit(resolvedSplit);
            setBranchSplitRows(resolveBranchSplitRows(branchSplitData, localBranchSplitRows, todayCount));
            setShiftPaymentRows(buildShiftPaymentRowsFromSales(salesForCalculations, hoyStr));

            setRecentSales(allSales.slice(0, 10));

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
            const res = await apiRequest({ endpoint: `/ventas/${saleId}`, token });
            
            const detailData = res?.data?.data || res?.data;
            if (res.ok && detailData) {
                // Adaptamos tu estructura { cabecera, productos, pagos } ?? lo que la vista espera
                setSaleDetail({
                    items: detailData.productos || [],
                    pagos: detailData.pagos || []
                });
            }
        } catch (error) {
            console.error('Error loading sale detail:', error);
        } finally {
            setLoadingDetail(false);
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
                        label="Ganancias"
                        value={formatCurrency(stats.profitToday)}
                        caption="Caja + despacho"
                        icon="trending-up-outline"
                        color={brandColors.success}
                    />
                    <StatCard
                        label="Inversion Stock"
                        value={formatCurrency(stats.inventoryValue)}
                        caption="Valor de inventario"
                        icon="cube-outline"
                        color={brandColors.shell}
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

                {shiftPaymentRows.length > 0 ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title="Ventas por turno"
                            subtitle="Efectivo, transferencia y tarjeta separados"
                            compact
                        />
                        <Card style={styles.branchContainer}>
                            {shiftPaymentRows.map((turno, idx) => (
                                <View key={turno.id_turno || idx} style={[styles.branchSplitBlock, idx === shiftPaymentRows.length - 1 && { borderBottomWidth: 0 }]}>
                                    <View style={styles.branchSplitHeader}>
                                        <View style={styles.branchInfo}>
                                            <Text style={styles.branchName}>
                                                {turno.nombre_usuario || `Turno ${turno.id_turno}`}
                                            </Text>
                                            <Text style={styles.branchCount}>
                                                {turno.nombre_sucursal || 'Sucursal'} - {turno.estado || 'Sin estado'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.branchSplitGrid}>
                                        <BranchMetricCard label="Efectivo" value={turno.efectivo} tone="cash" />
                                        <BranchMetricCard label="Transferencia" value={turno.transferencia} tone="transfer" />
                                        <BranchMetricCard label="Tarjeta" value={turno.tarjeta} tone="card" />
                                        <BranchMetricCard label="Total turno" value={turno.total} tone="gain" />
                                    </View>
                                </View>
                            ))}
                        </Card>
                    </View>
                ) : null}

                <View style={[styles.section, { marginBottom: 120 }]}>
                    <SectionHeader title="Ultimas Ventas" compact />
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

            </Portal>
        </Screen>
    );
}

function StatCard({ label, value, caption, icon, color, onPress }) {
    const content = (
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

    if (typeof onPress === 'function') {
        return (
            <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
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

function getSplitSalesTotal(split = {}) {
    return parseMoney(split?.caja?.ventasSII)
        + parseMoney(split?.caja?.ventasInternas)
        + parseMoney(split?.despacho?.ventasSII)
        + parseMoney(split?.despacho?.ventasInternas);
}

function getSplitProfitTotal(split = {}) {
    return parseMoney(split?.caja?.gananciaNeta)
        + parseMoney(split?.despacho?.gananciaNeta);
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
    if (tone === 'cash') {
        return {
            accent: '#16A34A',
            soft: '#DCFCE7'
        };
    }

    if (tone === 'transfer') {
        return {
            accent: '#0284C7',
            soft: '#E0F2FE'
        };
    }

    if (tone === 'card') {
        return {
            accent: '#7C3AED',
            soft: '#EDE9FE'
        };
    }

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

function unwrapArrayResponse(response) {
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
}

function unwrapObjectResponse(response) {
    if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
    if (response?.data && typeof response.data === 'object') return response.data;
    return null;
}

function resolveBranchId(branch) {
    return branch?.id_sucursal || branch?.id || branch?.branchId;
}

function resolveBranchName(branch) {
    return branch?.nombreSucursal || branch?.nombre_sucursal || branch?.nombre || branch?.name || 'Desconocida';
}

function normalizeShiftPaymentRow(row = {}) {
    const efectivo = parseMoney(row.efectivo ?? row.total_efectivo);
    const transferencia = parseMoney(row.transferencia ?? row.total_transferencia);
    const tarjeta = parseMoney(row.tarjeta ?? row.total_tarjeta);
    const total = parseMoney(row.total) || efectivo + transferencia + tarjeta;

    return {
        ...row,
        id_turno: row.id_turno || row.id,
        nombre_usuario: row.nombre_usuario || row.username || row.cajero,
        nombre_sucursal: row.nombre_sucursal || row.nombreSucursal || row.sucursal,
        efectivo,
        transferencia,
        tarjeta,
        total
    };
}

function hasShiftPaymentAmounts(row = {}) {
    return parseMoney(row.efectivo) + parseMoney(row.transferencia) + parseMoney(row.tarjeta) + parseMoney(row.total) > 0;
}

function buildShiftPaymentRowsFromSales(sales = [], todayKey = getChileDateKey(new Date())) {
    const rowsByShift = new Map();

    sales.forEach((sale) => {
        if (!isSaleReportable(sale)) return;

        const rawDate = sale.fecha_venta || sale.fechaVenta || sale.fecha || sale.created_at;
        const dateObj = parseSaleDateValue(rawDate);
        if (!dateObj || getChileDateKey(dateObj) !== todayKey) return;

        const shiftId = sale.id_turno || sale.id_cajaTurno || sale.idCajaTurno || sale.turno || sale.id_usuario || 'sin-turno';
        const key = String(shiftId);
        if (!rowsByShift.has(key)) {
            rowsByShift.set(key, {
                id_turno: shiftId,
                nombre_usuario: sale.vendedor || sale.nombre_usuario || sale.username || 'Turno actual',
                nombre_sucursal: sale.nombreSucursal || sale.sucursal || sale.nombre_sucursal || 'Sucursal',
                estado: 'Abierto',
                efectivo: 0,
                transferencia: 0,
                tarjeta: 0,
                total: 0
            });
        }

        const row = rowsByShift.get(key);
        const total = resolveSaleTotal(sale);
        const payments = resolveSalePaymentBreakdown(sale, total);

        row.efectivo += payments.efectivo;
        row.transferencia += payments.transferencia;
        row.tarjeta += payments.tarjeta;

        row.total += total;
    });

    return Array.from(rowsByShift.values()).filter(hasShiftPaymentAmounts);
}

function resolveSalePaymentBreakdown(sale = {}, total = 0) {
    const direct = {
        efectivo: parseMoney(sale.pago_efectivo ?? sale.pagoEfectivo ?? sale.efectivo ?? sale.total_efectivo),
        transferencia: parseMoney(sale.pago_transferencia ?? sale.pagoTransferencia ?? sale.transferencia ?? sale.total_transferencia),
        tarjeta: parseMoney(sale.pago_tarjeta ?? sale.pagoTarjeta ?? sale.tarjeta ?? sale.total_tarjeta)
    };

    if (direct.efectivo + direct.transferencia + direct.tarjeta > 0) {
        return direct;
    }

    const pagos = extractSalePayments(sale);
    if (pagos.length > 0) {
        return pagos.reduce((acc, payment) => {
            const amount = parseMoney(payment.monto_pagado ?? payment.montoPago ?? payment.monto ?? payment.amount);
            const method = normalizePaymentMethodText(payment);

            if (method.includes('transfe')) {
                acc.transferencia += amount;
            } else if (method.includes('tarjeta') || method.includes('debito') || method.includes('credito')) {
                acc.tarjeta += amount;
            } else {
                acc.efectivo += amount;
            }

            return acc;
        }, { efectivo: 0, transferencia: 0, tarjeta: 0 });
    }

    const method = normalizePaymentMethodText(sale);
    if (method.includes('transfe')) return { efectivo: 0, transferencia: total, tarjeta: 0 };
    if (method.includes('tarjeta') || method.includes('debito') || method.includes('credito')) return { efectivo: 0, transferencia: 0, tarjeta: total };
    return { efectivo: total, transferencia: 0, tarjeta: 0 };
}

function extractSalePayments(sale = {}) {
    const candidates = [
        sale.pagos,
        sale.payments,
        sale.pagos_mixtos,
        sale.paymentDetails
    ];

    return candidates.find(Array.isArray) || [];
}

function hasSalePaymentAmounts(sale = {}) {
    const directTotal = parseMoney(sale.pago_efectivo ?? sale.pagoEfectivo ?? sale.efectivo ?? sale.total_efectivo)
        + parseMoney(sale.pago_transferencia ?? sale.pagoTransferencia ?? sale.transferencia ?? sale.total_transferencia)
        + parseMoney(sale.pago_tarjeta ?? sale.pagoTarjeta ?? sale.tarjeta ?? sale.total_tarjeta);

    if (directTotal > 0) return true;

    return extractSalePayments(sale).some((payment) =>
        parseMoney(payment.monto_pagado ?? payment.montoPago ?? payment.monto ?? payment.amount) > 0
    );
}

function normalizePaymentMethodText(sale = {}) {
    return String(
        sale.medio_pago
        || sale.medioPago
        || sale.metodo_pago
        || sale.metodoPago
        || sale.metodo
        || sale.nombre
        || sale.method
        || sale.payment_method
        || sale.forma_pago
        || sale.formaPago
        || 'efectivo'
    ).toLowerCase();
}

function resolveSalesSplit(kpiData, localSplit, todayCount) {
    const kpiSplit = {
        caja: {
            ventasSII: parseMoney(kpiData?.caja?.ventasSII),
            ventasInternas: parseMoney(kpiData?.caja?.ventasInternas),
            gananciaNeta: parseMoney(kpiData?.caja?.gananciaNeta)
        },
        despacho: {
            ventasSII: parseMoney(kpiData?.despacho?.ventasSII),
            ventasInternas: parseMoney(kpiData?.despacho?.ventasInternas),
            gananciaNeta: parseMoney(kpiData?.despacho?.gananciaNeta)
        }
    };

    const kpiTotal = kpiSplit.caja.ventasSII
        + kpiSplit.caja.ventasInternas
        + kpiSplit.despacho.ventasSII
        + kpiSplit.despacho.ventasInternas
        + kpiSplit.caja.gananciaNeta
        + kpiSplit.despacho.gananciaNeta;

    if (!kpiData || (kpiTotal <= 0 && todayCount > 0)) {
        return localSplit;
    }

    return {
        caja: mergeSplitChannel(kpiSplit.caja, localSplit.caja),
        despacho: mergeSplitChannel(kpiSplit.despacho, localSplit.despacho)
    };
}

function mergeSplitChannel(apiChannel = {}, localChannel = {}) {
    const apiSalesSII = parseMoney(apiChannel.ventasSII);
    const apiSalesInternas = parseMoney(apiChannel.ventasInternas);
    const localSalesSII = parseMoney(localChannel.ventasSII);
    const localSalesInternas = parseMoney(localChannel.ventasInternas);

    return {
        ventasSII: apiSalesSII || localSalesSII,
        ventasInternas: apiSalesInternas || localSalesInternas,
        gananciaNeta: Math.max(
            parseMoney(apiChannel.gananciaNeta),
            parseMoney(localChannel.gananciaNeta)
        )
    };
}

function resolveBranchSplitRows(apiRows, localRows, todayCount) {
    const normalizedApiRows = Array.isArray(apiRows) ? apiRows.map(normalizeBranchSplitRow) : [];
    const apiHasUsefulAmounts = normalizedApiRows.some(hasBranchSplitAmounts);
    return apiHasUsefulAmounts || todayCount === 0 ? normalizedApiRows : localRows;
}

function createEmptyBranchSplit(branch) {
    return {
        id_sucursal: resolveBranchId(branch),
        nombreSucursal: resolveBranchName(branch),
        ventasSIICaja: 0,
        ventasInternasCaja: 0,
        gananciaCaja: 0,
        ventasSIIDespacho: 0,
        ventasInternasDespacho: 0,
        gananciaDespacho: 0
    };
}

function addSaleToBranchSplit(branch, { channel, fiscal, total, gain }) {
    if (channel === 'despacho') {
        if (fiscal) {
            branch.ventasSIIDespacho += total;
        } else {
            branch.ventasInternasDespacho += total;
        }
        branch.gananciaDespacho += gain;
        return;
    }

    if (fiscal) {
        branch.ventasSIICaja += total;
    } else {
        branch.ventasInternasCaja += total;
    }
    branch.gananciaCaja += gain;
}

function normalizeBranchSplitRow(row) {
    return {
        ...row,
        ventasSIICaja: parseMoney(row.ventasSIICaja ?? row.ventas_sii_caja),
        ventasInternasCaja: parseMoney(row.ventasInternasCaja ?? row.ventas_internas_caja),
        gananciaCaja: parseMoney(row.gananciaCaja ?? row.ganancia_caja),
        ventasSIIDespacho: parseMoney(row.ventasSIIDespacho ?? row.ventas_sii_despacho),
        ventasInternasDespacho: parseMoney(row.ventasInternasDespacho ?? row.ventas_internas_despacho),
        gananciaDespacho: parseMoney(row.gananciaDespacho ?? row.ganancia_despacho)
    };
}

function hasBranchSplitAmounts(row) {
    return parseMoney(row.ventasSIICaja)
        + parseMoney(row.ventasInternasCaja)
        + parseMoney(row.gananciaCaja)
        + parseMoney(row.ventasSIIDespacho)
        + parseMoney(row.ventasInternasDespacho)
        + parseMoney(row.gananciaDespacho) > 0;
}

function isSaleReportable(sale) {
    const status = String(sale.estado || sale.status || '').toUpperCase();
    return status !== 'ANULADA' && status !== 'CANCELADA';
}

function resolveSaleOrigin(sale) {
    const explicitOrigin = String(sale.origenVenta || sale.origen_venta || '').toUpperCase().trim();
    if (explicitOrigin) return explicitOrigin;

    const status = String(sale.estado || sale.status || '').toUpperCase();
    if (status === 'EN_RUTA' || status === 'ENTREGADO') return 'DESPACHO';

    return 'CAJA';
}

function isFiscalSale(sale) {
    const value = sale.esFiscal ?? sale.es_fiscal ?? sale.fiscal;
    return value === true || Number(value) === 1 || String(value).toLowerCase() === 'true';
}

function resolveSaleTotal(sale) {
    return parseMoney(sale.total ?? sale.monto_total ?? sale.monto ?? sale.totalVenta ?? sale.total_venta ?? 0);
}

async function enrichTodaySalesForGain(sales, productMap, todayKey, token) {
    return Promise.all((sales || []).map(async (sale) => {
        if (!isSaleReportable(sale)) return sale;

        const rawDate = sale.fecha_venta || sale.fechaVenta || sale.fecha || sale.created_at;
        const dateObj = parseSaleDateValue(rawDate);
        if (!dateObj || getChileDateKey(dateObj) !== todayKey) return sale;

        const total = resolveSaleTotal(sale);
        const hasGain = resolveSaleGain(sale, total, productMap) !== 0;
        const hasItems = extractSaleItems(sale).length > 0;
        const hasPaymentAmounts = hasSalePaymentAmounts(sale);

        if (hasGain && hasItems && hasPaymentAmounts) {
            return sale;
        }

        const saleId = sale.id_venta || sale.id || sale.folio;
        if (!saleId) return sale;

        try {
            const res = await apiRequest({ endpoint: `/ventas/${saleId}`, token });
            if (!res?.ok) return sale;

            const detail = res?.data?.data || res?.data || {};
            const detailItems = detail.productos || detail.items || detail.detalle || detail.detalle_productos || [];

            return {
                ...sale,
                productos: Array.isArray(detailItems) ? detailItems : sale.productos,
                pagos: detail.pagos || sale.pagos
            };
        } catch (error) {
            return sale;
        }
    }));
}

function resolveSaleGain(sale, total, productMap = {}) {
    const explicitGain = parseMoney(sale.gananciaNeta ?? sale.ganancia_neta ?? sale.utilidad ?? sale.profit ?? 0);
    if (explicitGain) return explicitGain;

    const cost = parseMoney(sale.costo_total ?? sale.costoTotal ?? 0);
    if (cost) return total - cost;

    const itemGain = calculateItemsGain(extractSaleItems(sale), productMap);
    return itemGain || 0;
}

function calculateItemsGain(items, productMap = {}) {
    if (!Array.isArray(items) || items.length === 0) return 0;

    return items.reduce((sum, item) => {
        const quantity = resolveItemQuantity(item);
        if (quantity <= 0) return sum;

        const unitCost = resolveProductCost(item) || lookupProductCost(productMap, item);
        const unitPrice = resolveItemUnitPrice(item);
        const subtotal = resolveItemSubtotal(item, unitPrice, quantity);

        if (!subtotal || !unitCost) return sum;
        return sum + (subtotal - (unitCost * quantity));
    }, 0);
}

function extractSaleItems(sale = {}) {
    const candidates = [
        sale.productos,
        sale.items,
        sale.detalle,
        sale.detalle_productos,
        sale.carrito
    ];

    return candidates.find(Array.isArray) || [];
}

function resolveProductId(product = {}) {
    return product.id_producto
        || product.producto_id
        || product.idProducto
        || product.id
        || product.productId
        || product.idProduct
        || product.id_producto_fk;
}

function resolveProductLookupKeys(product = {}) {
    const keys = [];
    const productId = resolveProductId(product);
    const barcode = product.codigoBarras || product.codigo_barra_externo || product.codigo_barra || product.barcode;
    const name = product.nombreProducto || product.nombre || product.name;

    if (productId) keys.push(`id:${productId}`);
    if (barcode) keys.push(`barcode:${String(barcode).trim().toLowerCase()}`);
    if (name) keys.push(`name:${String(name).trim().toLowerCase()}`);

    return keys;
}

function lookupProductCost(productMap = {}, product = {}) {
    for (const key of resolveProductLookupKeys(product)) {
        const cost = productMap[key]?.costo;
        if (cost) return cost;
    }

    const productId = resolveProductId(product);
    return productId ? (productMap[productId]?.costo || 0) : 0;
}

function resolveProductCost(product = {}) {
    return parseMoney(
        product.precioCostoVenta
        ?? product.precio_costo_venta
        ?? product.precioCosto
        ?? product.precio_costo
        ?? product.costoProducto
        ?? product.costo_producto
        ?? product.costo_unitario
        ?? product.costo
        ?? product.cost
        ?? 0
    );
}

function resolveItemQuantity(item = {}) {
    return parseMoney(item.cantidad ?? item.qty ?? item.quantity ?? item.peso ?? 0);
}

function resolveItemUnitPrice(item = {}) {
    return parseMoney(
        item.precioVenta
        ?? item.precio_venta
        ?? item.precio_unitario
        ?? item.precioUnitario
        ?? item.unitPrice
        ?? item.price
        ?? 0
    );
}

function resolveItemSubtotal(item = {}, unitPrice = 0, quantity = 0) {
    return parseMoney(
        item.subtotalLinea
        ?? item.subtotal_linea
        ?? item.subtotal
        ?? item.total_linea
        ?? item.lineTotal
        ?? 0
    ) || (unitPrice * quantity);
}

function parseSaleDateValue(rawDate) {
    const value = String(rawDate || '').trim();
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)) {
        return new Date(value.replace(' ', 'T'));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T12:00:00`);
    }

    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(value)) {
        const match = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
        if (match) {
            return new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00`);
        }
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getChileDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('sv-SE', { timeZone: APP_TIMEZONE }).format(date);
}

function parseMoney(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    let normalized = String(value).trim();
    if (!normalized) return 0;

    normalized = normalized.replace(/[^0-9.,-]/g, '');
    if (normalized.includes('.') && normalized.includes(',')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes(',') && !normalized.includes('.')) {
        normalized = normalized.replace(',', '.');
    } else {
        const parts = normalized.split('.');
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            normalized = normalized.replace(/\./g, '');
        }
    }

    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function RecentSaleRow({ sale, onPress }) {
    const total = resolveSaleTotal(sale);
    const dateStr = (sale.fecha_venta || sale.fechaVenta || sale.fecha || sale.created_at || '').slice(11, 16);

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Ticket {sale.id_venta || sale.folio || '#'}</Text>
                <Text style={styles.rowSubtitle}>{dateStr} - {sale.medio_pago || 'Efectivo'}</Text>
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
        minHeight: 200,
        maxHeight: 420
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
});
