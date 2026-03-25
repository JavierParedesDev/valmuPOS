# Admin Architecture

## Objetivo

Dejar una base mas facil de escalar separando responsabilidades entre proceso principal, puente seguro y renderer.

## Capas

### Main process

- `src/main/main.js`: bootstrap liviano de Electron.
- `src/main/windows/`: creacion y estado de ventanas.
- `src/main/updater/`: ciclo de autoactualizacion y estado asociado.
- `src/main/ipc/`: definicion de canales y registro de handlers.
- `src/main/services/`: acceso a API y logica compartida del proceso principal.

### Preload

- `src/main/preload.js`: expone una API controlada al renderer usando canales centralizados.

### Renderer

- `src/renderer/js/app/`: bootstrap, navegacion y definicion de rutas.
- `src/renderer/js/services/`: sesion y acceso a API desde la UI.
- `src/renderer/js/views/`: modulos de cada vista.
- `src/renderer/js/utils.js`: helpers UI compartidos.

## Convenciones recomendadas

- Cada nueva capacidad del proceso principal debe vivir en su propio modulo, no crecer dentro de `main.js`.
- Todo canal IPC nuevo debe declararse en `src/main/ipc/channels.js`.
- Las vistas del renderer deben exponer una sola funcion `renderX`.
- La logica de datos debe ir en `services`; la manipulacion del DOM debe quedarse en `views`.
- No versionar artefactos generados como `release/` ni dependencias como `node_modules/`.

## Siguiente paso recomendado

El siguiente salto importante seria migrar el renderer desde scripts globales a modulos ES o Vite para eliminar dependencias implicitas entre archivos y habilitar pruebas/linting con mucha menos friccion.
