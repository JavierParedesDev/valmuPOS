# Cajero Architecture

## Objetivo

La arquitectura de `cajero` esta pensada para que el POS pueda crecer sin volver a caer en un `renderer.js` monolitico. La idea es separar:

- shell de Electron
- estado compartido
- reglas de negocio
- integraciones HTTP
- render de UI
- coordinacion de flujos

## Estructura actual

### Electron shell

- `src/main/`
  Ventana principal, IPC de escritorio, impresoras y consulta de updates.
- `src/preload/`
  Bridge seguro entre Electron y el renderer.

### Renderer

- `src/renderer/index.html`
  Estructura base del POS.
- `src/renderer/styles.css`
  Estilos de caja, touch y responsive.
- `src/renderer/renderer.js`
  Orquestador principal: bootstrap, wiring de eventos y coordinacion entre modulos.

### State

- `src/renderer/state/store.js`
  Estado compartido del POS y constantes de sesion.

### Domain

- `src/renderer/domain/pricing.js`
  Reglas de precios detalle, mayorista, pallet y familia promo.
- `src/renderer/domain/sale-domain.js`
  Snapshot del carrito, validacion de stock, payload de venta y descuento local.
- `src/renderer/domain/cart-domain.js`
  Operaciones puras del carrito.
- `src/renderer/domain/catalog-domain.js`
  Busqueda, normalizacion y mensajes de stock por sucursal.
- `src/renderer/domain/customer-domain.js`
  Normalizacion y seleccion de clientes.
- `src/renderer/domain/sales-history-domain.js`
  Normalizacion del historial y efecto de anulaciones.
- `src/renderer/domain/turn-domain.js`
  Calculos de arqueo y diferencias.
- `src/renderer/domain/turn-state-domain.js`
  Hidratacion y reseteo de resumen e historial del turno.
- `src/renderer/domain/weighted-domain.js`
  Estado y parseo de productos pesables.

### Services

- `src/renderer/services/auth-service.js`
  Login.
- `src/renderer/services/session-service.js`
  Acceso a `localStorage`.
- `src/renderer/services/settings-service.js`
  Persistencia de configuraciones.
- `src/renderer/services/catalog-service.js`
  Requests base de inventario, categorias y sucursales.
- `src/renderer/services/catalog-runtime-service.js`
  Coordinacion de carga real o fallback del catalogo.
- `src/renderer/services/cash-service.js`
  Estado, apertura y cierre de caja.
- `src/renderer/services/sales-service.js`
  Registrar venta, cargar historial y anular.
- `src/renderer/services/clientes-service.js`
  Listado y creacion rapida de clientes.

### UI

- `src/renderer/ui/app-view.js`
  Login, layout principal y navegacion visual.
- `src/renderer/ui/sale-view.js`
  Venta, busqueda, resumen y carrito.
- `src/renderer/ui/cash-view.js`
  Caja, arqueo, historial y ventas.
- `src/renderer/ui/modal-view.js`
  Modales operativos del POS.
- `src/renderer/ui/payment-view.js`
  Modal de cobro y vuelto.
- `src/renderer/ui/branch-view.js`
  Selector y badge de sucursal.

## Flujo recomendado

1. `renderer.js` recibe el evento del usuario.
2. Consulta o actualiza estado en `store.js`.
3. Usa `domain/*` para reglas puras.
4. Usa `services/*` para integración con backend o storage.
5. Usa `ui/*` para renderizar.

## Estado de Fase 3

La Fase 3 deja resuelto:

- modularizacion real de renderer
- separacion de reglas de negocio
- separacion de capa HTTP
- separacion de capa visual
- control mas claro del estado de sesion, caja y venta

Todavia pueden quedar residuos chicos de transicion dentro de `renderer.js`, pero el camino activo del sistema ya esta organizado sobre modulos separados.

## Regla para siguientes fases

Toda feature nueva debe entrar respetando esta ruta:

- si es regla de negocio: `domain/`
- si toca backend o storage: `services/`
- si es render o DOM: `ui/`
- si es solo coordinacion: `renderer.js`

Con eso el cajero puede seguir creciendo sin mezclar otra vez caja, ventas, clientes, hardware y documentos en un solo archivo.
