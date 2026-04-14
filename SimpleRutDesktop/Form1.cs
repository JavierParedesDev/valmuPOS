using SimpleRutDesktop.Models;
using SimpleRutDesktop.Services;

namespace SimpleRutDesktop;

public partial class Form1 : Form
{
    private readonly SettingsStore _settingsStore = new();
    private readonly SimpleApiRutService _rutService = new(new HttpClient());

    public Form1()
    {
        InitializeComponent();
        LoadSettingsIntoUi();
    }

    private void LoadSettingsIntoUi()
    {
        var settings = _settingsStore.Load();
        txtApiKey.Text = settings.ApiKey;
        txtTokenUrl.Text = settings.TokenUrl;
        txtRutEndpoint.Text = settings.RutEndpointTemplate;
        txtDteInfoEndpoint.Text = settings.DteInfoEndpointUrl;
        txtDteAuthRut.Text = settings.DteAuthRut;
        txtDteAuthPassword.Text = settings.DteAuthPassword;
        txtDteRutEmpresa.Text = settings.DteRutEmpresa;
        txtDteRutReceptor.Text = settings.DteRutReceptor;
        cmbDteTipo.SelectedItem = settings.DteTipo.ToString();
        cmbDteAmbiente.SelectedIndex = settings.DteAmbiente == 0 ? 0 : 1;
        dtpDteFecha.Value = DateTime.Today;
        cmbAuthMode.SelectedIndex = settings.AuthMode switch
        {
            "BearerToken" => 0,
            "BasicApiKey" => 1,
            _ => 2
        };
        if (cmbDteTipo.SelectedIndex < 0)
        {
            cmbDteTipo.SelectedIndex = 0;
        }
        ToggleAuthFields();
    }

    private AppSettings ReadSettingsFromUi()
    {
        return new AppSettings
        {
            ApiKey = txtApiKey.Text.Trim(),
            AuthMode = cmbAuthMode.SelectedIndex switch
            {
                0 => "BearerToken",
                1 => "BasicApiKey",
                _ => "XApiKey"
            },
            TokenUrl = txtTokenUrl.Text.Trim(),
            RutEndpointTemplate = txtRutEndpoint.Text.Trim(),
            DteInfoEndpointUrl = txtDteInfoEndpoint.Text.Trim(),
            DteAuthRut = txtDteAuthRut.Text.Trim(),
            DteAuthPassword = txtDteAuthPassword.Text,
            DteRutEmpresa = txtDteRutEmpresa.Text.Trim(),
            DteRutReceptor = txtDteRutReceptor.Text.Trim(),
            DteTipo = int.TryParse(cmbDteTipo.Text, out var tipoDte) ? tipoDte : 39,
            DteAmbiente = cmbDteAmbiente.SelectedIndex == 0 ? 0 : 1
        };
    }

    private void ToggleAuthFields()
    {
        var usesBearer = cmbAuthMode.SelectedIndex == 0;
        txtTokenUrl.Enabled = usesBearer;
        lblTokenUrl.Enabled = usesBearer;
    }

    private async void btnConsultar_Click(object sender, EventArgs e)
    {
        var rut = txtRutConsulta.Text.Trim();
        if (string.IsNullOrWhiteSpace(rut))
        {
            MessageBox.Show("Ingresa un RUT para consultar.", "Dato faltante", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtRutConsulta.Focus();
            return;
        }

        var settings = ReadSettingsFromUi();
        _settingsStore.Save(settings);

        try
        {
            SetBusy(true, "Consultando RUT en SimpleAPI...");
            txtRutConsulta.Text = SimpleApiRutService.NormalizeRut(rut);
            var result = await _rutService.QueryRutAsync(rut, settings);
            BindResult(result);
            lblEstado.Text = "Consulta completada.";
        }
        catch (Exception ex)
        {
            lblEstado.Text = "Consulta fallida.";
            txtRawJson.Text = ex.Message;
            MessageBox.Show(ex.Message, "Error al consultar", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            SetBusy(false, "Listo");
        }
    }

    private void btnGuardarConfig_Click(object sender, EventArgs e)
    {
        var settings = ReadSettingsFromUi();
        _settingsStore.Save(settings);
        lblEstado.Text = "Configuración guardada.";
        MessageBox.Show("Configuración guardada correctamente.", "Configuración", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void cmbAuthMode_SelectedIndexChanged(object sender, EventArgs e)
    {
        ToggleAuthFields();
    }

    private async void btnConsultarDte_Click(object sender, EventArgs e)
    {
        if (!int.TryParse(txtDteFolio.Text.Trim(), out var folio) || folio <= 0)
        {
            MessageBox.Show("Ingresa un folio valido para consultar.", "Dato faltante", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtDteFolio.Focus();
            return;
        }

        var settings = ReadSettingsFromUi();
        _settingsStore.Save(settings);

        var request = new DteInfoQueryRequest
        {
            RutEmpresa = txtDteRutEmpresa.Text.Trim(),
            RutReceptor = txtDteRutReceptor.Text.Trim(),
            Folio = folio,
            FechaDte = dtpDteFecha.Value.ToString("yyyy-MM-dd"),
            Tipo = int.TryParse(cmbDteTipo.Text, out var tipoDte) ? tipoDte : 39,
            Ambiente = cmbDteAmbiente.SelectedIndex == 0 ? 0 : 1,
            AuthRut = txtDteAuthRut.Text.Trim(),
            AuthPassword = txtDteAuthPassword.Text
        };

        try
        {
            SetBusy(true, "Consultando DTE en SimpleAPI...");
            var result = await _rutService.QueryDteInfoAsync(request, settings);
            BindDteResult(result);
            lblEstado.Text = "Consulta DTE completada.";
        }
        catch (Exception ex)
        {
            lblEstado.Text = "Consulta DTE fallida.";
            txtDteEstado.Text = string.Empty;
            txtDteDetalle.Text = ex.Message;
            txtDteReparos.Text = string.Empty;
            txtRawJson.Text = ex.Message;
            MessageBox.Show(ex.Message, "Error al consultar DTE", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            SetBusy(false, "Listo");
        }
    }

    private void BindResult(RutLookupResult result)
    {
        txtRutResultado.Text = result.Rut;
        txtRazonSocial.Text = result.RazonSocial;
        txtGiro.Text = result.Giro;
        txtDireccion.Text = result.Direccion;
        txtComuna.Text = result.Comuna;
        txtCiudad.Text = result.Ciudad;
        txtCorreo.Text = result.Correo;
        txtTelefono.Text = result.Telefono;
        txtRawJson.Text = result.RawJson;
    }

    private void BindDteResult(DteInfoQueryResult result)
    {
        txtDteEstado.Text = result.Estado;
        txtDteDetalle.Text = result.Detalle;
        txtDteReparos.Text = result.Reparos;
        txtDteTrackId.Text = result.TrackId;
        txtRawJson.Text = result.RawJson;
    }

    private void SetBusy(bool busy, string status)
    {
        btnConsultar.Enabled = !busy;
        btnConsultarDte.Enabled = !busy;
        btnGuardarConfig.Enabled = !busy;
        lblEstado.Text = status;
        Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
    }
}
