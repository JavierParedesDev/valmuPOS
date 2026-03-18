# APK Android

Esta app quedo preparada para instalarse como APK directo, sin pasar por Play Store.

## Configuracion aplicada

- Permiso de camara para scanner de codigos.
- Permisos Android de red y estado de red.
- `usesCleartextTraffic: true` porque la API actual usa `http://64.176.17.147:3000/api`.
- Perfil `apk` en `eas.json` para generar archivo `.apk`.

## Opcion recomendada: generar APK con EAS

1. Instala EAS CLI si no lo tienes:
   `npm install -g eas-cli`
2. Inicia sesion:
   `eas login`
3. Desde `app-valmu`, ejecuta:
   `npm run android:apk:eas`
4. Cuando termine, EAS te entrega un enlace para descargar el `.apk`.

## Opcion local con Android Studio

1. Instala Android Studio y SDK de Android.
2. Desde `app-valmu`, genera la carpeta nativa:
   `npm run android:prebuild`
3. Luego abre la carpeta `android` en Android Studio o ejecuta:
   `npx expo run:android`

## Instalar en el celular

1. Copia el `.apk` al telefono.
2. Activa "Instalar apps desconocidas" para el explorador o navegador que uses.
3. Abre el archivo `.apk` y confirma la instalacion.

## Nota importante

La API actual usa HTTP y no HTTPS. En Android moderno eso suele fallar si no se habilita trafico no cifrado. Esta app ya quedo configurada para permitirlo.
