-- ============================================================
-- MIGRACIÓN: Tabla DTE_DOCUMENTO para respaldo de XMLs
-- Ejecutar este script en tu base de datos MySQL/MariaDB
-- ============================================================

CREATE TABLE IF NOT EXISTS `DTE_DOCUMENTO` (
    `id_xml`        INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_venta`      INT           NULL,                          -- FK opcional a VENTA
    `tipoDte`       SMALLINT      NOT NULL,                      -- 33=Factura, 56=ND, 61=NC, 39=Boleta
    `folio`         INT           NOT NULL,
    `xmlContenido`  LONGTEXT      NOT NULL,                      -- XML completo del DTE firmado
    `trackId`       VARCHAR(50)   NULL,                          -- TrackId del SII (si fue enviado)
    `estadoSii`     VARCHAR(30)   NOT NULL DEFAULT 'GENERADO',   -- GENERADO | ENVIADO_SII | ACEPTADO | RECHAZADO | ERROR_ENVIO
    `fechaGuardado` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Evitar duplicados
    UNIQUE KEY `uq_dte_tipo_folio` (`tipoDte`, `folio`),

    -- FK suave hacia VENTA (si existe)
    CONSTRAINT `fk_dte_venta`
        FOREIGN KEY (`id_venta`) REFERENCES `VENTA` (`id_venta`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Registro en tu app.js / server.js:
-- ============================================================
-- const dteRoutes = require('./routes/dte');
-- app.use('/api/dte',     dteRoutes);               // POST /guardar, PUT /:id/estado, GET /:id/xml
-- app.use('/api/storage', dteRoutes);               // GET /list
--
-- O si prefieres separar storage de dte:
-- const storageRoutes = require('./routes/dte');
-- app.use('/api/storage', storageRoutes);
-- app.use('/api/dte',     storageRoutes);
-- ============================================================
