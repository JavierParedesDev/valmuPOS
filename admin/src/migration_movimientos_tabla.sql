-- ============================================================
-- MIGRACIÓN: Tablas para Auditoría de Stock y Movimientos
-- ============================================================

CREATE TABLE IF NOT EXISTS `MOVIMIENTO_MERCADERIA` (
    `id_movimiento`     INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_producto`       INT NOT NULL,
    `id_usuario`        INT NULL,
    `id_sucursalOrigen` INT NOT NULL,
    `id_sucursalDestino`INT NOT NULL,
    `tipoMovimiento`    VARCHAR(50) NOT NULL, -- 'INGRESO', 'TRASLADO', 'VENTA', 'AJUSTE', 'ANULACION'
    `cantidadMov`       DECIMAL(10,2) NOT NULL,
    `comprobanteMov`    VARCHAR(50) NULL, -- Folio de venta, nro de guía, etc
    `fechaMov`          DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT `fk_mov_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTO` (`id_producto`),
    CONSTRAINT `fk_mov_usuario`  FOREIGN KEY (`id_usuario`)  REFERENCES `USUARIO` (`id_usuario`),
    CONSTRAINT `fk_mov_sucursal_o` FOREIGN KEY (`id_sucursalOrigen`) REFERENCES `SUCURSAL` (`id_sucursal`),
    CONSTRAINT `fk_mov_sucursal_d` FOREIGN KEY (`id_sucursalDestino`) REFERENCES `SUCURSAL` (`id_sucursal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
