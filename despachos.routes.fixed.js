// =========================================================================
// MODULO F: RUTAS DE DESPACHOS Y TRANSPORTE
// =========================================================================
const express = require('express');
const db = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function resolveLineBranchId(item, fallbackBranchId) {
    return toNumber(
        item.id_sucursal_carga ||
        item.id_sucursal_origen ||
        item.id_sucursal ||
        fallbackBranchId,
        fallbackBranchId
    );
}

function buildStockMovements(item, fallbackBranchId) {
    const totalQty = toNumber(item.cantidad, 0);
    const casaMatrizQty = toNumber(item.cantidad_casa_matriz, 0);
    const bodegaQty = toNumber(item.cantidad_bodega, 0);

    const casaMatrizBranchId = toNumber(
        item.id_sucursal_casa_matriz ||
        item.id_sucursal_origen ||
        item.id_sucursal_carga ||
        item.id_sucursal ||
        fallbackBranchId,
        fallbackBranchId
    );

    const bodegaBranchId = toNumber(
        item.id_sucursal_bodega ||
        item.id_sucursal_secundaria ||
        item.id_sucursal_origen_bodega ||
        0,
        0
    );

    const movements = [];

    if (casaMatrizQty > 0) {
        movements.push({
            id_producto: toNumber(item.id_producto),
            id_sucursal: casaMatrizBranchId,
            cantidad: casaMatrizQty
        });
    }

    if (bodegaQty > 0 && bodegaBranchId > 0) {
        movements.push({
            id_producto: toNumber(item.id_producto),
            id_sucursal: bodegaBranchId,
            cantidad: bodegaQty
        });
    }

    if (!movements.length && totalQty > 0) {
        movements.push({
            id_producto: toNumber(item.id_producto),
            id_sucursal: resolveLineBranchId(item, fallbackBranchId),
            cantidad: totalQty
        });
    }

    return movements.filter((movement) =>
        movement.id_producto > 0 &&
        movement.id_sucursal > 0 &&
        movement.cantidad > 0
    );
}

// GET /api/despachos/transportes
router.get('/transportes', verificarToken, async (req, res) => {
    try {
        const [transportes] = await db.execute('SELECT * FROM TRANSPORTE');
        res.json(transportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los transportistas' });
    }
});

// POST /api/despachos/transportes
router.post('/transportes', verificarToken, async (req, res) => {
    try {
        const { nombreTransporte, patenteTransporte } = req.body;

        if (!nombreTransporte || !patenteTransporte) {
            return res.status(400).json({ error: 'El nombre y la patente son obligatorios' });
        }

        const [resultado] = await db.execute(
            'INSERT INTO TRANSPORTE (nombreTransporte, patenteTransporte) VALUES (?, ?)',
            [nombreTransporte, patenteTransporte]
        );

        res.status(201).json({
            mensaje: 'Transportista agregado exitosamente',
            id_transporte: resultado.insertId
        });
    } catch (error) {
        console.error('Error al agregar transportista:', error);
        res.status(500).json({ error: 'Error al registrar el transportista' });
    }
});

// DELETE /api/despachos/transportes/:id
router.delete('/transportes/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM TRANSPORTE WHERE id_transporte = ?', [id]);
        res.json({ mensaje: 'Transportista eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar transportista:', error);
        if (error.errno === 1451) {
            return res.status(400).json({ error: 'No se puede eliminar porque tiene despachos asociados.' });
        }
        res.status(500).json({ error: 'Error al eliminar el transportista' });
    }
});

