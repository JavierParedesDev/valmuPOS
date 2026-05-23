using SimpleRutDesktop.Models;
using SimpleRutDesktop.Services;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SimpleRutDesktop;

public partial class Form1 : Form
{
    private readonly SettingsStore _settingsStore = new();
    private readonly SimpleApiRutService _rutService = new(new HttpClient());
    private TextBox txtFacturaSiiFolder = null!;
    private TextBox txtFacturaBackendUrl = null!;
    private TextBox txtFacturaFolio = null!;
    private TextBox txtFacturaRutRecep = null!;
    private TextBox txtFacturaRazonRecep = null!;
    private TextBox txtFacturaGiroRecep = null!;
    private TextBox txtFacturaDirRecep = null!;
    private TextBox txtFacturaComunaRecep = null!;
    private TextBox txtFacturaCiudadRecep = null!;
    private TextBox txtFacturaItem = null!;
    private TextBox txtFacturaTotal = null!;
    private Button btnEmitirFactura = null!;
    private Button btnUsarRutConsultado = null!;

    private const string DefaultRazonSocial = "DISTRIBUIDORA Y COMERCIAL EDUARDO VALDEBENITO MORALES SPA";
    private const string DefaultDireccion = "YOBILO LT 1 MZ 1 1001 FRANK MARDONES NULL CORONEL";
    private const string DefaultComuna = "CORONEL";
    private const string DefaultCiudad = "CORONEL";
    private const string DefaultGiro = "COMERCIALIZACION Y DISTRIBUCION POR MAYOR Y MENOR DE PRODUCTOS VARIOS";
    private const int DefaultActeco = 463019;

