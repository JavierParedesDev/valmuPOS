// =========================================================================
// MÓDULO E: RUTAS DE VENTAS Y POS (CON VALIDACIÓN DE STOCK)
// ARCHIVO DE REFERENCIA - COPIA ESTE CÓDIGO A TU BACKEND
// =========================================================================
const express = require('express');
const db = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// --- ENDPOINT: REGISTRAR UNA VENTA (Transacción Compleja y Segura) ---
// POST /api/ventas
router.post('/', verificarToken, async (req, res) => {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();

        const { id_usuario, id_sucursal } = req.usuario;
        const { id_cliente, id_tipoDoc, folioDocumento, subtotal, iva, total, metodoPago, montoPago, carrito } = req.body;

        // 1. BLINDAJE: Verificar si hay stock suficiente para TODO el carrito antes de hacer nada
        for (const item of carrito) {
            const [stockActual] = await conexion.execute(
                'SELECT cantidad, p.nombreProducto FROM STOCK_INVENTARIO s INNER JOIN PRODUCTO p ON s.id_producto = p.id_producto WHERE s.id_producto = ? AND s.id_sucursal = ? FOR UPDATE',
                [item.id_producto, id_sucursal]
            );

            // Si no existe registro de stock o la cantidad que intentan vender es mayor a la disponible
            if (stockActual.length === 0 || stockActual[0].cantidad < item.cantidad) {
                await conexion.rollback();
                return res.status(400).json({
                    error: `Stock insuficiente para el producto: ${stockActual.length > 0 ? stockActual[0].nombreProducto : 'ID ' + item.id_producto}. Stock actual: ${stockActual.length > 0 ? stockActual[0].cantidad : 0}`
                });
            }
        }

        // 2. Insertar la cabecera de la VENTA
        const [resVenta] = await conexion.execute(`
            INSERT INTO VENTA (id_usuario, id_cliente, id_tipoDoc, id_sucursal, folioDocumento, subtotal, iva, total, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')
        `, [id_usuario, id_cliente || null, id_tipoDoc, id_sucursal, folioDocumento || null, subtotal, iva, total]);

        const id_venta = resVenta.insertId;

        // 3. Procesar el Carrito (Iterar productos para descontar y guardar detalle)
        for (const item of carrito) {
            // A. Obtener el costo actual del producto para "congelarlo"
            const [prodInfo] = await conexion.execute('SELECT precioCosto FROM PRODUCTO WHERE id_producto = ?', [item.id_producto]);
            const costoHistorico = prodInfo.length > 0 ? prodInfo[0].precioCosto : 0;

            // B. Insertar en DETALLE_VENTA
            await conexion.execute(`
                INSERT INTO DETALLE_VENTA (id_venta, id_producto, cantidadVenta, precioVenta, precioCostoVenta, subtotalLinea)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id_venta, item.id_producto, item.cantidad, item.precioVenta, costoHistorico, item.subtotalLinea]);

            // C. Descontar Stock de INVENTARIO (Seguro, porque ya validamos en el Paso 1)
            await conexion.execute(`
                UPDATE STOCK_INVENTARIO SET cantidad = cantidad - ? 
                WHERE id_producto = ? AND id_sucursal = ?
            `, [item.cantidad, item.id_producto, id_sucursal]);
        }

        // 4. Registrar el Pago
        await conexion.execute(`
            INSERT INTO PAGO_VENTA (id_venta, metodoPago, montoPago)
            VALUES (?, ?, ?)
        `, [id_venta, metodoPago, montoPago]);

        // 5. Confirmar toda la transacción
        await conexion.commit();
        res.status(201).json({ mensaje: 'Venta registrada exitosamente', id_venta: id_venta });

    } catch (error) {
        await conexion.rollback(); // Si algo falla, deshace TODO (Venta, detalle, pago y stock)
        console.error('Error procesando venta:', error);
        res.status(500).json({ error: 'Error crítico al procesar la venta. Se ha revertido la operación.' });
    } finally {
        conexion.release();
    }
});

// --- ENDPOINT: HISTORIAL DE VENTAS ---
// GET /api/ventas
// GET /api/ventas?all=true (para administradores, trae todas las sucursales)
router.get('/', verificarToken, async (req, res) => {
    try {
        const { id_sucursal, rol } = req.usuario;
        const { all } = req.query; // Parámetro para traer todas las ventas

        let query = `
            SELECT 
                v.id_venta, 
                v.id_sucursal, 
                s.nombreSucursal,
                v.fechaVenta, 
                v.total, 
                v.estado,
                t.tipoDoc, 
                t.esFiscal, 
                p.metodoPago
            FROM VENTA v
            INNER JOIN TIPO_DOC t ON v.id_tipoDoc = t.id_tipoDoc
            INNER JOIN SUCURSAL s ON v.id_sucursal = s.id_sucursal
            LEFT JOIN PAGO_VENTA p ON v.id_venta = p.id_venta
        `;

        let params = [];

        // Si el usuario es Administrador y solicita 'all', no filtramos por sucursal
        if (all === 'true' && (rol === 'Administrador' || rol === 'Admin' || rol === 'admin')) {
            query += ` ORDER BY v.fechaVenta DESC LIMIT 10000`;
        } else {
            // De lo contrario, filtramos por la sucursal del usuario
            query += ` WHERE v.id_sucursal = ? ORDER BY v.fechaVenta DESC LIMIT 1000`;
            params = [id_sucursal];
        }

        const [ventas] = await db.execute(query, params);
        res.json(ventas);
    } catch (error) {
        console.error('Error al obtener historial de ventas:', error);
        res.status(500).json({ error: 'Error al obtener historial de ventas' });
    }
});

// --- ENDPOINT: ANULAR VENTA ---
// PUT /api/ventas/:id/anular
router.put('/:id/anular', verificarToken, async (req, res) => {
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        const { id } = req.params;

        // 1. Obtener detalles de la venta
        const [detalles] = await conexion.execute('SELECT id_producto, cantidadVenta FROM DETALLE_VENTA WHERE id_venta = ?', [id]);
        const [venta] = await conexion.execute('SELECT id_sucursal, estado FROM VENTA WHERE id_venta = ?', [id]);

        if (venta.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
        if (venta[0].estado === 'ANULADA') return res.status(400).json({ error: 'La venta ya se encuentra anulada' });

        const id_sucursal = venta[0].id_sucursal;

        // 2. Devolver el stock
        for (const item of detalles) {
            await conexion.execute(`
                UPDATE STOCK_INVENTARIO SET cantidad = cantidad + ? 
                WHERE id_producto = ? AND id_sucursal = ?
            `, [item.cantidadVenta, item.id_producto, id_sucursal]);
        }

        // 3. Cambiar estado a ANULADA
        await conexion.execute('UPDATE VENTA SET estado = "ANULADA" WHERE id_venta = ?', [id]);

        await conexion.commit();
        res.json({ mensaje: 'Venta anulada correctamente. Stock devuelto a inventario.' });

    } catch (error) {
        await conexion.rollback();
        console.error('Error anulando venta:', error);
        res.status(500).json({ error: 'Error al anular la venta' });
    } finally {
        conexion.release();
    }
});

module.exports = router;
