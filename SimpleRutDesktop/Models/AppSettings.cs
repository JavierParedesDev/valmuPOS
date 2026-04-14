namespace SimpleRutDesktop.Models;

public sealed class AppSettings
{
    public string ApiKey { get; set; } = string.Empty;

    public string AuthMode { get; set; } = "XApiKey";

    public string TokenUrl { get; set; } = "https://api.simpleapi.cl/api/auth/token";

    public string RutEndpointTemplate { get; set; } = "https://rut.simpleapi.cl/v2/{rut}";

    public string DteInfoEndpointUrl { get; set; } = "https://api.simpleapi.cl/api/v1/consulta/dte/info";

    public string DteAuthRut { get; set; } = string.Empty;

    public string DteAuthPassword { get; set; } = string.Empty;

    public string DteRutEmpresa { get; set; } = string.Empty;

    public string DteRutReceptor { get; set; } = "66666666-6";

    public int DteTipo { get; set; } = 39;

    public int DteAmbiente { get; set; } = 1;
}
