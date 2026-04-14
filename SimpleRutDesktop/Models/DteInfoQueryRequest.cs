namespace SimpleRutDesktop.Models;

public sealed class DteInfoQueryRequest
{
    public string RutEmpresa { get; set; } = string.Empty;

    public string RutReceptor { get; set; } = string.Empty;

    public int Folio { get; set; }

    public string FechaDte { get; set; } = string.Empty;

    public int Tipo { get; set; } = 39;

    public int Ambiente { get; set; } = 1;

    public string AuthRut { get; set; } = string.Empty;

    public string AuthPassword { get; set; } = string.Empty;
}
