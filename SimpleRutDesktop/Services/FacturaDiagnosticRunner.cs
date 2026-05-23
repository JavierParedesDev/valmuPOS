using System.Net.Http.Headers;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;

namespace SimpleRutDesktop.Services;

public static class FacturaDiagnosticRunner
{
    private const string WrapUrl = "https://api.simpleapi.cl/api/v1/envio/generar";
    private const string SendUrl = "https://api.simpleapi.cl/api/v1/envio/enviar";
    private const string TokenUrl = "https://api.simpleapi.cl/api/auth/token";

    public static async Task<int> RunAsync(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("============================================================");
        Console.WriteLine(" DIAGNOSTICO FACTURA SIMPLEAPI / SII");
        Console.WriteLine("============================================================");
        Console.WriteLine("Esta prueba usa el XML de una factura ya generada por Valmu.");
        Console.WriteLine("Si SII acepta el envío, puede quedar enviada una factura real.");
        Console.WriteLine();

        var options = ParseArgs(args);
        var siiFolder = GetOption(options, "sii-folder")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "cajero", "sii_data");
        var facturasFolder = Path.Combine(siiFolder, "facturas");
        var configPath = GetOption(options, "config") ?? Path.Combine(siiFolder, "config.json");
        var viaBackend = HasOption(args, "via-backend");
        var backendUrl = GetOption(options, "backend-url") ?? "http://localhost:3000/api/diagnostico/factura/enviar";

