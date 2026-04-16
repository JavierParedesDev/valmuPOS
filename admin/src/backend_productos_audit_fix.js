// =========================================================================
// MÓDULO F: PRODUCTOS CON AUDITORÍA (INGRESO Y TRASLADO)
// COPIA ESTE CÓDIGO A TU BACKEND PARA HABILITAR EL REPORTE DE MOVIMIENTOS
// =========================================================================
const express = require('express');
const db = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// --- ENDPOINT: REGISTRAR INGRESO DE STOCK (COMPRAS) ---
// POST /api/productos/ingreso
router.post('/ingreso', verificarToken, async (req, res) => {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        const { id_producto, id_sucursal, cantidadIngreso, numeroFactura, id_usuario } = req.body;

        // 1. Aumentar Stock
        await conexion.execute(`
            INSERT INTO STOCK_INVENTARIO (id_producto, id_sucursal, cantidad)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)
        `, [id_producto, id_sucursal, cantidadIngreso]);

        // 2. AUDITORÍA: Registrar el movimiento
        // En ingreso, la sucursal origen no aplica (ponemos la misma o 0)
        await conexion.execute(`
            INSERT INTO MOVIMIENTO_MERCADERIA 
            (id_producto, id_usuario, id_sucursalOrigen, id_sucursalDestino, tipoMovimiento, cantidadMov, comprobanteMov)
            VALUES (?, ?, ?, ?, 'INGRESO', ?, ?)
        `, [id_producto, id_usuario || req.usuario.id_usuario, id_sucursal, id_sucursal, cantidadIngreso, numeroFactura]);

        await conexion.commit();
        res.json({ ok: true, mensaje: 'Ingreso registrado correctamente' });
    } catch (error) {
        await conexion.rollback();
        console.error('Error Ingreso:', error);
        res.status(500).json({ error: 'Error al registrar el ingreso' });
    } finally {
        conexion.release();
    }
});

// --- ENDPOINT: TRASLADO ENTRE SUCURSALES ---
// POST /api/productos/traslado
router.post('/traslado', verificarToken, async (req, res) => {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        const { id_producto, id_sucursalOrigen, id_sucursalDestino, cantidadMov, id_usuario } = req.body;

        // 1. Validar Stock Origen
        const [stockOri] = await conexion.execute(
            'SELECT cantidad FROM STOCK_INVENTARIO WHERE id_producto = ? AND id_sucursal = ?',
            [id_producto, id_sucursalOrigen]
        );

        if (!stockOri.length || stockOri[0].cantidad < cantidadMov) {
            return res.status(400).json({ error: 'Stock insuficiente en la sucursal de origen' });
        }

        // 2. Restar del Origen
        await conexion.execute(
            'UPDATE STOCK_INVENTARIO SET cantidad = cantidad - ? WHERE id_producto = ? AND id_sucursal = ?',
            [cantidadMov, id_producto, id_sucursalOrigen]
        );

        // 3. Sumar al Destino
        await conexion.execute(`
            INSERT INTO STOCK_INVENTARIO (id_producto, id_sucursal, cantidad)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)
        `, [id_producto, id_sucursalDestino, cantidadMov]);

        // 4. AUDITORÍA: Registrar el movimiento de traslado
        await conexion.execute(`
            INSERT INTO MOVIMIENTO_MERCADERIA 
            (id_producto, id_usuario, id_sucursalOrigen, id_sucursalDestino, tipoMovimiento, cantidadMov, comprobanteMov)
            VALUES (?, ?, ?, ?, 'TRASLADO', ?, 'Guía Traslado')
        `, [id_producto, id_usuario || req.usuario.id_usuario, id_sucursalOrigen, id_sucursalDestino, cantidadMov]);

        await conexion.commit();
        res.json({ ok: true, mensaje: 'Traslado realizado con éxito' });
    } catch (error) {
        await conexion.rollback();
        console.error('Error Traslado:', error);
        res.status(500).json({ error: 'Error interno al procesar el traslado' });
    } finally {
        conexion.release();
    }
});

module.exports = router;