// GET /api/despachos
router.get('/', verificarToken, async (req, res) => {
    try {
        const [despachos] = await db.execute(`
            SELECT 
                d.id_despacho AS id,
                d.estadoDespacho AS estado,
                IFNULL(v.folioDocumento, CONCAT('Venta #', v.id_venta)) AS venta,
                v.fechaVenta AS fecha,
                v.total,
                t.nombreTransporte AS transporte,
                t.patenteTransporte
            FROM DESPACHO d
            INNER JOIN VENTA v ON d.id_venta = v.id_venta
            INNER JOIN TRANSPORTE t ON d.id_transporte = t.id_transporte
            ORDER BY v.fechaVenta DESC
            LIMIT 50
        `);

        res.json(despachos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el historial de despachos' });
    }
});

// PUT /api/despachos/:id/estado
router.put('/:id/estado', verificarToken, async (req, res) => {
    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const { id } = req.params;
        const { estado, metodoPago } = req.body;

        if (!estado) {
            await conexion.rollback();
            return res.status(400).json({ error: 'Debe enviar el nuevo estado' });
        }

        const [despachos] = await conexion.execute(
            `SELECT d.id_venta, v.total, v.estado AS estadoVenta, v.id_sucursal
             FROM DESPACHO d
             INNER JOIN VENTA v ON d.id_venta = v.id_venta
             WHERE d.id_despacho = ?
             FOR UPDATE`,
            [id]
        );

        if (despachos.length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: 'Despacho no encontrado' });
        }

        const { id_venta, total, estadoVenta, id_sucursal } = despachos[0];

        if (estadoVenta === 'COMPLETADA' || estadoVenta === 'ANULADA') {
            await conexion.rollback();
            return res.status(400).json({ error: 'Este despacho ya fue procesado y rendido anteriormente.' });
        }

        if (estado === 'ENTREGADO') {
            await conexion.execute(
                'UPDATE VENTA SET estado = "COMPLETADA" WHERE id_venta = ?',
                [id_venta]
            );

            await conexion.execute(
                'INSERT INTO PAGO_VENTA (id_venta, metodoPago, montoPago) VALUES (?, ?, ?)',
                [id_venta, metodoPago || 'EFECTIVO', total]
            );
        } else if (estado === 'CANCELADO') {
            const [detalles] = await conexion.execute(
                'SELECT id_producto, cantidadVenta FROM DETALLE_VENTA WHERE id_venta = ?',
                [id_venta]
            );

            for (const item of detalles) {
                await conexion.execute(
                    `UPDATE STOCK_INVENTARIO
                     SET cantidad = cantidad + ?
                     WHERE id_producto = ? AND id_sucursal = ?`,
                    [item.cantidadVenta, item.id_producto, id_sucursal]
                );
            }

            await conexion.execute(
                'UPDATE VENTA SET estado = "ANULADA" WHERE id_venta = ?',
                [id_venta]
            );
        }

        await conexion.execute(
            'UPDATE DESPACHO SET estadoDespacho = ? WHERE id_despacho = ?',
            [estado, id]
        );

        await conexion.commit();
        res.json({ mensaje: `Despacho marcado como ${estado} correctamente.` });
    } catch (error) {
        await conexion.rollback();
        console.error('Error al actualizar estado del despacho:', error);
        res.status(500).json({ error: 'Error interno al actualizar el estado del despacho' });
    } finally {
        conexion.release();
    }
});