        try
        {
            PrintStep("1", "Rutas de trabajo");
            Console.WriteLine($"sii-folder : {siiFolder}");
            Console.WriteLine($"config     : {configPath}");
            Console.WriteLine($"facturas   : {facturasFolder}");
            Console.WriteLine($"modo       : {(viaBackend ? "BACKEND API-VALMU" : "DIRECTO SIMPLEAPI")}");
            if (viaBackend) Console.WriteLine($"backendUrl : {backendUrl}");

            if (!File.Exists(configPath))
            {
                throw new FileNotFoundException("No existe config.json de SII.", configPath);
            }

            using var configDocument = JsonDocument.Parse(await File.ReadAllTextAsync(configPath));
            var config = configDocument.RootElement;

            var apiKey = ReadString(config, "apiKey");
            var rutEmisor = NormalizeRut(ReadString(config, "rutEmisor"));
            var rutEnvia = NormalizeRut(ReadString(config, "rutEnvia", "rutFirmante", "rutEmisor"));
            var certFilename = ReadStringOrDefault(config, "certFilename", "certificado.pfx");
            var certPassword = ReadString(config, "certPassword");
            var numeroResolucion = ReadInt(config, "numeroResolucion", 80);
            var fechaResolucion = ReadStringOrDefault(config, "fechaResolucion", "2014-08-22");
            var siiAmbienteRaw = ReadStringOrDefault(config, "siiAmbiente", "2");
            var ambiente = siiAmbienteRaw == "2" ? 1 : 0;

            PrintStep("2", "Configuracion detectada");
            Console.WriteLine($"apiKey            : {Mask(apiKey)}");
            Console.WriteLine($"rutEmisor         : {rutEmisor}");
            Console.WriteLine($"rutEnvia          : {rutEnvia}");
            Console.WriteLine($"certFilename      : {certFilename}");
            Console.WriteLine($"certPassword      : {(string.IsNullOrWhiteSpace(certPassword) ? "VACIA" : $"OK largo {certPassword.Length}")}");
            Console.WriteLine($"numeroResolucion  : {numeroResolucion}");
            Console.WriteLine($"fechaResolucion   : {fechaResolucion}");
            Console.WriteLine($"siiAmbiente       : {siiAmbienteRaw} => SimpleAPI Ambiente {ambiente}");

            Require(apiKey, "Falta apiKey en config.json.");
            Require(rutEmisor, "Falta rutEmisor en config.json.");
            Require(rutEnvia, "Falta rutEnvia en config.json.");
            Require(certPassword, "Falta certPassword en config.json.");

            var certPath = Path.Combine(siiFolder, certFilename);
            if (!File.Exists(certPath))
            {
                throw new FileNotFoundException("No existe el certificado configurado.", certPath);
            }

            PrintStep("3", "Validacion de certificado local");
            var certBytes = await File.ReadAllBytesAsync(certPath);
            ValidateCertificate(certBytes, certPassword);

            var folioOption = GetOption(options, "folio");
            var dtePath = GetOption(options, "dte");
            if (string.IsNullOrWhiteSpace(dtePath))
            {
                dtePath = ResolveDtePath(facturasFolder, folioOption);
            }

            if (!File.Exists(dtePath))
            {
                throw new FileNotFoundException("No existe XML DTE de factura para probar.", dtePath);
            }

            var folio = ExtractFolioFromName(dtePath) ?? folioOption ?? "desconocido";
            var dteXml = await File.ReadAllTextAsync(dtePath, Encoding.UTF8);

            PrintStep("4", "XML de factura seleccionado");
            Console.WriteLine($"folio     : {folio}");
            Console.WriteLine($"archivo   : {dtePath}");
            Console.WriteLine($"largo XML : {dteXml.Length} caracteres");
            Console.WriteLine($"TipoDTE   : {ExtractTag(dteXml, "TipoDTE") ?? "NO ENCONTRADO"}");
            Console.WriteLine($"RutEmisor : {ExtractTag(dteXml, "RUTEmisor") ?? ExtractTag(dteXml, "RutEmisor") ?? "NO ENCONTRADO"}");
            Console.WriteLine($"RutRecep  : {ExtractTag(dteXml, "RUTRecep") ?? ExtractTag(dteXml, "RutRecep") ?? "NO ENCONTRADO"}");

            if (viaBackend)
            {
                return await RunViaBackendAsync(new BackendDiagnosticInput
                {
                    BackendUrl = backendUrl,
                    ApiKey = apiKey,
                    RutEmisor = rutEmisor,
                    RutEnvia = rutEnvia,
                    CertPassword = certPassword,
                    NumeroResolucion = numeroResolucion,
                    FechaResolucion = fechaResolucion,
                    Ambiente = ambiente,
                    CertBytes = certBytes,
                    DteXml = dteXml,
                    Folio = folio
                });
            }

            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
            await ProbeTokenAsync(http, apiKey);

            var headers = new Dictionary<string, string>
            {
                ["Authorization"] = apiKey
            };

            PrintStep("6", "Generando sobre EnvioDTE en SimpleAPI");
            var wrapPayload = new
            {
                Certificado = new
                {
                    Rut = rutEnvia,
                    Password = certPassword
                },
                Caratula = new
                {
                    RutEnvia = rutEnvia,
                    RutEmisor = rutEmisor,
                    RutReceptor = "60803000-K",
                    NumeroResolucion = numeroResolucion,
                    FechaResolucion = fechaResolucion
                }
            };

            Console.WriteLine("Payload envio/generar:");
            Console.WriteLine(ToPublicJson(wrapPayload));

            using var wrapContent = new MultipartFormDataContent();
            AddJsonPart(wrapContent, "input", wrapPayload);
            AddFilePart(wrapContent, "files", certBytes, "certificado.pfx", "application/x-pkcs12");
            AddFilePart(wrapContent, "files2", Encoding.UTF8.GetBytes(dteXml), "dte.xml", "text/xml");

            var wrapBody = await SendMultipartAsync(http, HttpMethod.Post, WrapUrl, headers, wrapContent);
            var debugEnvelopePath = Path.Combine(facturasFolder, $"SIMPLE_RUT_DIAG_ENVELOPE_FOLIO_{folio}.xml");
            Directory.CreateDirectory(facturasFolder);
            await File.WriteAllTextAsync(debugEnvelopePath, wrapBody, Encoding.UTF8);
            Console.WriteLine($"Sobre guardado para revision: {debugEnvelopePath}");

            PrintStep("7", "Enviando sobre al SII via SimpleAPI");
            var sendPayload = new Dictionary<string, object?>
            {
                ["Tipo"] = 1,
                ["Ambiente"] = ambiente,
                ["RutCompany"] = rutEmisor,
                ["RutEmpresa"] = rutEmisor,
                ["RutEmisor"] = rutEmisor,
                ["RutEnvia"] = rutEnvia,
                ["rutCompany"] = rutEmisor,
                ["rutEmpresa"] = rutEmisor,
                ["rutEmisor"] = rutEmisor,
                ["rutEnvia"] = rutEnvia,
                ["Certificado"] = new Dictionary<string, object?>
                {
                    ["Rut"] = rutEnvia,
                    ["Password"] = certPassword
                },
                ["Caratula"] = new Dictionary<string, object?>
                {
                    ["RutEnvia"] = rutEnvia,
                    ["RutEmisor"] = rutEmisor
                }
            };

            Console.WriteLine("Payload envio/enviar:");
            Console.WriteLine(ToPublicJson(sendPayload));

            using var sendContent = new MultipartFormDataContent();
            AddJsonPart(sendContent, "input", sendPayload);
            AddFilePart(sendContent, "files", certBytes, "certificado.pfx", "application/x-pkcs12");
            AddFilePart(sendContent, "files2", Encoding.UTF8.GetBytes(wrapBody), "envio.xml", "text/xml");

            var sendBody = await SendMultipartAsync(http, HttpMethod.Post, SendUrl, headers, sendContent);
            var responsePath = Path.Combine(facturasFolder, $"SIMPLE_RUT_DIAG_SEND_RESPONSE_FOLIO_{folio}.json");
            await File.WriteAllTextAsync(responsePath, sendBody, Encoding.UTF8);
            Console.WriteLine($"Respuesta guardada: {responsePath}");

            PrintStep("8", "Resultado");
            Console.WriteLine("La peticion termino sin error HTTP. Revisa el JSON anterior para estado/trackId/glosa.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine();
            Console.WriteLine("ERROR FINAL DEL DIAGNOSTICO");
            Console.ResetColor();
            Console.WriteLine(ex.ToString());
            return 1;
        }
        finally
        {
            Console.WriteLine();
            Console.WriteLine("Diagnostico finalizado.");
        }
    }

