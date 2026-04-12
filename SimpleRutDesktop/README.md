# SimpleRutDesktop

Aplicación WinForms en .NET 8 para consultar un RUT usando SimpleAPI.

## Qué hace

- Guarda la API key localmente.
- Permite elegir autenticación por `Bearer Token` o `Basic api:apikey`.
- Consulta un RUT usando una URL configurable.
- Muestra los datos útiles para facturación:
  - RUT
  - Razón social
  - Giro
  - Dirección
  - Comuna
  - Ciudad
  - Correo
  - Teléfono
- Muestra además el JSON crudo de la respuesta.

## Ejecutar

```powershell
dotnet run --project .\SimpleRutDesktop\SimpleRutDesktop.csproj
```

## Configuración

La configuración se guarda en:

`%AppData%\SimpleRutDesktop\settings.json`

## Nota importante

La URL por defecto de consulta RUT fue dejada como plantilla configurable:

`https://api.simpleapi.cl/api/v1/contribuyentes/{rut}`

Si tu cuenta de SimpleAPI usa otra ruta real para consultar contribuyentes, solo cambia ese campo en la interfaz y vuelve a guardar.
