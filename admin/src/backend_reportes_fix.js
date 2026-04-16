const express = require('express');
const db = require('../config/db'); // Ajusta segun tu config
const { verificarToken } = require('../middlewares/authMiddleware'); // Ajusta segun tu config

const router = express.Router();

// Middleware para validar si es admin (ajustar segun tu logica de perfiles)
const esAdmin = (req, res, next) => {
    if (req.usuario && (req.usuario.id_perfil === 1 || req.usuario.rol === 'admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
};

// --- ENDPOINT: MONITOREO DE MOVIMIENTOS (AUDITORÍA DE BODEGA) ---
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
                p.esPesable,
                IFNULL(u.nombreCompleto, 'Sistema Automático') as usuarioResponsable,
                so.nombreSucursal as sucursalOrigen,
                sd.nombreSucursal as sucursalDestino
            FROM MOVIMIENTO_MERCADERIA m
            INNER JOIN PRODUCTO p ON m.id_producto = p.id_producto
            LEFT JOIN USUARIO u ON m.id_usuario = u.id_usuario
            INNER JOIN SUCURSAL so ON m.id_sucursalOrigen = so.id_sucursal
            INNER JOIN SUCURSAL sd ON m.id_sucursalDestino = sd.id_sucursal
            ORDER BY m.fechaMov DESC
            LIMIT 500
        `;
        const [movimientos] = await db.execute(query);
        res.json(movimientos);
    } catch (error) {
        console.error('Error Reporte Movimientos:', error);
        res.status(500).json({ error: 'Error al obtener el historial de movimientos de bodega. ¿Ejecutaste el SQL de la tabla?' });
    }
});

// --- ENDPOINT: ELIMINAR UN REGISTRO DE MOVIMIENTO (LIMPIAR HISTORIAL) ---
// DELETE /api/reportes/movimientos-inventario/:id
router.delete('/movimientos-inventario/:id', verificarToken, esAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [resultado] = await db.execute('DELETE FROM MOVIMIENTO_MERCADERIA WHERE id_movimiento = ?', [id]);
        
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro de movimiento no encontrado' });
        }

        res.json({ mensaje: 'Registro de movimiento eliminado del historial exitosamente' });
    } catch (error) {
        console.error('Error al eliminar movimiento:', error);
        res.status(500).json({ error: 'Error al intentar eliminar el registro de movimiento' });
    }
});

// --- ENDPOINT: LIMPIAR TODO EL HISTORIAL DE MOVIMIENTOS ---
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
