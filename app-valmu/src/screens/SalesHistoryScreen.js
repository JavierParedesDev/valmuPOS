import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { Card, EmptyState, PickerField, Screen, SectionHeader } from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency } from '../utils/format';

const INTERVAL_OPTIONS = [
    { key: 'dia', label: 'Día' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mes' },
    { key: 'anio', label: 'Año' }
];

const APP_TIMEZONE = 'America/Santiago';
const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function SalesHistoryScreen({ token }) {
    const [intervalo, setIntervalo] = useState('dia');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState([]);
    const [sales, setSales] = useState([]);
    const [error, setError] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('');

    useEffect(() => {
        fetchHistory(intervalo, { silent: false });
    }, [intervalo]);

    async function fetchHistory(selectedInterval = intervalo, { silent = false } = {}) {
        if (!silent) {
            setLoading(true);
        }
        setError('');

        try {
            const [response, salesResponse] = await Promise.all([
                apiRequest({
                    endpoint: `/reportes/historico-ventas?intervalo=${selectedInterval}`,
                    token
                }),
                apiRequest({
                    endpoint: '/ventas?all=true&limit=100000',
                    token
                })
            ]);

            const salesRows = salesResponse.ok && Array.isArray(salesResponse.data) ? salesResponse.data : [];
            const apiRows = response.ok && Array.isArray(response.data)
                ? response.data.map(normalizeHistoryRow).filter((row) => row.periodo)
                : [];
            const computedRows = buildHistoryRowsFromSales(salesRows, selectedInterval);
            const historyRows = ((apiRows.length > 0 ? apiRows : computedRows))
                .sort((left, right) => String(left.periodo).localeCompare(String(right.periodo)));

            if (!salesResponse.ok && historyRows.length === 0) {
                setError(salesResponse.error || response.error || 'No se pudo obtener el historial de ventas.');
                setRows([]);
                setSales([]);
                setSelectedPeriod('');
                return;
            }

            setRows(historyRows);
            setSales(salesRows);
            setSelectedPeriod((currentValue) => {
                if (historyRows.some((row) => row.periodo === currentValue)) {
                    return currentValue;
                }
                return historyRows[historyRows.length - 1]?.periodo || '';
            });
        } catch (_fetchError) {
            setError('No se pudo cargar el historial de ventas.');
            setRows([]);
            setSales([]);
            setSelectedPeriod('');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    function onRefresh() {
        setRefreshing(true);
        fetchHistory(intervalo, { silent: true });
    }

    const periodOptions = useMemo(() => {
        return rows
            .map((row) => ({
                label: formatPeriodLabel(row.periodo, intervalo),
                value: row.periodo
            }))
            .sort((left, right) => String(left.value).localeCompare(String(right.value)))
            .reverse();
    }, [rows, intervalo]);

    const filteredRows = useMemo(() => {
        if (!selectedPeriod) {
            return [];
        }

        return rows.filter((row) => row.periodo === selectedPeriod);
    }, [rows, selectedPeriod]);

    const summary = useMemo(
        () => buildSelectedPeriodSummary({ sales, rows, interval: intervalo, selectedPeriod }),
        [sales, rows, intervalo, selectedPeriod]
    );

    const periodBreakdown = useMemo(
        () => buildPeriodBreakdownRows({ sales, interval: intervalo, selectedPeriod }),
        [sales, intervalo, selectedPeriod]
    );

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
                    subtitle="Filtros simples por día, semana, mes y año"
                />

                <Card style={styles.filterCard}>
                    <Text style={styles.cardLabel}>Tipo de período</Text>
                    <View style={styles.intervalRow}>
                        {INTERVAL_OPTIONS.map((option) => {
                            const active = option.key === intervalo;
                            return (
                                <View key={option.key} style={styles.intervalOptionWrap}>
                                    <Text
                                        style={[styles.intervalChip, active && styles.intervalChipActive]}
                                        onPress={() => setIntervalo(option.key)}
                                    >
                                        {option.label}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.pickerWrap}>
                        <PickerField
                            label={resolvePeriodPickerLabel(intervalo)}
                            value={selectedPeriod}
                            onChange={setSelectedPeriod}
                            options={periodOptions}
                            emptyLabel={resolvePeriodEmptyLabel(intervalo)}
                        />
                    </View>

                    <Text style={styles.filterHint}>
                        {resolveIntervalHint(intervalo)}
                    </Text>
                </Card>

                <Card style={styles.breakdownCard}>
                    <Text style={styles.cardLabel}>Resumen del período elegido</Text>
                    <BreakdownRow label="Total ventas" value={summary.totalVentas} />
                    <BreakdownRow label="SII" value={summary.ventasSII} />
                    <BreakdownRow label="Internas" value={summary.ventasInternas} />
                    <BreakdownRow label="Caja" value={summary.ventasCaja} />
                    <BreakdownRow label="Despacho" value={summary.ventasDespacho} />
                    <BreakdownRow label="Ganancia neta" value={summary.gananciaNeta} />
                </Card>

                {(intervalo === 'semana' || intervalo === 'mes' || intervalo === 'anio') && selectedPeriod ? (
                    <Card style={styles.timelineCard}>
                        <Text style={styles.cardLabel}>
                            {intervalo === 'semana'
                                ? 'Totales por día'
                                : intervalo === 'mes'
                                    ? 'Días del mes'
                                    : 'Totales por mes'}
                        </Text>

                        {periodBreakdown.length > 0 ? (
                            periodBreakdown.map((item) => (
                                <View key={item.key} style={styles.timelineRow}>
                                    <View style={styles.timelineTextWrap}>
                                        <Text style={styles.timelineLabel}>{item.label}</Text>
                                        {item.subtitle ? <Text style={styles.timelineSubLabel}>{item.subtitle}</Text> : null}
                                    </View>
                                    <Text style={styles.timelineValue}>{formatCurrency(item.total)}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.filterHint}>No hay ventas registradas dentro de este período.</Text>
                        )}
                    </Card>
                ) : null}

                <View style={styles.section}>
                    <SectionHeader
                        title="Detalle"
                        subtitle={selectedPeriod ? `Período seleccionado: ${formatPeriodLabel(selectedPeriod, intervalo)}` : 'Selecciona un período'}
                    />

                    {error ? (
                        <Card style={styles.errorCard}>
                            <Ionicons name="warning-outline" size={18} color={brandColors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </Card>
                    ) : null}

                    {!error && rows.length === 0 ? (
                        <EmptyState text="No hay datos históricos disponibles para este período." />
                    ) : null}

                    {!error && rows.length > 0 && filteredRows.length === 0 ? (
                        <EmptyState text="Selecciona un período para ver el detalle." />
                    ) : null}

                    {filteredRows.map((row) => (
                        <Card key={`${intervalo}-${row.periodo}`} style={styles.historyCard}>
                            <View style={styles.historyHeader}>
                                <View>
                                    <Text style={styles.historyTitle}>{formatPeriodLabel(row.periodo, intervalo)}</Text>
                                    <Text style={styles.historySubtitle}>Código {row.periodo}</Text>
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

function BreakdownRow({ label, value }) {
    return (
        <View style={styles.breakdownRow}>
            <Text style={styles.breakdownKey}>{label}</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(value)}</Text>
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

function resolvePeriodPickerLabel(intervalo) {
    if (intervalo === 'dia') return 'Elegir día';
    if (intervalo === 'semana') return 'Elegir semana';
    if (intervalo === 'mes') return 'Elegir mes';
    return 'Elegir año';
}

function resolvePeriodEmptyLabel(intervalo) {
    if (intervalo === 'dia') return 'Selecciona un día';
    if (intervalo === 'semana') return 'Selecciona una semana';
    if (intervalo === 'mes') return 'Selecciona un mes';
    return 'Selecciona un año';
}

function resolveIntervalHint(intervalo) {
    if (intervalo === 'dia') return 'Elige una sola fecha para ver su resumen.';
    if (intervalo === 'semana') return 'Elige una semana y verás lunes a domingo con sus totales.';
    if (intervalo === 'mes') return 'Elige un mes y verás cada día con su total.';
    return 'Elige un año y verás el total de cada mes.';
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

function buildPeriodBreakdownRows({ sales = [], interval = 'dia', selectedPeriod = '' }) {
    if (!selectedPeriod) {
        return [];
    }

    if (interval === 'semana') {
        const weekDays = getWeekDaysFromPeriod(selectedPeriod);
        const totalByDay = new Map();

        sales.forEach((sale) => {
            if (!isSaleReportable(sale)) return;
            const dayKey = resolveSalePeriodKey(sale, 'dia');
            if (!weekDays.some((entry) => entry.key === dayKey)) return;
            totalByDay.set(dayKey, (totalByDay.get(dayKey) || 0) + resolveSaleTotal(sale));
        });

        return weekDays.map((entry, index) => ({
            key: entry.key,
            label: WEEKDAY_LABELS[index],
            subtitle: formatPeriodLabel(entry.key, 'dia'),
            total: Number(totalByDay.get(entry.key) || 0)
        }));
    }

    if (interval === 'mes') {
        const monthDays = getMonthDaysFromPeriod(selectedPeriod);
        const totalByDay = new Map();

        sales.forEach((sale) => {
            if (!isSaleReportable(sale)) return;
            const dayKey = resolveSalePeriodKey(sale, 'dia');
            if (!monthDays.some((entry) => entry.key === dayKey)) return;
            totalByDay.set(dayKey, (totalByDay.get(dayKey) || 0) + resolveSaleTotal(sale));
        });

        return monthDays.map((entry) => ({
            key: entry.key,
            label: entry.label,
            subtitle: entry.subtitle,
            total: Number(totalByDay.get(entry.key) || 0)
        }));
    }

    if (interval === 'anio') {
        const months = Array.from({ length: 12 }, (_, index) => {
            const month = String(index + 1).padStart(2, '0');
            return {
                key: `${selectedPeriod}-${month}`,
                label: resolveMonthName(month),
                subtitle: `${selectedPeriod}`
            };
        });

        const totalByMonth = new Map();
        sales.forEach((sale) => {
            if (!isSaleReportable(sale)) return;
            const monthKey = resolveSalePeriodKey(sale, 'mes');
            if (!monthKey.startsWith(`${selectedPeriod}-`)) return;
            totalByMonth.set(monthKey, (totalByMonth.get(monthKey) || 0) + resolveSaleTotal(sale));
        });

        return months.map((entry) => ({
            key: entry.key,
            label: entry.label,
            subtitle: entry.subtitle,
            total: Number(totalByMonth.get(entry.key) || 0)
        }));
    }

    return [];
}

function buildSelectedPeriodSummary({ sales = [], rows = [], interval = 'dia', selectedPeriod = '' }) {
    if (!selectedPeriod) {
        return {
            totalVentas: 0,
            ventasSII: 0,
            ventasInternas: 0,
            ventasCaja: 0,
            ventasDespacho: 0,
            gananciaNeta: 0
        };
    }

    const rowSummary = rows
        .filter((row) => row.periodo === selectedPeriod)
        .reduce((acc, row) => {
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

    if (Array.isArray(sales) && sales.length > 0) {
        const computedSummary = sales.reduce((acc, sale) => {
            if (!isSaleReportable(sale)) return acc;
            if (resolveSalePeriodKey(sale, interval) !== selectedPeriod) return acc;

            const total = resolveSaleTotal(sale);
            const gain = resolveSaleGain(sale, total);
            const origin = resolveSaleOrigin(sale);
            const isFiscal = isFiscalSale(sale);

            acc.totalVentas += total;
            acc.gananciaNeta += gain;

            if (isFiscal) {
                acc.ventasSII += total;
            } else {
                acc.ventasInternas += total;
            }

            if (origin === 'DESPACHO') {
                acc.ventasDespacho += total;
            } else {
                acc.ventasCaja += total;
            }

            return acc;
        }, {
            totalVentas: 0,
            ventasSII: 0,
            ventasInternas: 0,
            ventasCaja: 0,
            ventasDespacho: 0,
            gananciaNeta: 0
        });

        return {
            totalVentas: computedSummary.totalVentas || rowSummary.totalVentas,
            ventasSII: computedSummary.ventasSII || rowSummary.ventasSII,
            ventasInternas: computedSummary.ventasInternas || rowSummary.ventasInternas,
            ventasCaja: computedSummary.ventasCaja || rowSummary.ventasCaja,
            ventasDespacho: computedSummary.ventasDespacho || rowSummary.ventasDespacho,
            gananciaNeta: computedSummary.gananciaNeta || rowSummary.gananciaNeta
        };
    }

    return rowSummary;
}

function getWeekDaysFromPeriod(periodo) {
    const [yearText, weekText] = String(periodo).split('-');
    const year = Number(yearText);
    const week = Number(weekText);
    const monday = getDateFromIsoWeek(year, week, 1);

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + index);
        return {
            key: formatDateAsChileKey(date),
            date
        };
    });
}

function getMonthDaysFromPeriod(periodo) {
    const [yearText, monthText] = String(periodo).split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(Date.UTC(year, month - 1, day, 12));
        const weekday = getWeekdayShortLabel(date);

        return {
            key: formatDateAsChileKey(date),
            label: `${String(day).padStart(2, '0')} ${weekday}`,
            subtitle: formatPeriodLabel(formatDateAsChileKey(date), 'dia')
        };
    });
}

function getDateFromIsoWeek(year, week, isoDay) {
    const simple = new Date(Date.UTC(year, 0, 4 + ((week - 1) * 7)));
    const dayOfWeek = simple.getUTCDay() || 7;
    const monday = new Date(simple);
    monday.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
    const target = new Date(monday);
    target.setUTCDate(monday.getUTCDate() + (isoDay - 1));
    return target;
}

function formatDateAsChileKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getWeekdayShortLabel(date) {
    return new Intl.DateTimeFormat('es-CL', {
        timeZone: APP_TIMEZONE,
        weekday: 'short'
    }).format(date).replace('.', '');
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

function normalizeHistoryRow(row) {
    const ventasCaja = parseMoney(row.ventasCaja ?? row.ventas_caja ?? row.caja ?? 0);
    const ventasDespacho = parseMoney(row.ventasDespacho ?? row.ventas_despacho ?? row.despacho ?? 0);
    const ventasSII = parseMoney(row.ventasSII ?? row.ventas_sii ?? row.sii ?? 0);
    const ventasInternas = parseMoney(row.ventasInternas ?? row.ventas_internas ?? row.internas ?? 0);
    const totalVentas = parseMoney(row.totalVentas ?? row.total_ventas ?? row.total ?? row.monto_total ?? 0)
        || (ventasCaja + ventasDespacho)
        || (ventasSII + ventasInternas);

    return {
        ...row,
        periodo: String(row.periodo ?? row.period ?? row.fecha ?? '').trim(),
        totalVentas,
        ventasSII,
        ventasInternas,
        ventasCaja,
        ventasDespacho,
        gananciaNeta: parseMoney(row.gananciaNeta ?? row.ganancia_neta ?? row.utilidad ?? row.profit ?? 0)
    };
}

function buildHistoryRowsFromSales(sales = [], interval = 'dia') {
    const buckets = new Map();

    sales.forEach((sale) => {
        if (!isSaleReportable(sale)) return;

        const periodKey = resolveSalePeriodKey(sale, interval);
        if (!periodKey) return;

        if (!buckets.has(periodKey)) {
            buckets.set(periodKey, {
                periodo: periodKey,
                totalVentas: 0,
                ventasSII: 0,
                ventasInternas: 0,
                ventasCaja: 0,
                ventasDespacho: 0,
                gananciaNeta: 0
            });
        }

        const bucket = buckets.get(periodKey);
        const total = resolveSaleTotal(sale);
        const gain = resolveSaleGain(sale, total);
        const origin = resolveSaleOrigin(sale);
        const isFiscal = isFiscalSale(sale);

        bucket.totalVentas += total;
        bucket.gananciaNeta += gain;

        if (isFiscal) {
            bucket.ventasSII += total;
        } else {
            bucket.ventasInternas += total;
        }

        if (origin === 'DESPACHO') {
            bucket.ventasDespacho += total;
        } else {
            bucket.ventasCaja += total;
        }
    });

    return Array.from(buckets.values()).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
}

function isSaleReportable(sale) {
    const status = String(sale.estado || '').toUpperCase();
    return status !== 'ANULADA' && status !== 'CANCELADA';
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

    const date = parseSaleDateValue(rawDate);
    if (!date) return '';

    const parts = getChileDateParts(date);
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');

    if (interval === 'anio') {
        return `${parts.year}`;
    }

    if (interval === 'mes') {
        return `${parts.year}-${month}`;
    }

    if (interval === 'semana') {
        const weekInfo = getIsoWeekInfo(parts);
        return `${weekInfo.year}-${String(weekInfo.week).padStart(2, '0')}`;
    }

    return `${parts.year}-${month}-${day}`;
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

function getChileDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const byType = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return {
        year: Number(byType.year),
        month: Number(byType.month),
        day: Number(byType.day)
    };
}

function getIsoWeekInfo({ year, month, day }) {
    const temp = new Date(Date.UTC(year, month - 1, day));
    const weekday = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - weekday);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return {
        year: temp.getUTCFullYear(),
        week: Math.ceil((((temp - yearStart) / 86400000) + 1) / 7)
    };
}

function resolveSaleTotal(sale) {
    return parseMoney(sale.total ?? sale.monto_total ?? sale.monto ?? sale.totalVenta ?? sale.total_venta ?? 0);
}

function resolveSaleGain(sale, total) {
    const explicitGain = parseMoney(sale.gananciaNeta ?? sale.ganancia_neta ?? sale.utilidad ?? sale.profit ?? 0);
    if (explicitGain) return explicitGain;

    const cost = parseMoney(sale.costo_total ?? sale.costoTotal ?? 0);
    return cost ? total - cost : 0;
}

function isFiscalSale(sale) {
    const value = sale.esFiscal ?? sale.es_fiscal ?? sale.fiscal;
    return value === true || Number(value) === 1 || String(value).toLowerCase() === 'true';
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
        marginHorizontal: -4
    },
    intervalOptionWrap: {
        width: '50%',
        paddingHorizontal: 4,
        paddingBottom: 8
    },
    intervalChip: {
        overflow: 'hidden',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: brandColors.outline,
        backgroundColor: brandColors.backgroundAlt,
        paddingVertical: 12,
        paddingHorizontal: 10,
        textAlign: 'center',
        color: brandColors.text,
        fontSize: 13,
        fontWeight: '800'
    },
    intervalChipActive: {
        backgroundColor: brandColors.accent,
        borderColor: brandColors.accent,
        color: '#FFFFFF'
    },
    pickerWrap: {
        marginTop: 8
    },
    filterHint: {
        marginTop: 10,
        fontSize: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    breakdownCard: {
        marginBottom: 16
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
    timelineCard: {
        marginBottom: 16
    },
    timelineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.outline
    },
    timelineTextWrap: {
        flex: 1,
        paddingRight: 12
    },
    timelineLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: brandColors.text
    },
    timelineSubLabel: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: brandColors.textMuted
    },
    timelineValue: {
        fontSize: 14,
        fontWeight: '900',
        color: brandColors.accent
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
