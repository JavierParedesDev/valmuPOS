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

// --- ENDPOINT: ELIMINAR UN REGISTRO DE MOVIMIENTO (LIMPIAR HISTORIAL) ---
// DELETE /api/reportes/movimientos-inventario/:id
router.delete('/movimientos-inventario/:id', verificarToken, esAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [resultado] = await db.query('DELETE FROM MOVIMIENTO_MERCADERIA WHERE id_movimiento = ?', [id]);

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
        await db.query('DELETE FROM MOVIMIENTO_MERCADERIA');
        res.json({ ok: true, mensaje: 'Historial de movimientos limpiado por completo' });
    } catch (error) {
        console.error('Error al limpiar historial:', error);
        res.status(500).json({ error: 'Error al intentar limpiar el historial de movimientos' });
    }
});

module.exports = router;
