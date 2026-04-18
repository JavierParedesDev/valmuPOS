import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { Card, EmptyState, Screen, SectionHeader } from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency } from '../utils/format';

const INTERVAL_OPTIONS = [
    { key: 'dia', label: 'Dia' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mes' },
    { key: 'anio', label: 'Año' }
];

export default function SalesHistoryScreen({ token }) {
    const [intervalo, setIntervalo] = useState('dia');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState([]);
    const [branchRows, setBranchRows] = useState([]);
    const [error, setError] = useState('');
    const [periodFilter, setPeriodFilter] = useState('');

    useEffect(() => {
        fetchHistory(intervalo, { silent: false });
    }, [intervalo]);

    async function fetchHistory(selectedInterval = intervalo, { silent = false } = {}) {
        if (!silent) {
            setLoading(true);
        }
        setError('');

        try {
            const response = await apiRequest({
                endpoint: `/reportes/historico-ventas?intervalo=${selectedInterval}`,
                token
            });
            const salesResponse = await apiRequest({
                endpoint: '/ventas?all=true&limit=100000',
                token
            });
            const branchesResponse = await apiRequest({
                endpoint: '/sucursales',
                token
            });

            if (!response.ok) {
                setError(response.error || 'No se pudo obtener el historial de ventas.');
                setRows([]);
                return;
            }

            setRows(Array.isArray(response.data) ? response.data : []);
            setBranchRows(
                buildBranchRows({
                    sales: salesResponse.ok && Array.isArray(salesResponse.data) ? salesResponse.data : [],
                    branches: branchesResponse.ok && Array.isArray(branchesResponse.data) ? branchesResponse.data : [],
                    interval: selectedInterval,
                    allowedPeriods: (Array.isArray(response.data) ? response.data : []).map((item) => String(item.periodo || ''))
                })
            );
        } catch (fetchError) {
            setError('No se pudo cargar el historial de ventas.');
            setRows([]);
            setBranchRows([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    function onRefresh() {
        setRefreshing(true);
        fetchHistory(intervalo, { silent: true });
    }

    const filteredRows = useMemo(() => {
        const normalizedFilter = normalizePeriodFilter(periodFilter);
        if (!normalizedFilter) return rows;

        return rows.filter((row) => {
            const periodo = String(row.periodo || '');
            const visibleLabel = formatPeriodLabel(periodo, intervalo);
            return normalizePeriodFilter(`${periodo} ${visibleLabel}`).includes(normalizedFilter);
        });
    }, [rows, periodFilter, intervalo]);

    const summary = useMemo(() => {
        return filteredRows.reduce((acc, row) => {
            acc.totalVentas += Number(row.totalVentas || 0);
            acc.ventasSII += Number(row.ventasSII || 0);
            acc.ventasInternas += Number(row.ventasInternas || 0);
            acc.ventasCaja += Number(row.ventasCaja || 0);
            acc.ventasDespacho += Number(row.ventasDespacho || 0);
            acc.gananciaNeta += Number(row.gananciaNeta || 0);
            return acc;
        }, {
            totalVentas: 0,
            ventasSII: 0,
            ventasInternas: 0,
            ventasCaja: 0,
            ventasDespacho: 0,
            gananciaNeta: 0
        });
    }, [filteredRows]);

    const latestPeriod = rows.length > 0 ? rows[rows.length - 1]?.periodo : '';
    const filteredPeriods = useMemo(
        () => filteredRows.map((row) => String(row.periodo || '')),
        [filteredRows]
    );

    const filteredBranchRows = useMemo(() => {
        const allowed = new Set(filteredPeriods);
        return branchRows
            .map((branch) => {
                const scoped = branch.breakdown.filter((item) => allowed.has(item.periodo));
                if (scoped.length === 0) {
                    return null;
                }

                return scoped.reduce((acc, item) => {
                    acc.ventasCaja += Number(item.ventasCaja || 0);
                    acc.ventasDespacho += Number(item.ventasDespacho || 0);
                    acc.ventasSIICaja += Number(item.ventasSIICaja || 0);
                    acc.ventasSIIDespacho += Number(item.ventasSIIDespacho || 0);
                    acc.ventasInternasCaja += Number(item.ventasInternasCaja || 0);
                    acc.ventasInternasDespacho += Number(item.ventasInternasDespacho || 0);
                    acc.gananciaCaja += Number(item.gananciaCaja || 0);
                    acc.gananciaDespacho += Number(item.gananciaDespacho || 0);
                    acc.periodos.push(item.periodo);
                    return acc;
                }, {
                    id_sucursal: branch.id_sucursal,
                    nombreSucursal: branch.nombreSucursal,
                    ventasCaja: 0,
                    ventasDespacho: 0,
                    ventasSIICaja: 0,
                    ventasSIIDespacho: 0,
                    ventasInternasCaja: 0,
                    ventasInternasDespacho: 0,
                    gananciaCaja: 0,
                    gananciaDespacho: 0,
                    periodos: [],
                    breakdown: scoped
                });
            })
            .filter(Boolean)
            .sort((a, b) => (b.ventasCaja + b.ventasDespacho) - (a.ventasCaja + a.ventasDespacho));
    }, [branchRows, filteredPeriods]);

    if (loading && !refreshing) {
        return (
            <Screen statusBarColor={brandColors.surface}>
                <View style={styles.loaderArea}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.loaderText}>Cargando historial de ventas...</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen statusBarColor={brandColors.surface}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <SectionHeader
                    title="Historial de Ventas"
                    subtitle="Tendencias por dia, semana, mes y año"
                />

                <Card style={styles.intervalCard}>
                    <Text style={styles.cardLabel}>Periodo de analisis</Text>
                    <View style={styles.intervalRow}>
                        {INTERVAL_OPTIONS.map((option) => {
                            const active = option.key === intervalo;
                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.intervalButton, active && styles.intervalButtonActive]}
                                    onPress={() => setIntervalo(option.key)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.intervalButtonText, active && styles.intervalButtonTextActive]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={styles.intervalHint}>
                        Ultimo periodo visible: {formatPeriodLabel(latestPeriod, intervalo)}
                    </Text>
                </Card>

                <Card style={styles.filterCard}>
                    <Text style={styles.cardLabel}>Filtro por fecha o periodo</Text>
                    <TextInput
                        value={periodFilter}
                        onChangeText={setPeriodFilter}
                        placeholder={resolveFilterPlaceholder(intervalo)}
                        placeholderTextColor={brandColors.textMuted}
                        style={styles.filterInput}
                    />
                    <Text style={styles.filterHint}>
                        Busca por fecha, semana, mes o año segun el modo que tengas seleccionado.
                    </Text>
                </Card>

                <View style={styles.summaryGrid}>
                    <SummaryCard
                        label="Total ventas"
                        value={formatCurrency(summary.totalVentas)}
                        icon="stats-chart-outline"
                        tone="accent"
                    />
                    <SummaryCard
                        label="Ventas caja"
                        value={formatCurrency(summary.ventasCaja)}
                        icon="storefront-outline"
                        tone="accent"
                    />
                    <SummaryCard
                        label="Ventas despacho"
                        value={formatCurrency(summary.ventasDespacho)}
                        icon="bus-outline"
                        tone="info"
                    />
                    <SummaryCard
                        label="Ganancia neta"
                        value={formatCurrency(summary.gananciaNeta)}
                        icon="trending-up-outline"
                        tone="success"
                    />
                </View>

                <Card style={styles.breakdownCard}>
                    <Text style={styles.cardLabel}>Resumen acumulado</Text>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownKey}>SII</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(summary.ventasSII)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownKey}>Internas</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(summary.ventasInternas)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownKey}>Caja</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(summary.ventasCaja)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownKey}>Despacho</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(summary.ventasDespacho)}</Text>
                    </View>
                </Card>

                {/* Seccion de sucursales ocultada temporalmente por solicitud del usuario */}
                {/* 
                {filteredBranchRows.length > 0 ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title="Sucursales y despacho"
                            subtitle="Caja y despacho separados por sucursal"
                        />
                        {filteredBranchRows.map((branch) => (
                            <Card key={`branch-${branch.id_sucursal}`} style={styles.branchCard}>
                                <View style={styles.branchHeader}>
                                    <Text style={styles.branchTitle}>{branch.nombreSucursal}</Text>
                                    <Text style={styles.branchTotal}>{formatCurrency(Number(branch.ventasCaja || 0) + Number(branch.ventasDespacho || 0))}</Text>
                                </View>
                                <View style={styles.historyGrid}>
                                    <MetricPill label="Caja" value={branch.ventasCaja} tone="accent" />
                                    <MetricPill label="Despacho" value={branch.ventasDespacho} tone="info" />
                                    <MetricPill label="Caja SII" value={branch.ventasSIICaja} tone="neutral" />
                                    <MetricPill label="Despacho SII" value={branch.ventasSIIDespacho} tone="neutral" />
                                    <MetricPill label="Caja Internas" value={branch.ventasInternasCaja} tone="neutral" />
                                    <MetricPill label="Despacho Internas" value={branch.ventasInternasDespacho} tone="neutral" />
                                    <MetricPill label="Ganancia Caja" value={branch.gananciaCaja} tone="success" />
                                    <MetricPill label="Ganancia Despacho" value={branch.gananciaDespacho} tone="success" />
                                </View>
                            </Card>
                        ))}
                    </View>
                ) : null}
                */}

                <View style={styles.section}>
                    <SectionHeader
                        title="Detalle por fecha"
                        subtitle="Cada fila representa un periodo del historial"
                    />
                    {error ? (
                        <Card style={styles.errorCard}>
                            <Ionicons name="warning-outline" size={18} color={brandColors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </Card>
                    ) : null}

                    {!error && rows.length === 0 ? (
                        <EmptyState text="No hay datos historicos disponibles para este periodo." />
                    ) : null}

                    {!error && rows.length > 0 && filteredRows.length === 0 ? (
                        <EmptyState text="No hay coincidencias para el filtro ingresado." />
                    ) : null}

                    {filteredRows.map((row) => (
                        <Card key={`${intervalo}-${row.periodo}`} style={styles.historyCard}>
                            <View style={styles.historyHeader}>
                                <View>
                                    <Text style={styles.historyTitle}>{formatPeriodLabel(row.periodo, intervalo)}</Text>
                                    <Text style={styles.historySubtitle}>Periodo {row.periodo}</Text>
                                </View>
                                <Text style={styles.historyTotal}>{formatCurrency(row.totalVentas)}</Text>
                            </View>

                            <View style={styles.historyGrid}>
                                <MetricPill label="SII" value={row.ventasSII} tone="neutral" />
                                <MetricPill label="Internas" value={row.ventasInternas} tone="neutral" />
                                <MetricPill label="Caja" value={row.ventasCaja} tone="accent" />
                                <MetricPill label="Despacho" value={row.ventasDespacho} tone="info" />
                                <MetricPill label="Ganancia" value={row.gananciaNeta} tone="success" fullWidth />
                            </View>
                        </Card>
                    ))}
                </View>
            </ScrollView>
        </Screen>
    );
}

function SummaryCard({ label, value, icon, tone = 'accent' }) {
    const color = resolveToneColor(tone);
    const soft = resolveToneSoft(tone);

    return (
        <Card style={styles.summaryCard}>
            <View style={[styles.summaryIconWrap, { backgroundColor: soft }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        </Card>
    );
}

function MetricPill({ label, value, tone = 'neutral', fullWidth = false }) {
    const color = resolveToneColor(tone);
    const soft = resolveToneSoft(tone);

    return (
        <View style={[styles.metricPill, fullWidth && styles.metricPillFull, { backgroundColor: soft }]}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={[styles.metricValue, { color }]}>{formatCurrency(value)}</Text>
        </View>
    );
}

function resolveToneColor(tone) {
    if (tone === 'success') return brandColors.success;
    if (tone === 'info') return '#0284C7';
    if (tone === 'neutral') return brandColors.shell;
    return brandColors.accent;
}

function resolveToneSoft(tone) {
    if (tone === 'success') return '#DCFCE7';
    if (tone === 'info') return '#E0F2FE';
    if (tone === 'neutral') return brandColors.backgroundAlt;
    return brandColors.accentSoft;
}

function formatPeriodLabel(periodo, intervalo) {
    if (!periodo) return '--';

    if (intervalo === 'anio') {
        return `Año ${periodo}`;
    }

    if (intervalo === 'mes') {
        const [year, month] = String(periodo).split('-');
        return `${resolveMonthName(month)} ${year}`;
    }

    if (intervalo === 'semana') {
        const [year, week] = String(periodo).split('-');
        return `Semana ${week} · ${year}`;
    }

    const [year, month, day] = String(periodo).split('-');
    if (!year || !month || !day) return String(periodo);
    return `${day}/${month}/${year}`;
}

function resolveFilterPlaceholder(intervalo) {
    if (intervalo === 'anio') return 'Ej: 2026';
    if (intervalo === 'mes') return 'Ej: 2026-04 o Abril 2026';
    if (intervalo === 'semana') return 'Ej: 2026-16 o Semana 16';
    return 'Ej: 2026-04-18 o 18/04/2026';
}

function normalizePeriodFilter(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function buildBranchRows({ sales = [], branches = [], interval = 'dia', allowedPeriods = [] }) {
    const branchMap = new Map();
    const allowedPeriodsSet = new Set((allowedPeriods || []).filter(Boolean));

    branches.forEach((branch) => {
        branchMap.set(Number(branch.id_sucursal), {
            id_sucursal: Number(branch.id_sucursal),
            nombreSucursal: branch.nombreSucursal || `Sucursal ${branch.id_sucursal}`,
            ventasCaja: 0,
            ventasDespacho: 0,
            ventasSIICaja: 0,
            ventasSIIDespacho: 0,
            ventasInternasCaja: 0,
            ventasInternasDespacho: 0,
            gananciaCaja: 0,
            gananciaDespacho: 0,
            periodos: [],
            breakdown: []
        });
    });

    sales.forEach((sale) => {
        if (!isSaleReportable(sale)) return;

        const branchId = Number(sale.id_sucursal || 0);
        if (!branchMap.has(branchId)) {
            branchMap.set(branchId, {
                id_sucursal: branchId,
                nombreSucursal: sale.nombreSucursal || `Sucursal ${branchId || 'N/D'}`,
                ventasCaja: 0,
                ventasDespacho: 0,
                ventasSIICaja: 0,
                ventasSIIDespacho: 0,
                ventasInternasCaja: 0,
                ventasInternasDespacho: 0,
                gananciaCaja: 0,
                gananciaDespacho: 0,
                periodos: []
            });
        }

        const branch = branchMap.get(branchId);
        const total = Number(sale.total || 0);
        const estimatedGain = Number(sale.gananciaNeta || 0);
        const origin = resolveSaleOrigin(sale);
        const isFiscal = Boolean(sale.esFiscal) || String(sale.esFiscal).toLowerCase() === 'true' || Number(sale.esFiscal) === 1;
        const periodKey = resolveSalePeriodKey(sale, interval);
        if (!periodKey || (allowedPeriodsSet.size > 0 && !allowedPeriodsSet.has(periodKey))) {
            return;
        }

        if (periodKey && !branch.periodos.includes(periodKey)) {
            branch.periodos.push(periodKey);
        }

        let periodBucket = branch.breakdown.find((item) => item.periodo === periodKey);
        if (!periodBucket) {
            periodBucket = {
                periodo: periodKey,
                ventasCaja: 0,
                ventasDespacho: 0,
                ventasSIICaja: 0,
                ventasSIIDespacho: 0,
                ventasInternasCaja: 0,
                ventasInternasDespacho: 0,
                gananciaCaja: 0,
                gananciaDespacho: 0
            };
            branch.breakdown.push(periodBucket);
        }

        if (origin === 'DESPACHO') {
            branch.ventasDespacho += total;
            periodBucket.ventasDespacho += total;
            if (isFiscal) {
                branch.ventasSIIDespacho += total;
                periodBucket.ventasSIIDespacho += total;
            } else {
                branch.ventasInternasDespacho += total;
                periodBucket.ventasInternasDespacho += total;
            }
            branch.gananciaDespacho += estimatedGain;
            periodBucket.gananciaDespacho += estimatedGain;
            return;
        }

        branch.ventasCaja += total;
        periodBucket.ventasCaja += total;
        if (isFiscal) {
            branch.ventasSIICaja += total;
            periodBucket.ventasSIICaja += total;
        } else {
            branch.ventasInternasCaja += total;
            periodBucket.ventasInternasCaja += total;
        }
        branch.gananciaCaja += estimatedGain;
        periodBucket.gananciaCaja += estimatedGain;
    });

    return Array.from(branchMap.values())
        .filter((branch) =>
            branch.ventasCaja > 0
            || branch.ventasDespacho > 0
            || branch.gananciaCaja > 0
            || branch.gananciaDespacho > 0
        )
        .sort((a, b) => (b.ventasCaja + b.ventasDespacho) - (a.ventasCaja + a.ventasDespacho));
}

function isSaleReportable(sale) {
    const status = String(sale.estado || '').toUpperCase();
    if (status === 'ANULADA' || status === 'CANCELADA') {
        return false;
    }
    return true;
}

function resolveSaleOrigin(sale) {
    const explicitOrigin = String(sale.origenVenta || sale.origen_venta || '').toUpperCase().trim();
    if (explicitOrigin) {
        return explicitOrigin;
    }

    const status = String(sale.estado || '').toUpperCase();
    if (status === 'EN_RUTA' || status === 'ENTREGADO') {
        return 'DESPACHO';
    }

    return 'CAJA';
}

function resolveSalePeriodKey(sale, interval) {
    const rawDate = sale.fechaVenta || sale.fecha_venta || sale.created_at;
    if (!rawDate) return '';

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (interval === 'anio') {
        return `${year}`;
    }

    if (interval === 'mes') {
        return `${year}-${month}`;
    }

    if (interval === 'semana') {
        const week = getIsoWeek(date);
        return `${year}-${String(week).padStart(2, '0')}`;
    }

    return `${year}-${month}-${day}`;
}

function getIsoWeek(date) {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
}

function resolveMonthName(month) {
    const names = {
        '01': 'Enero',
        '02': 'Febrero',
        '03': 'Marzo',
        '04': 'Abril',
        '05': 'Mayo',
        '06': 'Junio',
        '07': 'Julio',
        '08': 'Agosto',
        '09': 'Septiembre',
        '10': 'Octubre',
        '11': 'Noviembre',
        '12': 'Diciembre'
    };

    return names[String(month).padStart(2, '0')] || String(month);
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        padding: 16,
        paddingBottom: 140
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
    intervalCard: {
        marginBottom: 16
    },
    filterCard: {
        marginBottom: 16
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
        color: brandColors.textMuted,
        letterSpacing: 0.6,
        marginBottom: 12
    },
    intervalRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    intervalButton: {
        flexGrow: 1,
        minWidth: '22%',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: brandColors.outline,
        backgroundColor: brandColors.backgroundAlt,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center'
    },
    intervalButtonActive: {
        backgroundColor: brandColors.accent,
        borderColor: brandColors.accent
    },
    intervalButtonText: {
        color: brandColors.text,
        fontSize: 13,
        fontWeight: '800'
    },
    intervalButtonTextActive: {
        color: '#FFFFFF'
    },
    intervalHint: {
        marginTop: 12,
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    filterInput: {
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: brandColors.outline,
        backgroundColor: brandColors.backgroundAlt,
        paddingHorizontal: 14,
        color: brandColors.text,
        fontSize: 14,
        fontWeight: '700'
    },
    filterHint: {
        marginTop: 10,
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16
    },
    summaryCard: {
        width: '48%',
        minHeight: 120
    },
    summaryIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: brandColors.textMuted
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '900',
        marginTop: 8
    },
    breakdownCard: {
        marginBottom: 20
    },
    branchCard: {
        marginBottom: 14
    },
    branchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14
    },
    branchTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text,
        marginRight: 12
    },
    branchTotal: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.accent
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.outline
    },
    breakdownKey: {
        fontSize: 13,
        color: brandColors.textMuted,
        fontWeight: '700'
    },
    breakdownValue: {
        fontSize: 14,
        color: brandColors.text,
        fontWeight: '900'
    },
    section: {
        marginTop: 8
    },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    errorText: {
        flex: 1,
        color: brandColors.danger,
        fontWeight: '700'
    },
    historyCard: {
        marginBottom: 14
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14
    },
    historyTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text
    },
    historySubtitle: {
        marginTop: 4,
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    historyTotal: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.accent,
        marginLeft: 12
    },
    historyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    metricPill: {
        width: '48%',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12
    },
    metricPillFull: {
        width: '100%'
    },
    metricLabel: {
        fontSize: 10,
        color: brandColors.textMuted,
        fontWeight: '900',
        textTransform: 'uppercase'
    },
    metricValue: {
        marginTop: 6,
        fontSize: 14,
        fontWeight: '900'
    }
});