// POST /api/despachos/generar
router.post('/generar', verificarToken, async (req, res) => {
    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        const { id_usuario, id_sucursal: idSucursalUsuario } = req.usuario;

        const {
            id_transporte,
            id_tipoDoc,
            id_cliente,
            id_sucursal,
            id_sucursal_carga,
            id_sucursal_origen,
            id_sucursal_casa_matriz,
            id_sucursal_bodega,
            folio_documento,
            subtotal,
            iva,
            total,
            carrito = []
        } = req.body;

        if (!id_transporte || !id_tipoDoc || !Array.isArray(carrito) || carrito.length === 0) {
            await conexion.rollback();
            return res.status(400).json({ error: 'Faltan datos para generar el despacho.' });
        }

        const idSucursalDespacho = toNumber(
            id_sucursal_carga ||
            id_sucursal_origen ||
            id_sucursal_casa_matriz ||
            id_sucursal ||
            idSucursalUsuario,
            idSucursalUsuario
        );

        if (!idSucursalDespacho) {
            await conexion.rollback();
            return res.status(400).json({ error: 'No se pudo resolver la sucursal de carga del despacho.' });
        }

        const stockMovements = [];

        for (const item of carrito) {
            const movements = buildStockMovements(
                {
                    ...item,
                    id_sucursal_casa_matriz: item.id_sucursal_casa_matriz || id_sucursal_casa_matriz,
                    id_sucursal_bodega: item.id_sucursal_bodega || id_sucursal_bodega
                },
                idSucursalDespacho
            );

            if (!movements.length) {
                await conexion.rollback();
                return res.status(400).json({ error: `Cantidad invalida para el producto ID ${item.id_producto}` });
            }

            stockMovements.push(...movements);
        }

        for (const movement of stockMovements) {
            const [stockActual] = await conexion.execute(
                `SELECT cantidad, p.nombreProducto
                 FROM STOCK_INVENTARIO s
                 INNER JOIN PRODUCTO p ON s.id_producto = p.id_producto
                 WHERE s.id_producto = ? AND s.id_sucursal = ?
                 FOR UPDATE`,
                [movement.id_producto, movement.id_sucursal]
            );

            const stockDisponible = stockActual.length > 0 ? toNumber(stockActual[0].cantidad, 0) : 0;

            if (stockDisponible < movement.cantidad) {
                await conexion.rollback();
                return res.status(400).json({
                    error: `Stock insuficiente para cargar: ${stockActual.length > 0 ? stockActual[0].nombreProducto : 'ID ' + movement.id_producto}. Sucursal validada: ${movement.id_sucursal}. Stock actual: ${stockDisponible}. Solicitado: ${movement.cantidad}.`
                });
            }
        }

        const [resVenta] = await conexion.execute(`
            INSERT INTO VENTA (id_usuario, id_cliente, id_tipoDoc, id_sucursal, folioDocumento, subtotal, iva, total, estado, origenVenta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_RUTA', 'DESPACHO')
        `, [
            id_usuario,
            id_cliente || null,
            id_tipoDoc,
            idSucursalDespacho,
            folio_documento || null,
            subtotal,
            iva,
            total
        ]);

        const id_venta = resVenta.insertId;

        for (const item of carrito) {
            const [prodInfo] = await conexion.execute(
                'SELECT precioCosto FROM PRODUCTO WHERE id_producto = ?',
                [item.id_producto]
            );

            const costoHistorico = prodInfo.length > 0 ? prodInfo[0].precioCosto : 0;

            await conexion.execute(`
                INSERT INTO DETALLE_VENTA (id_venta, id_producto, cantidadVenta, precioVenta, precioCostoVenta, subtotalLinea)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                id_venta,
                item.id_producto,
                item.cantidad,
                item.precioVenta,
                costoHistorico,
                item.subtotalLinea
            ]);
        }

        for (const movement of stockMovements) {
            await conexion.execute(`
                UPDATE STOCK_INVENTARIO
                SET cantidad = cantidad - ?
                WHERE id_producto = ? AND id_sucursal = ?
            `, [
                movement.cantidad,
                movement.id_producto,
                movement.id_sucursal
            ]);
        }

        const [resDespacho] = await conexion.execute(`
            INSERT INTO DESPACHO (id_venta, id_transporte, estadoDespacho)
            VALUES (?, ?, 'EN_RUTA')
        `, [id_venta, id_transporte]);

        await conexion.commit();

        res.status(201).json({
            mensaje: 'Despacho generado exitosamente',
            id_venta,
            id_despacho: resDespacho.insertId
        });
    } catch (error) {
        await conexion.rollback();
        console.error('Error procesando despacho:', error);
        res.status(500).json({ error: 'Error al procesar el despacho.' });
    } finally {
        conexion.release();
    }
});

module.exports = router;
