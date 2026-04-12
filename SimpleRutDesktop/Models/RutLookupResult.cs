namespace SimpleRutDesktop.Models;

public sealed class RutLookupResult
{
    public string Rut { get; set; } = string.Empty;

    public string RazonSocial { get; set; } = string.Empty;

    public string Giro { get; set; } = string.Empty;

    public string Direccion { get; set; } = string.Empty;

    public string Comuna { get; set; } = string.Empty;

    public string Ciudad { get; set; } = string.Empty;

    public string Correo { get; set; } = string.Empty;

    public string Telefono { get; set; } = string.Empty;

    public string RawJson { get; set; } = string.Empty;
}
