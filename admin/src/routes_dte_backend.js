// =========================================================================
// MÓDULO: RUTAS DE DTE (Documentos Tributarios Electrónicos)
// Pegar este archivo en tu carpeta routes/ como: routes/dte.js
// Y registrarlo en app.js/server.js con:
//   const dteRoutes = require('./routes/dte');
//   app.use('/api/dte', dteRoutes);
// =========================================================================
const express = require('express');
const db = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// ── GUARDAR DTE EN SERVIDOR ─────────────────────────────────────────────────
// POST /api/dte/guardar
router.post('/guardar', verificarToken, async (req, res) => {
    try {
        const { id_venta, tipoDte, folio, xmlContenido, trackId, estadoSii } = req.body;

        if (!tipoDte || !folio || !xmlContenido) {
            return res.status(400).json({
                error: 'Los campos tipoDte, folio y xmlContenido son obligatorios'
            });
        }

        // Verificar si ya existe (evitar duplicados)
        const [existing] = await db.execute(
            'SELECT id_xml FROM DTE_DOCUMENTO WHERE tipoDte = ? AND folio = ?',
            [tipoDte, folio]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: 'Ya existe un DTE con ese tipo y folio en el servidor',
                id_xml: existing[0].id_xml
            });
        }

        const [resultado] = await db.execute(`
            INSERT INTO DTE_DOCUMENTO 
                (id_venta, tipoDte, folio, xmlContenido, trackId, estadoSii, fechaGuardado)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
            id_venta || null,
            Number(tipoDte),
            Number(folio),
            xmlContenido,
            trackId || null,
            estadoSii || 'GENERADO'
        ]);

        res.status(201).json({
            mensaje: 'DTE guardado exitosamente en el servidor',
            id_xml: resultado.insertId
        });
    } catch (error) {
        console.error('[DTE] Error al guardar:', error);
        res.status(500).json({ error: 'Error interno al guardar el DTE' });
    }
});

// ── ACTUALIZAR ESTADO DE DTE ────────────────────────────────────────────────
// PUT /api/dte/:id/estado
router.put('/:id/estado', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estadoSii, trackId } = req.body;

        if (!estadoSii) {
            return res.status(400).json({ error: 'El campo estadoSii es obligatorio' });
        }

        await db.execute(
            'UPDATE DTE_DOCUMENTO SET estadoSii = ?, trackId = COALESCE(?, trackId) WHERE id_xml = ?',
            [estadoSii, trackId || null, id]
        );

        res.json({ mensaje: 'Estado del DTE actualizado correctamente' });
    } catch (error) {
        console.error('[DTE] Error al actualizar estado:', error);
        res.status(500).json({ error: 'Error al actualizar el estado del DTE' });
    }
});

// ── LISTAR DTEs DEL SERVIDOR ────────────────────────────────────────────────
// GET /api/storage/list
router.get('/list', verificarToken, async (req, res) => {
    try {
        const [docs] = await db.execute(`
            SELECT 
                d.id_xml,
                d.id_venta,
                d.tipoDte   AS doc_type,
                d.folio,
                d.trackId,
                d.estadoSii AS sii_status,
                d.fechaGuardado AS created_at,
                v.total     AS total_amount,
                v.estadoSii AS sale_status
            FROM DTE_DOCUMENTO d
            LEFT JOIN VENTA v ON d.id_venta = v.id_venta
            ORDER BY d.fechaGuardado DESC
        `);

        res.json(docs);
    } catch (error) {
        console.error('[DTE] Error al listar:', error);
        res.status(500).json({ error: 'Error al obtener los documentos DTE' });
    }
});

// ── OBTENER XML RAW DE UN DTE ───────────────────────────────────────────────
// GET /api/dte/:id/xml
router.get('/:id/xml', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            'SELECT xmlContenido, tipoDte, folio FROM DTE_DOCUMENTO WHERE id_xml = ?',
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'DTE no encontrado' });
        }

        const { xmlContenido, tipoDte, folio } = rows[0];
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="DTE_${tipoDte}_Folio_${folio}.xml"`);
        res.send(xmlContenido);
    } catch (error) {
        console.error('[DTE] Error al obtener XML:', error);
        res.status(500).json({ error: 'Error al obtener el XML del DTE' });
    }
});

module.exports = router;
