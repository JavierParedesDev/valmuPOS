# Cajero

Proyecto base para el software de caja de Valmu.

## Objetivo

Construir un sistema de cajero rapido, estable y operable casi por completo con teclado o lector de codigo de barras, enfocado en flujo de ventas continuo, arqueo de caja, emision de documentos y soporte para hardware de punto de venta.

## Alcance principal

- Apertura y cierre de caja por turno
- Venta rapida con escaner y busqueda manual
- Carrito con precios dinamicos, productos pesables y multiples medios de pago
- Emision de boletas, facturas y vales internos
- Clientes express para facturacion
- Gestion de despachos y transportistas
- Impresion termica y pantalla secundaria para cliente

## Estructura inicial

- `docs/`: requerimientos, arquitectura y roadmap
- `src/main/`: proceso principal de escritorio y hardware
- `src/preload/`: bridge seguro entre UI y capa nativa
- `src/renderer/`: interfaz del cajero
- `src/shared/`: contratos, constantes y modelos compartidos

## Enfoque recomendado

Se recomienda desarrollar `cajero` como aplicacion de escritorio Electron, con prioridad en:

- operacion offline/local-first
- baja latencia al escanear
- accesibilidad por teclado
- recuperacion segura ante caidas
- integracion desacoplada con SII, impresora termica y segunda pantalla
