// =========================================================================
// MODULO G: RUTAS DE REPORTES, DASHBOARD Y AUDITORIA (ADMIN)
// =========================================================================
const express = require('express');
const db = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

const CHILE_TIMEZONE = 'America/Santiago';
const VALID_INTERVALS = new Set(['dia', 'semana', 'mes', 'anio']);

const esAdmin = (req, res, next) => {
    if (req.usuario && (req.usuario.id_perfil === 1 || req.usuario.rol === 'admin' || req.usuario.rol === 'Administrador')) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
};

function getChileDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return new Intl.DateTimeFormat('sv-SE', { timeZone: CHILE_TIMEZONE }).format(date);
}

function addDays(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() + days);
    return getChileDateKey(date);
}

function getChileDayRange() {
    const inicio = getChileDateKey(new Date());
    return {
        inicio,
        finExclusivo: addDays(inicio, 1)
    };
}

function getReportableSaleCondition(alias = 'v') {
    return `(
        (IFNULL(${alias}.origenVenta, 'CAJA') = 'CAJA' AND ${alias}.estado = 'COMPLETADA')
        OR (IFNULL(${alias}.origenVenta, 'CAJA') = 'DESPACHO' AND ${alias}.estado IN ('COMPLETADA', 'EN_RUTA'))
    )`;
}

function getFiscalCondition(alias = 't', expected = true) {
    return expected
        ? `(${alias}.esFiscal = TRUE OR ${alias}.esFiscal = 1)`
        : `(${alias}.esFiscal = FALSE OR ${alias}.esFiscal = 0 OR ${alias}.esFiscal IS NULL)`;
}