    private sealed class BackendDiagnosticInput
    {
        public string BackendUrl { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string RutEmisor { get; set; } = string.Empty;
        public string RutEnvia { get; set; } = string.Empty;
        public string CertPassword { get; set; } = string.Empty;
        public int NumeroResolucion { get; set; }
        public string FechaResolucion { get; set; } = string.Empty;
        public int Ambiente { get; set; }
        public byte[] CertBytes { get; set; } = [];
        public string DteXml { get; set; } = string.Empty;
        public string Folio { get; set; } = string.Empty;
    }

    private static async Task<int> RunViaBackendAsync(BackendDiagnosticInput input)
    {
        PrintStep("5", "Enviando diagnostico al backend api-valmu");

        var payload = new Dictionary<string, object?>
        {
            ["apiKey"] = input.ApiKey,
            ["rutEmisor"] = input.RutEmisor,
            ["rutEnvia"] = input.RutEnvia,
            ["certPassword"] = input.CertPassword,
            ["numeroResolucion"] = input.NumeroResolucion,
            ["fechaResolucion"] = input.FechaResolucion,
            ["ambiente"] = input.Ambiente
        };

        Console.WriteLine("Payload para backend:");
        Console.WriteLine(ToPublicJson(payload));

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), "input");

        var certPart = new ByteArrayContent(input.CertBytes);
        certPart.Headers.ContentType = new MediaTypeHeaderValue("application/x-pkcs12");
        form.Add(certPart, "certificado", "certificado.pfx");

        var dtePart = new StringContent(input.DteXml, Encoding.UTF8, "text/xml");
        form.Add(dtePart, "dte", $"DTE_33_Folio_{input.Folio}.xml");

        using var response = await http.PostAsync(input.BackendUrl, form);
        var body = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
        Console.WriteLine("Headers:");
        foreach (var header in response.Headers)
        {
            Console.WriteLine($"  {header.Key}: {string.Join(",", header.Value)}");
        }
        Console.WriteLine("Body crudo del backend:");
        Console.WriteLine(PrettyJsonOrRaw(body));

