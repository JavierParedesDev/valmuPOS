
/**
 * BACKEND FIX: Gestión de Publicidad
 * Este archivo contiene los endpoints necesarios para que tanto el Admin
 * como la App Móvil puedan subir, activar/desactivar y eliminar anuncios.
 * 
 * INSTRUCCIONES:
 * 1. Copia el SQL de abajo y ejecútalo en tu base de datos.
 * 2. Agrega este código a tu servidor Express (ej: rutas/publicidad.js).
 */

/* 
-- SQL PARA CREAR LA TABLA DE PUBLICIDAD
CREATE TABLE IF NOT EXISTS `PUBLICIDAD` (
    `id_publicidad` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `titulo`        VARCHAR(100) NULL,
    `rutaImagen`    VARCHAR(255) NOT NULL,
    `activa`        TINYINT(1) DEFAULT 1,
    `fechaCreada`   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
*/

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db'); // Ajusta a tu configuración de base de datos
const { verificarToken } = require('./middleware'); // Ajusta a tu middleware

// Configuración de almacenamiento para imágenes de publicidad
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/publicidad';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'pub-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// GET /api/publicidad - Listar anuncios
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM PUBLICIDAD ORDER BY id_publicidad DESC');
        res.json({ ok: true, data: rows });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener publicidad' });
    }
});

// POST /api/publicidad - Subir nuevo anuncio
router.post('/', verificarToken, upload.single('imagen'), async (req, res) => {
    try {
        const { titulo } = req.body;
        const rutaImagen = '/uploads/publicidad/' + req.file.filename;

        const [result] = await db.execute(
            'INSERT INTO PUBLICIDAD (titulo, rutaImagen, activa) VALUES (?, ?, 1)',
            [titulo || 'Sin título', rutaImagen]
        );

        res.json({ 
            ok: true, 
            data: { id_publicidad: result.insertId, titulo, rutaImagen, activa: 1 } 
        });
    } catch (error) {
        console.error('Error al subir publicidad:', error);
        res.status(500).json({ error: 'Error al guardar en base de datos' });
    }
});

// PUT /api/publicidad/:id/estado - Activar/Desactivar
router.put('/:id/estado', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { activa } = req.body;
        await db.execute('UPDATE PUBLICIDAD SET activa = ? WHERE id_publicidad = ?', [activa, id]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// DELETE /api/publicidad/:id - Eliminar anuncio y su archivo físico
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Obtener la ruta del archivo antes de borrar el registro
        const [rows] = await db.execute('SELECT rutaImagen FROM PUBLICIDAD WHERE id_publicidad = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

        const rutaRelativa = rows[0].rutaImagen;
        const rutaAbsoluta = path.join(__dirname, '..', rutaRelativa); // Ajusta según tu estructura

        // 2. Borrar de la base de datos
        await db.execute('DELETE FROM PUBLICIDAD WHERE id_publicidad = ?', [id]);

        // 3. Borrar el archivo físico si existe
        if (fs.existsSync(rutaAbsoluta)) {
            fs.unlinkSync(rutaAbsoluta);
        }

        res.json({ ok: true, message: 'Publicidad eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar publicidad:', error);
        res.status(500).json({ error: ' Error al eliminar de la base de datos o archivo' });
    }
});

module.exports = router;