    public Form1()
    {
        InitializeComponent();
        AddFacturaSection();
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

    private void AddFacturaSection()
    {
        AutoScroll = true;
        FormBorderStyle = FormBorderStyle.Sizable;
        MaximizeBox = true;
        ClientSize = new Size(1100, 930);
        lblEstado.Location = new Point(18, 1228);

        var group = new GroupBox
        {
            Name = "grpFactura",
            Text = "Emitir factura de prueba (SimpleAPI + backend aislado)",
            Location = new Point(18, 868),
            Size = new Size(1046, 345),
            TabIndex = 8
        };

        txtFacturaSiiFolder = AddText(group, "Carpeta SII", 19, 39, 660, DefaultSiiFolder());
        var btnFolder = new Button
        {
            Text = "Cambiar",
            Location = new Point(695, 37),
            Size = new Size(90, 27)
        };
        btnFolder.Click += (_s, _e) => SelectSiiFolder();
        group.Controls.Add(btnFolder);

        txtFacturaBackendUrl = AddText(group, "Endpoint backend", 19, 88, 766, "http://localhost:3000/api/diagnostico/factura/enviar");
        txtFacturaFolio = AddText(group, "Folio factura 33", 805, 39, 210, "");
        txtFacturaTotal = AddText(group, "Total con IVA", 805, 88, 210, "1000");

        txtFacturaRutRecep = AddText(group, "RUT receptor", 19, 143, 180, "");
        txtFacturaRazonRecep = AddText(group, "Razon social receptor", 214, 143, 330, "");
        txtFacturaGiroRecep = AddText(group, "Giro receptor", 559, 143, 456, "");

        txtFacturaDirRecep = AddText(group, "Direccion receptor", 19, 198, 330, "");
        txtFacturaComunaRecep = AddText(group, "Comuna", 364, 198, 180, "CORONEL");
        txtFacturaCiudadRecep = AddText(group, "Ciudad", 559, 198, 180, "CORONEL");
        txtFacturaItem = AddText(group, "Producto / servicio", 754, 198, 261, "DESPACHO CORONEL");

        btnUsarRutConsultado = new Button
        {
            Text = "Usar RUT consultado",
            Location = new Point(19, 260),
            Size = new Size(160, 32)
        };
        btnUsarRutConsultado.Click += (_s, _e) => FillFacturaReceiverFromLookup();
        group.Controls.Add(btnUsarRutConsultado);

        btnEmitirFactura = new Button
        {
            Text = "Generar XML y enviar factura",
            Location = new Point(805, 258),
            Size = new Size(210, 36)
        };
        btnEmitirFactura.Click += btnEmitirFactura_Click;
        group.Controls.Add(btnEmitirFactura);

        var warning = new Label
        {
            Text = "Advertencia: si SII acepta el envio, esta prueba puede enviar una factura real del folio indicado.",
            Location = new Point(195, 268),
            AutoSize = true,
            ForeColor = Color.DarkRed
        };
        group.Controls.Add(warning);

        Controls.Add(group);
    }

    private static TextBox AddText(Control parent, string label, int x, int y, int width, string value)
    {
        parent.Controls.Add(new Label
        {
            Text = label,
            Location = new Point(x, y - 18),
            AutoSize = true
        });

        var textBox = new TextBox
        {
            Location = new Point(x, y),
            Size = new Size(width, 23),
            Text = value
        };
        parent.Controls.Add(textBox);
        return textBox;
    }

    private static string DefaultSiiFolder()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "cajero",
            "sii_data");
    }

    private void SelectSiiFolder()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Selecciona la carpeta sii_data",
            SelectedPath = Directory.Exists(txtFacturaSiiFolder.Text) ? txtFacturaSiiFolder.Text : DefaultSiiFolder()
        };

        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            txtFacturaSiiFolder.Text = dialog.SelectedPath;
        }
    }

    private void FillFacturaReceiverFromLookup()
    {
        txtFacturaRutRecep.Text = txtRutResultado.Text;
        txtFacturaRazonRecep.Text = txtRazonSocial.Text;
        txtFacturaGiroRecep.Text = string.IsNullOrWhiteSpace(txtGiro.Text) ? "COMERCIO" : txtGiro.Text;
        txtFacturaDirRecep.Text = txtDireccion.Text;
        txtFacturaComunaRecep.Text = string.IsNullOrWhiteSpace(txtComuna.Text) ? "CORONEL" : txtComuna.Text;
        txtFacturaCiudadRecep.Text = string.IsNullOrWhiteSpace(txtCiudad.Text) ? txtFacturaComunaRecep.Text : txtCiudad.Text;
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
        if (btnEmitirFactura != null) btnEmitirFactura.Enabled = !busy;
        if (btnUsarRutConsultado != null) btnUsarRutConsultado.Enabled = !busy;
        lblEstado.Text = status;
        Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
    }

    private async void btnEmitirFactura_Click(object? sender, EventArgs e)
    {
        try
        {
            SetBusy(true, "Generando factura de prueba...");
            txtRawJson.Text = string.Empty;
            var result = await EmitFacturaAsync();
            txtRawJson.Text = PrettyJsonOrRaw(result);
            lblEstado.Text = "Factura procesada. Revisa respuesta JSON.";
        }
        catch (Exception ex)
        {
            lblEstado.Text = "Factura fallida.";
            txtRawJson.Text = ex.ToString();
            MessageBox.Show(ex.Message, "Error al emitir factura", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            SetBusy(false, "Listo");
        }
    }

    private async Task<string> EmitFacturaAsync()
    {
        var siiFolder = txtFacturaSiiFolder.Text.Trim();
        if (!Directory.Exists(siiFolder)) throw new InvalidOperationException("No existe la carpeta SII indicada.");

        var configPath = Path.Combine(siiFolder, "config.json");
        if (!File.Exists(configPath)) throw new InvalidOperationException("No existe config.json en la carpeta SII.");

        using var configDocument = JsonDocument.Parse(await File.ReadAllTextAsync(configPath));
        var config = configDocument.RootElement;

        var apiKey = ReadJsonString(config, "apiKey");
        var certPassword = ReadJsonString(config, "certPassword");
        var rutEmisor = NormalizeRut(ReadJsonString(config, "rutEmisor"));
        var rutEnvia = NormalizeRut(ReadJsonString(config, "rutEnvia", rutEmisor));
        var certFilename = ReadJsonString(config, "certFilename", "certificado.pfx");
        var cafFilename = ReadJsonString(config, "caf_33_filename", "CAF_33.xml");
        var numeroResolucion = ReadJsonInt(config, "numeroResolucion", 80);
        var fechaResolucion = ReadJsonString(config, "fechaResolucion", "2014-08-22");
        var ambiente = ReadJsonString(config, "siiAmbiente", "2") == "2" ? 1 : 0;

        Require(apiKey, "Falta apiKey en config.json.");
        Require(certPassword, "Falta certPassword en config.json.");
        Require(rutEmisor, "Falta rutEmisor en config.json.");
        Require(rutEnvia, "Falta rutEnvia en config.json.");

        if (!int.TryParse(txtFacturaFolio.Text.Trim(), out var folio) || folio <= 0)
        {
            throw new InvalidOperationException("Ingresa un folio de factura valido.");
        }

        if (!decimal.TryParse(txtFacturaTotal.Text.Trim(), out var totalDecimal) || totalDecimal <= 0)
        {
            throw new InvalidOperationException("Ingresa un total con IVA valido.");
        }

        var total = (int)Math.Round(totalDecimal, MidpointRounding.AwayFromZero);
        var neto = (int)Math.Round(total / 1.19m, MidpointRounding.AwayFromZero);
        var iva = total - neto;

        var certPath = Path.Combine(siiFolder, certFilename);
        var cafPath = Path.Combine(siiFolder, cafFilename);
        if (!File.Exists(certPath)) throw new InvalidOperationException($"No existe certificado: {certPath}");
        if (!File.Exists(cafPath)) throw new InvalidOperationException($"No existe CAF factura 33: {cafPath}");

        var receiverRut = NormalizeRut(txtFacturaRutRecep.Text);
        var receiverName = CleanSiiText(txtFacturaRazonRecep.Text);
        var receiverGiro = CleanSiiText(string.IsNullOrWhiteSpace(txtFacturaGiroRecep.Text) ? "COMERCIO" : txtFacturaGiroRecep.Text);
        var receiverAddress = CleanSiiText(txtFacturaDirRecep.Text);
        var receiverComuna = CleanSiiText(txtFacturaComunaRecep.Text);
        var receiverCiudad = CleanSiiText(string.IsNullOrWhiteSpace(txtFacturaCiudadRecep.Text) ? txtFacturaComunaRecep.Text : txtFacturaCiudadRecep.Text);
        var itemName = CleanSiiText(string.IsNullOrWhiteSpace(txtFacturaItem.Text) ? "SERVICIO" : txtFacturaItem.Text);

        Require(receiverRut, "Falta RUT receptor.");
        Require(receiverName, "Falta razon social receptor.");
        Require(receiverAddress, "Falta direccion receptor.");
        Require(receiverComuna, "Falta comuna receptor.");

        var certBytes = await File.ReadAllBytesAsync(certPath);
        var cafBytes = await File.ReadAllBytesAsync(cafPath);

        var dteXml = await GenerateFacturaDteAsync(new FacturaGenerationInput
        {
            ApiKey = apiKey,
            CertPassword = certPassword,
            CertBytes = certBytes,
            CafBytes = cafBytes,
            CafFilename = cafFilename,
            Folio = folio,
            Fecha = DateTime.Today.ToString("yyyy-MM-dd"),
            Ambiente = ambiente,
            RutEmisor = rutEmisor,
            ReceiverRut = receiverRut,
            ReceiverName = receiverName,
            ReceiverGiro = receiverGiro,
            ReceiverAddress = receiverAddress,
            ReceiverComuna = receiverComuna,
            ReceiverCiudad = receiverCiudad,
            ItemName = itemName,
            Neto = neto,
            Iva = iva,
            Total = total
        });

        var facturasFolder = Path.Combine(siiFolder, "facturas");
        Directory.CreateDirectory(facturasFolder);
        var dtePath = Path.Combine(facturasFolder, $"DTE_33_Folio_{folio}.xml");
        await File.WriteAllTextAsync(dtePath, dteXml, Encoding.UTF8);

        var backendResult = await SendFacturaViaBackendAsync(new FacturaBackendInput
        {
            BackendUrl = txtFacturaBackendUrl.Text.Trim(),
            ApiKey = apiKey,
            CertPassword = certPassword,
            RutEmisor = rutEmisor,
            RutEnvia = rutEnvia,
            NumeroResolucion = numeroResolucion,
            FechaResolucion = fechaResolucion,
            Ambiente = ambiente,
            CertBytes = certBytes,
            DteXml = dteXml,
            Folio = folio
        });

        return backendResult;
    }

    private sealed class FacturaGenerationInput
    {
        public string ApiKey { get; set; } = string.Empty;
        public string CertPassword { get; set; } = string.Empty;
        public byte[] CertBytes { get; set; } = [];
        public byte[] CafBytes { get; set; } = [];
        public string CafFilename { get; set; } = "CAF_33.xml";
        public int Folio { get; set; }
        public string Fecha { get; set; } = string.Empty;
        public int Ambiente { get; set; }
        public string RutEmisor { get; set; } = string.Empty;
        public string ReceiverRut { get; set; } = string.Empty;
        public string ReceiverName { get; set; } = string.Empty;
        public string ReceiverGiro { get; set; } = string.Empty;
        public string ReceiverAddress { get; set; } = string.Empty;
        public string ReceiverComuna { get; set; } = string.Empty;
        public string ReceiverCiudad { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public int Neto { get; set; }
        public int Iva { get; set; }
        public int Total { get; set; }
    }

    private sealed class FacturaBackendInput
    {
        public string BackendUrl { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string CertPassword { get; set; } = string.Empty;
        public string RutEmisor { get; set; } = string.Empty;
        public string RutEnvia { get; set; } = string.Empty;
        public int NumeroResolucion { get; set; }
        public string FechaResolucion { get; set; } = string.Empty;
        public int Ambiente { get; set; }
        public byte[] CertBytes { get; set; } = [];
        public string DteXml { get; set; } = string.Empty;
        public int Folio { get; set; }
    }

    private static async Task<string> GenerateFacturaDteAsync(FacturaGenerationInput input)
    {
        var payload = new
        {
            Documento = new
            {
                Encabezado = new
                {
                    IdentificacionDTE = new
                    {
                        TipoDTE = 33,
                        Folio = input.Folio,
                        FechaEmision = input.Fecha,
                        FormaPago = 1,
                        FechaVencimiento = input.Fecha
                    },
                    Emisor = new
                    {
                        Rut = input.RutEmisor,
                        RazonSocial = DefaultRazonSocial,
                        Giro = CleanSiiText(DefaultGiro).Substring(0, Math.Min(80, CleanSiiText(DefaultGiro).Length)),
                        ActividadEconomica = new[] { DefaultActeco },
                        DireccionOrigen = CleanSiiText(DefaultDireccion),
                        ComunaOrigen = CleanSiiText(DefaultComuna),
                        CiudadOrigen = CleanSiiText(DefaultCiudad)
                    },
                    Receptor = new
                    {
                        Rut = input.ReceiverRut,
                        RazonSocial = input.ReceiverName,
                        Direccion = input.ReceiverAddress,
                        Comuna = input.ReceiverComuna,
                        Ciudad = input.ReceiverCiudad,
                        Giro = input.ReceiverGiro.Substring(0, Math.Min(40, input.ReceiverGiro.Length))
                    },
                    Totales = new
                    {
                        MontoNeto = input.Neto,
                        TasaIVA = 19,
                        IVA = input.Iva,
                        MontoTotal = input.Total
                    }
                },
                Detalles = new[]
                {
                    new
                    {
                        IndicadorExento = 0,
                        Nombre = input.ItemName,
                        Descripcion = input.ItemName,
                        Cantidad = 1,
                        UnidadMedida = "un",
                        Precio = input.Neto,
                        Descuento = 0,
                        Recargo = 0,
                        MontoItem = input.Neto
                    }
                },
                Referencias = Array.Empty<object>(),
                DescuentosRecargos = Array.Empty<object>()
            },
            Certificado = new
            {
                Rut = input.RutEmisor,
                Password = input.CertPassword
            },
            Ambiente = input.Ambiente,
            Tipo = 1
        };

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(input.CertBytes)
        {
            Headers = { ContentType = new MediaTypeHeaderValue("application/x-pkcs12") }
        }, "file", "certificado.pfx");
        form.Add(new StringContent(input.CertPassword), "password");
        form.Add(new ByteArrayContent(input.CafBytes)
        {
            Headers = { ContentType = new MediaTypeHeaderValue("text/xml") }
        }, "caf", input.CafFilename);
        form.Add(new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), "input");

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.simpleapi.cl/api/v1/dte/generar");
        request.Headers.TryAddWithoutValidation("Authorization", input.ApiKey);
        request.Content = form;

        using var response = await http.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Error generando DTE ({(int)response.StatusCode}): {body}");
        }

        return body;
    }

    private static async Task<string> SendFacturaViaBackendAsync(FacturaBackendInput input)
    {
        if (string.IsNullOrWhiteSpace(input.BackendUrl))
        {
            throw new InvalidOperationException("Falta endpoint backend.");
        }

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

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), "input");
        form.Add(new ByteArrayContent(input.CertBytes)
        {
            Headers = { ContentType = new MediaTypeHeaderValue("application/x-pkcs12") }
        }, "certificado", "certificado.pfx");
        form.Add(new StringContent(input.DteXml, Encoding.UTF8, "text/xml"), "dte", $"DTE_33_Folio_{input.Folio}.xml");

        using var response = await http.PostAsync(input.BackendUrl, form);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            return body;
        }

        return body;
    }

    private static string ReadJsonString(JsonElement element, string propertyName, string fallback = "")
    {
        return element.TryGetProperty(propertyName, out var value) ? (value.GetString() ?? fallback) : fallback;
    }

    private static int ReadJsonInt(JsonElement element, string propertyName, int fallback)
    {
        if (!element.TryGetProperty(propertyName, out var value)) return fallback;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
        return int.TryParse(value.GetString(), out var parsed) ? parsed : fallback;
    }

    private static void Require(string value, string message)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException(message);
    }

    private static string NormalizeRut(string rut)
    {
        var compact = new string((rut ?? string.Empty).Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
        if (compact.Length <= 1) return compact;
        return $"{compact[..^1]}-{compact[^1]}";
    }

    private static string CleanSiiText(string value)
    {
        return new string((value ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Where(ch => ch is >= 'A' and <= 'Z' || ch is >= '0' and <= '9' || ch == ' ' || ch == '-' || ch == '.' || ch == ',')
            .ToArray());
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
}