        return response.IsSuccessStatusCode ? 0 : 1;
    }

    private static async Task ProbeTokenAsync(HttpClient http, string apiKey)
    {
        PrintStep("5", "Probando token SimpleAPI");
        using var request = new HttpRequestMessage(HttpMethod.Post, TokenUrl);
        request.Content = new StringContent(JsonSerializer.Serialize(new { apikey = apiKey }), Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
        Console.WriteLine($"Body: {MaskTokenBody(body)}");
    }

    private static async Task<string> SendMultipartAsync(
        HttpClient http,
        HttpMethod method,
        string url,
        IReadOnlyDictionary<string, string> headers,
        MultipartFormDataContent content)
    {
        using var request = new HttpRequestMessage(method, url);
        foreach (var header in headers)
        {
            request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        request.Content = content;
        Console.WriteLine($"POST {url}");
        Console.WriteLine("Headers:");
        foreach (var header in request.Headers)
        {
            var value = string.Join(",", header.Value);
            Console.WriteLine($"  {header.Key}: {(header.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase) ? Mask(value) : value)}");
        }

        using var response = await http.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Console.WriteLine();
        Console.WriteLine($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
        Console.WriteLine("Response headers:");
        foreach (var header in response.Headers)
        {
            Console.WriteLine($"  {header.Key}: {string.Join(",", header.Value)}");
        }
        Console.WriteLine("Body crudo:");
        Console.WriteLine(body);
        Console.WriteLine();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"SimpleAPI respondio HTTP {(int)response.StatusCode}: {body}");
        }

        return body;
    }

    private static void ValidateCertificate(byte[] certBytes, string password)
    {
        var cert = new X509Certificate2(certBytes, password, X509KeyStorageFlags.EphemeralKeySet);
        Console.WriteLine($"Subject       : {cert.Subject}");
        Console.WriteLine($"Issuer        : {cert.Issuer}");
        Console.WriteLine($"NotBefore     : {cert.NotBefore:yyyy-MM-dd HH:mm:ss}");
        Console.WriteLine($"NotAfter      : {cert.NotAfter:yyyy-MM-dd HH:mm:ss}");
        Console.WriteLine($"HasPrivateKey : {cert.HasPrivateKey}");
        Console.WriteLine($"Thumbprint    : {cert.Thumbprint}");

        if (DateTime.Now > cert.NotAfter)
        {
            throw new InvalidOperationException("El certificado esta vencido.");
        }

        if (!cert.HasPrivateKey)
        {
            throw new InvalidOperationException("El certificado no tiene llave privada.");
        }
    }

    private static string ResolveDtePath(string facturasFolder, string? folio)
    {
        if (!Directory.Exists(facturasFolder))
        {
            throw new DirectoryNotFoundException($"No existe carpeta de facturas: {facturasFolder}");
        }

        var pattern = string.IsNullOrWhiteSpace(folio)
            ? "DTE_33_Folio_*.xml"
            : $"DTE_33_Folio_{folio}.xml";

        var file = Directory.GetFiles(facturasFolder, pattern)
            .Select(path => new FileInfo(path))
            .OrderByDescending(info => info.LastWriteTime)
            .FirstOrDefault();

        if (file == null)
        {
            throw new FileNotFoundException($"No encontre XML con patron {pattern} en {facturasFolder}.");
        }

        return file.FullName;
    }

    private static void AddJsonPart(MultipartFormDataContent form, string name, object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        form.Add(content, name);
    }

    private static void AddFilePart(MultipartFormDataContent form, string name, byte[] bytes, string filename, string contentType)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(content, name, filename);
    }

    private static Dictionary<string, string> ParseArgs(string[] args)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (!arg.StartsWith("--", StringComparison.Ordinal)) continue;
            var key = arg[2..];
            if (string.Equals(key, "diagnostico-factura", StringComparison.OrdinalIgnoreCase)) continue;
            if (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                result[key] = args[++i];
            }
            else
            {
                result[key] = "true";
            }
        }
        return result;
    }

    private static bool HasOption(string[] args, string key)
    {
        return args.Any(arg => string.Equals(arg, $"--{key}", StringComparison.OrdinalIgnoreCase));
    }

    private static string? GetOption(Dictionary<string, string> options, string key)
    {
        return options.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : null;
    }

    private static string ReadString(JsonElement element, string propertyName, string fallback = "")
    {
        return element.TryGetProperty(propertyName, out var value) ? (value.GetString() ?? fallback) : fallback;
    }

    private static string ReadStringOrDefault(JsonElement element, string propertyName, string fallback)
    {
        var primary = ReadString(element, propertyName);
        return string.IsNullOrWhiteSpace(primary) ? fallback : primary;
    }

    private static string ReadString(JsonElement element, string propertyName, string alternateProperty, string secondAlternateProperty)
    {
        var primary = ReadString(element, propertyName);
        if (!string.IsNullOrWhiteSpace(primary)) return primary;
        var alternate = ReadString(element, alternateProperty);
        if (!string.IsNullOrWhiteSpace(alternate)) return alternate;
        return ReadString(element, secondAlternateProperty);
    }

    private static int ReadInt(JsonElement element, string propertyName, int fallback)
    {
        if (!element.TryGetProperty(propertyName, out var value)) return fallback;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
        return int.TryParse(value.GetString(), out var parsed) ? parsed : fallback;
    }

    private static void Require(string value, string message)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(message);
        }
    }

    private static string NormalizeRut(string rut)
    {
        var compact = new string((rut ?? string.Empty).Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
        if (compact.Length <= 1) return compact;
        return $"{compact[..^1]}-{compact[^1]}";
    }

    private static string Mask(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "(vacio)";
        if (value.Length <= 8) return "****";
        return $"{value[..4]}...{value[^4..]}";
    }

    private static string MaskTokenBody(string body)
    {
        var trimmed = (body ?? string.Empty).Trim().Trim('"');
        if (trimmed.Length > 24 && !trimmed.Contains('{'))
        {
            return Mask(trimmed);
        }
        return body ?? string.Empty;
    }

    private static string ToPublicJson(object payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        try
        {
            using var doc = JsonDocument.Parse(json);
            return JsonSerializer.Serialize(MaskSensitiveJson(doc.RootElement), new JsonSerializerOptions { WriteIndented = true });
        }
        catch
        {
            // Fallback for unusual serializable objects.
        }

        var password = ReadPasswordFromJson(json);
        return string.IsNullOrEmpty(password)
            ? json
            : json.Replace(password, "***", StringComparison.Ordinal);
    }

    private static object? MaskSensitiveJson(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                var obj = new Dictionary<string, object?>();
                foreach (var property in element.EnumerateObject())
                {
                    var key = property.Name;
                    if (key.Contains("password", StringComparison.OrdinalIgnoreCase) ||
                        key.Contains("apikey", StringComparison.OrdinalIgnoreCase) ||
                        key.Contains("apiKey", StringComparison.OrdinalIgnoreCase))
                    {
                        obj[key] = "***";
                    }
                    else
                    {
                        obj[key] = MaskSensitiveJson(property.Value);
                    }
                }
                return obj;
            case JsonValueKind.Array:
                return element.EnumerateArray().Select(MaskSensitiveJson).ToArray();
            case JsonValueKind.String:
                return element.GetString();
            case JsonValueKind.Number:
                if (element.TryGetInt64(out var longValue)) return longValue;
                if (element.TryGetDouble(out var doubleValue)) return doubleValue;
                return element.ToString();
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
            default:
                return null;
        }
    }

    private static string PrettyJsonOrRaw(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions { WriteIndented = true });
        }
        catch
        {
            return body;
        }
    }

    private static string ReadPasswordFromJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return FindProperty(doc.RootElement, "Password") ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string? FindProperty(JsonElement element, string propertyName)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.NameEquals(propertyName)) return property.Value.GetString();
                var nested = FindProperty(property.Value, propertyName);
                if (!string.IsNullOrWhiteSpace(nested)) return nested;
            }
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                var nested = FindProperty(item, propertyName);
                if (!string.IsNullOrWhiteSpace(nested)) return nested;
            }
        }

        return null;
    }

    private static string? ExtractFolioFromName(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        var marker = "Folio_";
        var index = name.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        return index >= 0 ? name[(index + marker.Length)..] : null;
    }

    private static string? ExtractTag(string xml, string tag)
    {
        var open = $"<{tag}>";
        var close = $"</{tag}>";
        var start = xml.IndexOf(open, StringComparison.OrdinalIgnoreCase);
        if (start < 0) return null;
        start += open.Length;
        var end = xml.IndexOf(close, start, StringComparison.OrdinalIgnoreCase);
        return end < 0 ? null : xml[start..end].Trim();
    }

    private static void PrintStep(string number, string title)
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine();
        Console.WriteLine($"[{number}] {title}");
        Console.WriteLine(new string('-', 60));
        Console.ResetColor();
    }
}
