# Despachos en Cajero

## Objetivo

El modulo de despachos debe permitir que el cajero o encargado prepare una carga para un transportista sin mezclar esa operacion con la venta mostrador normal.

La idea correcta es tratar despacho como un flujo aparte del POS tradicional:

1. Seleccionar transportista o chofer.
2. Crear un despacho en borrador.
3. Escanear productos que van al camion.
4. Confirmar cantidades cargadas.
5. Emitir un comprobante de ruta.
6. Dejar la carga pendiente de rendicion.

## Principios operativos

- Un despacho no debe vivir dentro del carrito normal de caja.
- El despacho necesita su propio estado y sus propios documentos.
- La mercaderia cargada debe quedar trazable por chofer, sucursal y hora.
- El dinero rendido despues debe poder compararse con lo despachado.
- Si despues se conecta SII, la salida fiscal debe enchufarse sobre este flujo y no al reves.

## Entidades recomendadas

### Transportista

- `id_transportista`
- `nombre`
- `rut`
- `patente`
- `telefono`
- `estado`

### Despacho

- `id_despacho`
- `id_transportista`
- `id_usuario`
- `id_sucursal`
- `estado`
- `tipoDocumento`
- `fechaCreacion`
- `fechaSalida`
- `fechaRendicion`
- `subtotal`
- `iva`
- `total`

Estados sugeridos:

- `BORRADOR`
- `CARGADO`
- `EN_RUTA`
- `RENDIDO`
- `ANULADO`

### Detalle despacho

- `id_despacho`
- `id_producto`
- `cantidad`
- `precioVenta`
- `subtotalLinea`

### Rendicion

- `id_despacho`
- `montoEfectivo`
- `montoTarjeta`
- `montoTransferencia`
- `diferencia`
- `observacion`

## Flujo recomendado

### 1. Crear despacho

El operador entra a la vista `Despachos` y selecciona transportista.

El sistema crea un borrador:

- sucursal actual
- usuario logueado
- transportista seleccionado
- estado `BORRADOR`

### 2. Cargar productos

Se usa un escaner igual que en venta, pero sobre un carrito de despacho separado.

Reglas:

- validar stock en la sucursal actual
- permitir pesables
- permitir precios mayoristas si el negocio lo necesita
- bloquear productos sin stock

### 3. Confirmar salida

Cuando la carga esta lista:

- se confirma el despacho
- se emite `Vale interno` o `Guia referencial`
- el estado pasa a `EN_RUTA`
- se descuenta stock

## Documento sugerido por ahora

Mientras no exista integracion fiscal:

- `Vale de despacho interno`
- `Guia referencial de carga`

Debe mostrar:

- chofer
- patente
- sucursal
- fecha y hora
- detalle de productos
- total referencial
- observaciones

## Rendicion al regreso

Cuando el transportista vuelve:

1. Se abre el despacho.
2. Se ingresan montos rendidos por medio de pago.
3. El sistema calcula diferencia.
4. Se registra observacion.
5. El estado pasa a `RENDIDO`.

## Arquitectura recomendada

Cuando empecemos a construirlo, conviene respetar la misma separacion del POS:

- `src/renderer/domain/dispatch-domain.js`
- `src/renderer/services/dispatch-service.js`
- `src/renderer/ui/dispatch-view.js`
- `src/renderer/ui/dispatch-modal-view.js`

## Alcance sugerido por fases

### Fase 1 de despachos

- vista `Despachos`
- seleccionar chofer
- cargar productos
- emitir vale interno de ruta

### Fase 2 de despachos

- rendicion del chofer
- arqueo de ruta
- historial de despachos

### Fase 3 de despachos

- integracion documental/fiscal si aplica
- reimpresion
- reportes por transportista
