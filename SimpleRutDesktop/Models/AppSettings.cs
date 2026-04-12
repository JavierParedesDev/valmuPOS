namespace SimpleRutDesktop.Models;

public sealed class AppSettings
{
    public string ApiKey { get; set; } = string.Empty;

    public string AuthMode { get; set; } = "XApiKey";

    public string TokenUrl { get; set; } = "https://api.simpleapi.cl/api/auth/token";

    public string RutEndpointTemplate { get; set; } = "https://rut.simpleapi.cl/v2/{rut}";
}
