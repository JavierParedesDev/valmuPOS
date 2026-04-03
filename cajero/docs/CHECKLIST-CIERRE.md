# Checklist de Cierre · Valmu Cajero

## Objetivo

Esta checklist sirve para validar el cajero en uso real antes de darlo por listo.

La idea es probar en este orden:

1. sesion
2. caja
3. venta
4. impresion
5. despachos
6. segunda pantalla
7. cierre de caja

## 1. Sesion

- [ ] El login acepta usuario y contrasena validos.
- [ ] Si las credenciales fallan, muestra mensaje claro.
- [ ] Si existe sesion valida, el cajero entra sin romper la interfaz.
- [ ] Si hay error al bootear la sesion, vuelve al login y muestra mensaje.
- [ ] Al cerrar sesion, limpia carrito, caja local, historial local y comprobantes.

## 2. Caja y Turno

- [ ] Si la caja esta cerrada, bloquea la venta.
- [ ] Si la caja esta abierta, no vuelve a pedir fondo inicial.
- [ ] Al abrir caja, registra fondo inicial correcto.
- [ ] Si se cierra la app y se vuelve a abrir con caja abierta, recupera turno correcto.
- [ ] Si se cierra caja, obliga a volver a login.
- [ ] Al volver a entrar despues de cerrar caja, pide abrir caja otra vez.

## 3. Venta Mostrador

- [ ] Buscar producto por nombre.
- [ ] Buscar producto por codigo.
- [ ] Agregar producto normal.
- [ ] Agregar producto pesable.
- [ ] Editar peso de producto pesable.
- [ ] Bloquear productos sin stock.
- [ ] Mostrar aviso de stock en otras sucursales.
- [ ] Calcular subtotal, IVA y total correctamente.
- [ ] Vaciar venta sin errores.

## 4. Cobro

- [ ] Cobrar boleta en efectivo.
- [ ] Cobrar boleta en tarjeta.
- [ ] Cobrar boleta en transferencia.
- [ ] Cobrar factura con cliente existente.
- [ ] Crear cliente rapido y cobrar factura.
- [ ] Cobrar vale interno.
- [ ] Despues de vender, el carrito queda vacio.
- [ ] La venta aparece en historial.
- [ ] El arqueo del turno suma correcto por medio de pago.

## 5. Anulacion

- [ ] Anular una venta activa.
- [ ] Exigir motivo al anular.
- [ ] Mover la venta a la pestaña Anuladas.
- [ ] Ajustar arqueo del turno al anular.
- [ ] Mantener trazabilidad del motivo en historial.

## 6. Impresion

- [ ] Imprimir automatico al vender.
- [ ] Reimprimir comprobante desde historial.
- [ ] Verificar lectura en papel 58mm.
- [ ] Verificar logo.
- [ ] Verificar detalle de productos.
- [ ] Verificar subtotal, IVA y total.
- [ ] Verificar comprobante de despacho.

## 7. Despachos

- [ ] Cargar transportistas reales desde backend.
- [ ] Buscar productos para despacho.
- [ ] Agregar productos al carrito de despacho.
- [ ] Generar despacho real con `POST /despachos/generar`.
- [ ] Descontar stock real al generar.
- [ ] Mostrar el despacho en historial.
- [ ] Imprimir vale de despacho.
- [ ] Reimprimir vale desde historial.

Nota:
La rendicion del transportista no pertenece al cajero y queda fuera de esta checklist.

## 8. Segunda Pantalla

- [ ] Abrir pantalla cliente desde Ajustes.
- [ ] Cerrar pantalla cliente desde Ajustes.
- [ ] Mostrar compra en vivo cuando hay items.
- [ ] Mostrar total correcto.
- [ ] Mostrar documento y cliente.
- [ ] Si no hay publicidad, no mostrar bloque publicitario.
- [ ] Si hay publicidad y no hay items, mostrar salvapantalla.
- [ ] Si hay publicidad y hay items, mostrar banner arriba del total.
- [ ] Rotar publicidad si hay varias imagenes.

## 9. Cierre de Caja

- [ ] Mostrar efectivo esperado.
- [ ] Mostrar tarjeta esperada.
- [ ] Mostrar transferencia esperada.
- [ ] Mostrar vale interno no fiscal.
- [ ] Permitir ingresar montos contados.
- [ ] Calcular diferencias correctamente.
- [ ] Cerrar caja contra backend.
- [ ] Volver al login al cerrar.

## 10. Casos de Error

- [ ] Desconectar backend y validar mensajes claros.
- [ ] Intentar vender sin stock.
- [ ] Intentar cobrar con caja cerrada.
- [ ] Intentar generar despacho sin transportista.
- [ ] Intentar abrir caja dos veces.
- [ ] Validar que la UI no quede congelada ante errores.

## Criterio de Listo

Podemos considerar `cajero` listo cuando:

- toda esta checklist pase en pruebas reales
- la impresion salga bien de forma consistente
- la segunda pantalla se comporte estable
- no aparezcan errores graves de sesion o caja

## Pendiente Mayor

La unica integracion grande que queda fuera del cierre operativo es:

- SII real para boleta y factura electronica
