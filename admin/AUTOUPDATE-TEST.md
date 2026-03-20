# Probar Auto Update

## Objetivo

Validar que una instalacion vieja de `Valmu Admin` detecta, descarga y aplica una version nueva sin reinstalar manualmente.

## Forma mas simple de probar

### 1. Instala una version base

Genera e instala una version, por ejemplo `1.0.0`.

```powershell
cd admin
npm run dist
```

Instala el `.exe` generado.

## 2. Publica una version nueva

Sube una nueva version, por ejemplo `1.0.1`.

```powershell
cd admin
npm run version:patch
git add package.json package-lock.json
git commit -m "Release admin 1.0.1"
git push origin main
$env:GH_TOKEN="TU_TOKEN"
npm run dist:publish
```

## 3. Prueba desde la app instalada

Abre la app que ya estaba instalada en el PC.

Luego usa:

- `Ayuda > Buscar actualizaciones`

Resultado esperado:

- si hay una nueva release, la app avisa que encontro una actualizacion
- la descarga sola
- al terminar, pide reiniciar
- al reiniciar, queda instalada la nueva version

## 4. Confirmacion visual

La ventana muestra la version en el titulo:

- `Valmu Admin 1.0.0`
- luego, tras actualizar, deberia verse `Valmu Admin 1.0.1`
