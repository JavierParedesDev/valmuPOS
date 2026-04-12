using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using SimpleRutDesktop.Models;

namespace SimpleRutDesktop.Services;

public sealed class SimpleApiRutService
{
    private readonly HttpClient _httpClient;

    public SimpleApiRutService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<RutLookupResult> QueryRutAsync(string rut, AppSettings settings, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            throw new InvalidOperationException("Debes ingresar la API key de SimpleAPI.");
        }

        if (string.IsNullOrWhiteSpace(settings.RutEndpointTemplate) || !settings.RutEndpointTemplate.Contains("{rut}", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("La URL de consulta debe incluir el marcador {rut}.");
        }

        var cleanRut = NormalizeRut(rut);
        var requestUrl = settings.RutEndpointTemplate.Replace("{rut}", Uri.EscapeDataString(cleanRut), StringComparison.Ordinal);

        using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
        await ApplyAuthenticationAsync(request, settings, cancellationToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Consulta fallida ({(int)response.StatusCode}).{Environment.NewLine}" +
                $"URL: {requestUrl}{Environment.NewLine}" +
                $"Respuesta: {body}");
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            throw new InvalidOperationException("SimpleAPI respondió sin contenido.");
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            return MapResult(cleanRut, document.RootElement, body);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("SimpleAPI no devolvió JSON válido. Revisa el endpoint configurado.");
        }
    }

    public static string NormalizeRut(string rut)
    {
        var source = (rut ?? string.Empty).Trim().ToUpperInvariant();
        var compact = new string(source.Where(ch => char.IsLetterOrDigit(ch)).ToArray());

        if (compact.Length <= 1)
        {
            return compact;
        }

        var body = compact[..^1];
        var dv = compact[^1];
        return $"{body}-{dv}";
    }

    private async Task ApplyAuthenticationAsync(HttpRequestMessage request, AppSettings settings, CancellationToken cancellationToken)
    {
        if (string.Equals(settings.AuthMode, "XApiKey", StringComparison.OrdinalIgnoreCase))
        {
            request.Headers.TryAddWithoutValidation("x-api-key", settings.ApiKey.Trim());
            return;
        }

        request.Headers.Authorization = await BuildAuthorizationHeaderAsync(settings, cancellationToken);
    }

    private async Task<AuthenticationHeaderValue> BuildAuthorizationHeaderAsync(AppSettings settings, CancellationToken cancellationToken)
    {
        if (string.Equals(settings.AuthMode, "BasicApiKey", StringComparison.OrdinalIgnoreCase))
        {
            var raw = Convert.ToBase64String(Encoding.UTF8.GetBytes($"api:{settings.ApiKey.Trim()}"));
            return new AuthenticationHeaderValue("Basic", raw);
        }

        if (string.IsNullOrWhiteSpace(settings.TokenUrl))
        {
            throw new InvalidOperationException("Debes indicar la URL del token para modo Bearer.");
        }

        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, settings.TokenUrl.Trim());
        tokenRequest.Content = new StringContent(
            JsonSerializer.Serialize(new { apikey = settings.ApiKey.Trim() }),
            Encoding.UTF8,
            "application/json");

        using var tokenResponse = await _httpClient.SendAsync(tokenRequest, cancellationToken);
        var tokenBody = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);

        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"No se pudo obtener token ({(int)tokenResponse.StatusCode}): {tokenBody}");
        }

        var token = tokenBody.Trim().Trim('"');
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("SimpleAPI devolvió un token vacío.");
        }

        return new AuthenticationHeaderValue("Bearer", token);
    }

    private static RutLookupResult MapResult(string rut, JsonElement root, string rawJson)
    {
        var mainActivity = FirstArrayItem(root, "actividadesEconomicas");
        var mainAddress = BestAddressItem(root, "domicilios");

        return new RutLookupResult
        {
            Rut = FirstString(root, ["rut", "RUT", "rutContribuyente", "rut_cliente"]) ?? rut,
            RazonSocial = FirstString(root, ["razonSocial", "RazonSocial", "nombre", "business_name", "nombreCliente", "RznSoc", "RznSocRecep"]) ?? string.Empty,
            Giro = FirstString(mainActivity, ["descripcion", "giro", "Giro", "giroCliente", "actividad", "actividadEconomica", "GiroEmis", "GiroRecep"]) ?? string.Empty,
            Direccion = FirstString(mainAddress, ["direccion", "Direccion", "address", "domicilio", "DirOrigen", "DirRecep"]) ?? string.Empty,
            Comuna = FirstString(mainAddress, ["comuna", "Comuna", "CmnaOrigen", "CmnaRecep"]) ?? string.Empty,
            Ciudad = FirstString(mainAddress, ["ciudad", "Ciudad", "city", "CiudadOrigen", "CiudadRecep"]) ?? string.Empty,
            Correo = FirstString(root, ["correoIntercambio", "correo", "email", "Correo", "CorreoEmisor"]) ?? string.Empty,
            Telefono = FirstString(root, ["telefono", "Telefono", "phone", "fono"]) ?? string.Empty,
            RawJson = PrettyJson(rawJson)
        };
    }

    private static JsonElement FirstArrayItem(JsonElement element, string propertyName)
    {
        if (TryFindProperty(element, propertyName, out var found) &&
            found.ValueKind == JsonValueKind.Array &&
            found.GetArrayLength() > 0)
        {
            return found.EnumerateArray().First();
        }

        return default;
    }

    private static JsonElement BestAddressItem(JsonElement element, string propertyName)
    {
        if (!TryFindProperty(element, propertyName, out var found) || found.ValueKind != JsonValueKind.Array || found.GetArrayLength() == 0)
        {
            return default;
        }

        JsonElement best = default;
        var bestScore = -1;

        foreach (var item in found.EnumerateArray())
        {
            var score = 0;
            if (!string.IsNullOrWhiteSpace(FirstString(item, ["direccion", "Direccion", "address", "domicilio"]))) score += 3;
            if (!string.IsNullOrWhiteSpace(FirstString(item, ["comuna", "Comuna"]))) score += 2;
            if (!string.IsNullOrWhiteSpace(FirstString(item, ["ciudad", "Ciudad", "city"]))) score += 1;

            if (score > bestScore)
            {
                best = item;
                bestScore = score;
            }
        }

        return best;
    }

    private static string? FirstString(JsonElement element, string[] candidateNames)
    {
        foreach (var name in candidateNames)
        {
            if (TryFindProperty(element, name, out var found))
            {
                return ValueAsString(found);
            }
        }

        return null;
    }

    private static bool TryFindProperty(JsonElement element, string propertyName, out JsonElement value)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    value = property.Value;
                    return true;
                }

                if (TryFindProperty(property.Value, propertyName, out value))
                {
                    return true;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                if (TryFindProperty(item, propertyName, out value))
                {
                    return true;
                }
            }
        }

        value = default;
        return false;
    }

    private static string ValueAsString(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.Number => element.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => element.ToString()
        };
    }

    private static string PrettyJson(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions { WriteIndented = true });
        }
        catch
        {
            return json;
        }
    }
}