function toNumber(value) {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeKpiRow(row = {}) {
    return {
        ventasSIICaja: toNumber(row.ventasSIICaja),
        ventasInternasCaja: toNumber(row.ventasInternasCaja),
        ventasSIIDespacho: toNumber(row.ventasSIIDespacho),
        ventasInternasDespacho: toNumber(row.ventasInternasDespacho),
        gananciaCaja: toNumber(row.gananciaCaja),
        gananciaDespacho: toNumber(row.gananciaDespacho)
    };
}

// GET /api/reportes/kpis-diarios
router.get('/kpis-diarios', verificarToken, esAdmin, async (req, res) => {
    try {
        const { inicio, finExclusivo } = getChileDayRange();
        const reportable = getReportableSaleCondition('v');

        const query = `
            SELECT
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', true)} AND IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasSIICaja,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', false)} AND IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasInternasCaja,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', true)} AND IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasSIIDespacho,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', false)} AND IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasInternasDespacho,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN IFNULL(dg.ganancia_venta, 0) ELSE 0 END), 0) AS gananciaCaja,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN IFNULL(dg.ganancia_venta, 0) ELSE 0 END), 0) AS gananciaDespacho
            FROM VENTA v
            LEFT JOIN TIPO_DOC t ON v.id_tipoDoc = t.id_tipoDoc
            LEFT JOIN (
                SELECT id_venta, SUM(subtotalLinea - (precioCostoVenta * cantidadVenta)) AS ganancia_venta
                FROM DETALLE_VENTA
                GROUP BY id_venta
            ) dg ON v.id_venta = dg.id_venta
            WHERE v.fechaVenta >= ?
              AND v.fechaVenta < ?
              AND ${reportable}
        `;

        const [rows] = await db.execute(query, [inicio, finExclusivo]);
        const row = normalizeKpiRow(rows[0] || {});

        res.json({
            ventasSII: row.ventasSIICaja + row.ventasSIIDespacho,
            ventasInternas: row.ventasInternasCaja + row.ventasInternasDespacho,
            gananciaNeta: row.gananciaCaja + row.gananciaDespacho,
            caja: {
                ventasSII: row.ventasSIICaja,
                ventasInternas: row.ventasInternasCaja,
                gananciaNeta: row.gananciaCaja
            },
            despacho: {
                ventasSII: row.ventasSIIDespacho,
                ventasInternas: row.ventasInternasDespacho,
                gananciaNeta: row.gananciaDespacho
            }
        });
    } catch (error) {
        console.error('Error KPIs:', error);
        res.status(500).json({ error: 'Error al obtener los KPIs diarios' });
    }
});

// GET /api/reportes/ventas-por-sucursal
router.get('/ventas-por-sucursal', verificarToken, esAdmin, async (req, res) => {
    try {
        const { inicio, finExclusivo } = getChileDayRange();
        const reportable = getReportableSaleCondition('v');

        const query = `
            SELECT
                s.id_sucursal,
                s.nombreSucursal,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', true)} AND ${reportable} THEN v.total ELSE 0 END), 0) AS ventasSII,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', false)} AND ${reportable} THEN v.total ELSE 0 END), 0) AS ventasInternas,
                IFNULL(SUM(CASE WHEN ${reportable} THEN IFNULL(dg.ganancia_venta, 0) ELSE 0 END), 0) AS gananciaNeta,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasCaja,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasDespacho,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', true)} AND IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasSIICaja,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', false)} AND IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasInternasCaja,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', true)} AND IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasSIIDespacho,
                IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', false)} AND IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasInternasDespacho,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN IFNULL(dg.ganancia_venta, 0) ELSE 0 END), 0) AS gananciaCaja,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN IFNULL(dg.ganancia_venta, 0) ELSE 0 END), 0) AS gananciaDespacho
            FROM SUCURSAL s
            LEFT JOIN VENTA v
                ON v.id_sucursal = s.id_sucursal
                AND v.fechaVenta >= ?
                AND v.fechaVenta < ?
            LEFT JOIN TIPO_DOC t ON v.id_tipoDoc = t.id_tipoDoc
            LEFT JOIN (
                SELECT id_venta, SUM(subtotalLinea - (precioCostoVenta * cantidadVenta)) AS ganancia_venta
                FROM DETALLE_VENTA
                GROUP BY id_venta
            ) dg ON v.id_venta = dg.id_venta
            GROUP BY s.id_sucursal, s.nombreSucursal
            ORDER BY s.id_sucursal ASC
        `;

        const [rows] = await db.execute(query, [inicio, finExclusivo]);
        res.json(rows);
    } catch (error) {
        console.error('Error Ventas por Sucursal:', error);
        res.status(500).json({ error: 'Error al obtener ventas por sucursal' });
    }
});

// GET /api/reportes/comparativa-despachos
router.get('/comparativa-despachos', verificarToken, esAdmin, async (req, res) => {
    try {
        const { inicio, finExclusivo } = getChileDayRange();

        const query = `
            SELECT
                s.nombreSucursal,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasPresenciales,
                IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasPorDespacho
            FROM SUCURSAL s
            LEFT JOIN VENTA v
                ON v.id_sucursal = s.id_sucursal
                AND v.fechaVenta >= ?
                AND v.fechaVenta < ?
            GROUP BY s.id_sucursal, s.nombreSucursal
            ORDER BY s.id_sucursal ASC
        `;

        const [rows] = await db.execute(query, [inicio, finExclusivo]);
        res.json(rows);
    } catch (error) {
        console.error('Error Comparativa Despachos:', error);
        res.status(500).json({ error: 'Error al obtener la comparativa de despachos' });
    }
});

// GET /api/reportes/historico-ventas?intervalo=dia
router.get('/historico-ventas', verificarToken, esAdmin, async (req, res) => {
    try {
        const intervalo = VALID_INTERVALS.has(req.query.intervalo) ? req.query.intervalo : 'dia';
        const { inicio } = getChileDayRange();
        const daysBackByInterval = {
            dia: 65,
            semana: 65 * 7,
            mes: 65 * 31,
            anio: 65 * 365
        };
        const fechaCorte = addDays(inicio, -daysBackByInterval[intervalo]);
        const dateExpr = 'DATE(v.fechaVenta)';
        const reportable = getReportableSaleCondition('v');
        let formatoFecha = `DATE_FORMAT(${dateExpr}, '%Y-%m-%d')`;

        if (intervalo === 'semana') {
            formatoFecha = `DATE_FORMAT(${dateExpr}, '%x-%v')`;
        } else if (intervalo === 'mes') {
            formatoFecha = `DATE_FORMAT(${dateExpr}, '%Y-%m')`;
        } else if (intervalo === 'anio') {
            formatoFecha = `DATE_FORMAT(${dateExpr}, '%Y')`;
        }

        const query = `
            SELECT * FROM (
                SELECT
                    ${formatoFecha} AS periodo,
                    IFNULL(SUM(CASE WHEN ${reportable} THEN v.total ELSE 0 END), 0) AS totalVentas,
                    IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', true)} AND ${reportable} THEN v.total ELSE 0 END), 0) AS ventasSII,
                    IFNULL(SUM(CASE WHEN ${getFiscalCondition('t', false)} AND ${reportable} THEN v.total ELSE 0 END), 0) AS ventasInternas,
                    IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'CAJA' AND v.estado = 'COMPLETADA' THEN v.total ELSE 0 END), 0) AS ventasCaja,
                    IFNULL(SUM(CASE WHEN IFNULL(v.origenVenta, 'CAJA') = 'DESPACHO' AND v.estado IN ('COMPLETADA', 'EN_RUTA') THEN v.total ELSE 0 END), 0) AS ventasDespacho,
                    IFNULL(SUM(CASE WHEN ${reportable} THEN IFNULL(dg.ganancia_venta, 0) ELSE 0 END), 0) AS gananciaNeta
                FROM VENTA v
                LEFT JOIN TIPO_DOC t ON v.id_tipoDoc = t.id_tipoDoc
                LEFT JOIN (
                    SELECT id_venta, SUM(subtotalLinea - (precioCostoVenta * cantidadVenta)) AS ganancia_venta
                    FROM DETALLE_VENTA
                    GROUP BY id_venta
                ) dg ON v.id_venta = dg.id_venta
                WHERE v.fechaVenta >= ?
                  AND ${reportable}
                GROUP BY periodo
                ORDER BY periodo DESC
                LIMIT 60
            ) historico
            ORDER BY periodo ASC
        `;

        const [rows] = await db.execute(query, [fechaCorte]);
        res.json(rows);
    } catch (error) {
        console.error('Error Historico Ventas:', error);
        res.status(500).json({ error: 'Error al obtener el historico de ventas' });
    }
});

// GET /api/reportes/alertas-stock
router.get('/alertas-stock', verificarToken, esAdmin, async (req, res) => {
    try {
        let query = `
            SELECT p.codigoBarras, p.nombreProducto, s.cantidad, suc.nombreSucursal
            FROM STOCK_INVENTARIO s
            INNER JOIN PRODUCTO p ON s.id_producto = p.id_producto
            INNER JOIN SUCURSAL suc ON s.id_sucursal = suc.id_sucursal
            WHERE s.cantidad <= 15
        `;
        const queryParams = [];

        if (req.query.id_sucursal) {
            query += ' AND s.id_sucursal = ?';
            queryParams.push(req.query.id_sucursal);
        }

        query += ' ORDER BY s.cantidad ASC';

        const [rows] = await db.execute(query, queryParams);
        res.json(rows);
    } catch (error) {
        console.error('Error Alertas Stock:', error);
        res.status(500).json({ error: 'Error al obtener las alertas de stock' });
    }
});

// GET /api/reportes/movimientos-inventario
router.get('/movimientos-inventario', verificarToken, esAdmin, async (req, res) => {
    try {
        const query = `
            SELECT
                m.id_movimiento,
                m.fechaMov,
                m.tipoMovimiento,
                m.cantidadMov,
                m.comprobanteMov,
                p.nombreProducto,
                p.codigoBarras,
                IFNULL(u.nombreCompleto, 'Sistema Automatico') AS usuarioResponsable,
                IFNULL(so.nombreSucursal, 'Sin Origen') AS sucursalOrigen,
                IFNULL(sd.nombreSucursal, 'Sin Destino') AS sucursalDestino
            FROM MOVIMIENTO_MERCADERIA m
            INNER JOIN PRODUCTO p ON m.id_producto = p.id_producto
            LEFT JOIN USUARIO u ON m.id_usuario = u.id_usuario
            LEFT JOIN SUCURSAL so ON m.id_sucursalOrigen = so.id_sucursal
            LEFT JOIN SUCURSAL sd ON m.id_sucursalDestino = sd.id_sucursal
            ORDER BY m.fechaMov DESC
            LIMIT 500
        `;

        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        console.error('Error Movimientos:', error);
        res.status(500).json({ error: 'Error al obtener el historial de movimientos de bodega' });
    }
});

// DELETE /api/reportes/movimientos-inventario/:id
router.delete('/movimientos-inventario/:id', verificarToken, esAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute('DELETE FROM MOVIMIENTO_MERCADERIA WHERE id_movimiento = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro de movimiento no encontrado' });
        }

        res.json({ mensaje: 'Registro de movimiento eliminado del historial exitosamente' });
    } catch (error) {
        console.error('Error al eliminar movimiento:', error);
        res.status(500).json({ error: 'Error al intentar eliminar el registro de movimiento' });
    }
});

// POST /api/reportes/movimientos-inventario/limpiar-todo
router.post('/movimientos-inventario/limpiar-todo', verificarToken, esAdmin, async (req, res) => {
    try {
        await db.execute('DELETE FROM MOVIMIENTO_MERCADERIA');
        res.json({ ok: true, mensaje: 'Historial de movimientos limpiado por completo' });
    } catch (error) {
        console.error('Error al limpiar historial:', error);
        res.status(500).json({ error: 'Error al intentar limpiar el historial de movimientos' });
    }
});

module.exports = router;
