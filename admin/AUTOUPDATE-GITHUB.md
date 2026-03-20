# Auto Update Admin

`Valmu Admin` ya quedo preparado para autoactualizarse desde GitHub Releases.

## Que pasa en el cliente

- El cliente instala una vez el setup.
- Cada vez que abre la app, `Valmu Admin` revisa si hay una version nueva.
- Si existe, la descarga sola.
- Cuando termina, pide reiniciar para aplicar la actualizacion.

## Que debes hacer para publicar una nueva version

Abre terminal dentro de `admin`.

### 1. Sube la version

Para una correccion chica:

```powershell
npm run version:patch
```

Para una mejora mediana:

```powershell
npm run version:minor
```

Para una version grande:

```powershell
npm run version:major
```

### 2. Haz commit de la nueva version

```powershell
git add package.json package-lock.json
git commit -m "Release admin x.y.z"
git push origin main
```

## 3. Publica la release en GitHub

Necesitas un token de GitHub con permiso para `repo`.

```powershell
$env:GH_TOKEN="TU_TOKEN"
npm run dist:publish
```

Eso genera:

- instalador NSIS de Windows
- archivos `latest.yml`
- publicacion en GitHub Releases del repo `JavierParedesDev/valmuPOS`

## Importante

- La autoactualizacion funciona desde la segunda version instalada en adelante.
- El cliente no necesita volver a instalar manualmente cada update.
- Si cambias el repo o el owner de GitHub, debes actualizar `build.publish` en `package.json`.
