namespace SimpleRutDesktop;

partial class Form1
{
    private System.ComponentModel.IContainer components = null;

    protected override void Dispose(bool disposing)
    {
        if (disposing && (components != null))
        {
            components.Dispose();
        }
        base.Dispose(disposing);
    }

    #region Windows Form Designer generated code

    private void InitializeComponent()
    {
        lblTitulo = new Label();
        grpConfiguracion = new GroupBox();
        txtDteInfoEndpoint = new TextBox();
        lblDteInfoEndpoint = new Label();
        txtDteAuthPassword = new TextBox();
        lblDteAuthPassword = new Label();
        txtDteAuthRut = new TextBox();
        lblDteAuthRut = new Label();
        btnGuardarConfig = new Button();
        cmbAuthMode = new ComboBox();
        lblAuthMode = new Label();
        txtRutEndpoint = new TextBox();
        lblRutEndpoint = new Label();
        txtTokenUrl = new TextBox();
        lblTokenUrl = new Label();
        txtApiKey = new TextBox();
        lblApiKey = new Label();
        grpConsulta = new GroupBox();
        btnConsultar = new Button();
        txtRutConsulta = new TextBox();
        lblRutConsulta = new Label();
        grpConsultaDte = new GroupBox();
        cmbDteAmbiente = new ComboBox();
        lblDteAmbiente = new Label();
        cmbDteTipo = new ComboBox();
        lblDteTipo = new Label();
        dtpDteFecha = new DateTimePicker();
        lblDteFecha = new Label();
        txtDteFolio = new TextBox();
        lblDteFolio = new Label();
        txtDteRutReceptor = new TextBox();
        lblDteRutReceptor = new Label();
        txtDteRutEmpresa = new TextBox();
        lblDteRutEmpresa = new Label();
        btnConsultarDte = new Button();
        grpResultado = new GroupBox();
        txtTelefono = new TextBox();
        lblTelefono = new Label();
        txtCorreo = new TextBox();
        lblCorreo = new Label();
        txtCiudad = new TextBox();
        lblCiudad = new Label();
        txtComuna = new TextBox();
        lblComuna = new Label();
        txtDireccion = new TextBox();
        lblDireccion = new Label();
        txtGiro = new TextBox();
        lblGiro = new Label();
        txtRazonSocial = new TextBox();
        lblRazonSocial = new Label();
        txtRutResultado = new TextBox();
        lblRutResultado = new Label();
        grpResultadoDte = new GroupBox();
        txtDteTrackId = new TextBox();
        lblDteTrackId = new Label();
        txtDteReparos = new TextBox();
        lblDteReparos = new Label();
        txtDteDetalle = new TextBox();
        lblDteDetalle = new Label();
        txtDteEstado = new TextBox();
        lblDteEstado = new Label();
        grpJson = new GroupBox();
        txtRawJson = new TextBox();
        lblEstado = new Label();
        grpConfiguracion.SuspendLayout();
        grpConsulta.SuspendLayout();
        grpConsultaDte.SuspendLayout();
        grpResultado.SuspendLayout();
        grpResultadoDte.SuspendLayout();
        grpJson.SuspendLayout();
        SuspendLayout();
        // 
        // lblTitulo
        // 
        lblTitulo.AutoSize = true;
        lblTitulo.Font = new Font("Segoe UI", 15.75F, FontStyle.Bold, GraphicsUnit.Point, 0);
        lblTitulo.Location = new Point(18, 15);
        lblTitulo.Name = "lblTitulo";
        lblTitulo.Size = new Size(427, 30);
        lblTitulo.TabIndex = 0;
        lblTitulo.Text = "SimpleRut Desktop · Consulta RUT y DTE";
        // 
        // grpConfiguracion
        // 
        grpConfiguracion.Controls.Add(txtDteInfoEndpoint);
        grpConfiguracion.Controls.Add(lblDteInfoEndpoint);
        grpConfiguracion.Controls.Add(txtDteAuthPassword);
        grpConfiguracion.Controls.Add(lblDteAuthPassword);
        grpConfiguracion.Controls.Add(txtDteAuthRut);
        grpConfiguracion.Controls.Add(lblDteAuthRut);
        grpConfiguracion.Controls.Add(btnGuardarConfig);
        grpConfiguracion.Controls.Add(cmbAuthMode);
        grpConfiguracion.Controls.Add(lblAuthMode);
        grpConfiguracion.Controls.Add(txtRutEndpoint);
        grpConfiguracion.Controls.Add(lblRutEndpoint);
        grpConfiguracion.Controls.Add(txtTokenUrl);
        grpConfiguracion.Controls.Add(lblTokenUrl);
        grpConfiguracion.Controls.Add(txtApiKey);
        grpConfiguracion.Controls.Add(lblApiKey);
        grpConfiguracion.Location = new Point(18, 58);
        grpConfiguracion.Name = "grpConfiguracion";
        grpConfiguracion.Size = new Size(1046, 235);
        grpConfiguracion.TabIndex = 1;
        grpConfiguracion.TabStop = false;
        grpConfiguracion.Text = "Configuracion";
        // 
        // txtDteInfoEndpoint
        // 
        txtDteInfoEndpoint.Location = new Point(19, 140);
        txtDteInfoEndpoint.Name = "txtDteInfoEndpoint";
        txtDteInfoEndpoint.Size = new Size(1002, 23);
        txtDteInfoEndpoint.TabIndex = 10;
        // 
        // lblDteInfoEndpoint
        // 
        lblDteInfoEndpoint.AutoSize = true;
        lblDteInfoEndpoint.Location = new Point(19, 122);
        lblDteInfoEndpoint.Name = "lblDteInfoEndpoint";
        lblDteInfoEndpoint.Size = new Size(290, 15);
        lblDteInfoEndpoint.TabIndex = 9;
        lblDteInfoEndpoint.Text = "Endpoint consulta DTE (por defecto /api/v1/consulta...)";
        // 
        // txtDteAuthPassword
        // 
        txtDteAuthPassword.Location = new Point(493, 188);
        txtDteAuthPassword.Name = "txtDteAuthPassword";
        txtDteAuthPassword.Size = new Size(266, 23);
        txtDteAuthPassword.TabIndex = 14;
        txtDteAuthPassword.UseSystemPasswordChar = true;
        // 
        // lblDteAuthPassword
        // 
        lblDteAuthPassword.AutoSize = true;
        lblDteAuthPassword.Location = new Point(493, 170);
        lblDteAuthPassword.Name = "lblDteAuthPassword";
        lblDteAuthPassword.Size = new Size(126, 15);
        lblDteAuthPassword.TabIndex = 13;
        lblDteAuthPassword.Text = "Clave SII consulta DTE";
        // 
        // txtDteAuthRut
        // 
        txtDteAuthRut.Location = new Point(19, 188);
        txtDteAuthRut.Name = "txtDteAuthRut";
        txtDteAuthRut.Size = new Size(451, 23);
        txtDteAuthRut.TabIndex = 12;
        // 
        // lblDteAuthRut
        // 
        lblDteAuthRut.AutoSize = true;
        lblDteAuthRut.Location = new Point(19, 170);
        lblDteAuthRut.Name = "lblDteAuthRut";
        lblDteAuthRut.Size = new Size(153, 15);
        lblDteAuthRut.TabIndex = 11;
        lblDteAuthRut.Text = "RUT SII consulta DTE (opcional)";
        // 
        // btnGuardarConfig
        // 
        btnGuardarConfig.Location = new Point(884, 186);
        btnGuardarConfig.Name = "btnGuardarConfig";
        btnGuardarConfig.Size = new Size(137, 28);
        btnGuardarConfig.TabIndex = 15;
        btnGuardarConfig.Text = "Guardar configuracion";
        btnGuardarConfig.UseVisualStyleBackColor = true;
        btnGuardarConfig.Click += btnGuardarConfig_Click;
        // 
        // cmbAuthMode
        // 
        cmbAuthMode.DropDownStyle = ComboBoxStyle.DropDownList;
        cmbAuthMode.FormattingEnabled = true;
        cmbAuthMode.Items.AddRange(new object[] { "Bearer Token", "Basic api:apikey", "x-api-key" });
        cmbAuthMode.Location = new Point(781, 39);
        cmbAuthMode.Name = "cmbAuthMode";
        cmbAuthMode.Size = new Size(240, 23);
        cmbAuthMode.TabIndex = 4;
        cmbAuthMode.SelectedIndexChanged += cmbAuthMode_SelectedIndexChanged;
        // 
        // lblAuthMode
        // 
        lblAuthMode.AutoSize = true;
        lblAuthMode.Location = new Point(781, 21);
        lblAuthMode.Name = "lblAuthMode";
        lblAuthMode.Size = new Size(113, 15);
        lblAuthMode.TabIndex = 3;
        lblAuthMode.Text = "Modo autenticacion";
        // 
        // txtRutEndpoint
        // 
        txtRutEndpoint.Location = new Point(19, 91);
        txtRutEndpoint.Name = "txtRutEndpoint";
        txtRutEndpoint.Size = new Size(1002, 23);
        txtRutEndpoint.TabIndex = 8;
        // 
        // lblRutEndpoint
        // 
        lblRutEndpoint.AutoSize = true;
        lblRutEndpoint.Location = new Point(19, 73);
        lblRutEndpoint.Name = "lblRutEndpoint";
        lblRutEndpoint.Size = new Size(309, 15);
        lblRutEndpoint.TabIndex = 7;
        lblRutEndpoint.Text = "Endpoint consulta RUT (usa {rut}, por ejemplo .../{rut})";
        // 
        // txtTokenUrl
        // 
        txtTokenUrl.Location = new Point(493, 39);
        txtTokenUrl.Name = "txtTokenUrl";
        txtTokenUrl.Size = new Size(266, 23);
        txtTokenUrl.TabIndex = 2;
        // 
        // lblTokenUrl
        // 
        lblTokenUrl.AutoSize = true;
        lblTokenUrl.Location = new Point(493, 21);
        lblTokenUrl.Name = "lblTokenUrl";
        lblTokenUrl.Size = new Size(104, 15);
        lblTokenUrl.TabIndex = 1;
        lblTokenUrl.Text = "URL token Bearer";
        // 
        // txtApiKey
        // 
        txtApiKey.Location = new Point(19, 39);
        txtApiKey.Name = "txtApiKey";
        txtApiKey.Size = new Size(451, 23);
        txtApiKey.TabIndex = 0;
        txtApiKey.UseSystemPasswordChar = true;
        // 
        // lblApiKey
        // 
        lblApiKey.AutoSize = true;
        lblApiKey.Location = new Point(19, 21);
        lblApiKey.Name = "lblApiKey";
        lblApiKey.Size = new Size(115, 15);
        lblApiKey.TabIndex = 0;
        lblApiKey.Text = "API key SimpleAPI";
        // 
        // grpConsulta
        // 
        grpConsulta.Controls.Add(btnConsultar);
        grpConsulta.Controls.Add(txtRutConsulta);
        grpConsulta.Controls.Add(lblRutConsulta);
        grpConsulta.Location = new Point(18, 302);
        grpConsulta.Name = "grpConsulta";
        grpConsulta.Size = new Size(508, 76);
        grpConsulta.TabIndex = 2;
        grpConsulta.TabStop = false;
        grpConsulta.Text = "Consulta RUT";
        // 
        // btnConsultar
        // 
        btnConsultar.Location = new Point(353, 31);
        btnConsultar.Name = "btnConsultar";
        btnConsultar.Size = new Size(149, 28);
        btnConsultar.TabIndex = 2;
        btnConsultar.Text = "Consultar RUT";
        btnConsultar.UseVisualStyleBackColor = true;
        btnConsultar.Click += btnConsultar_Click;
        // 
        // txtRutConsulta
        // 
        txtRutConsulta.Location = new Point(19, 33);
        txtRutConsulta.Name = "txtRutConsulta";
        txtRutConsulta.Size = new Size(314, 23);
        txtRutConsulta.TabIndex = 1;
        // 
        // lblRutConsulta
        // 
        lblRutConsulta.AutoSize = true;
        lblRutConsulta.Location = new Point(19, 15);
        lblRutConsulta.Name = "lblRutConsulta";
        lblRutConsulta.Size = new Size(80, 15);
        lblRutConsulta.TabIndex = 0;
        lblRutConsulta.Text = "RUT a buscar";
        // 
        // grpConsultaDte
        // 
        grpConsultaDte.Controls.Add(cmbDteAmbiente);
        grpConsultaDte.Controls.Add(lblDteAmbiente);
        grpConsultaDte.Controls.Add(cmbDteTipo);
        grpConsultaDte.Controls.Add(lblDteTipo);
        grpConsultaDte.Controls.Add(dtpDteFecha);
        grpConsultaDte.Controls.Add(lblDteFecha);
        grpConsultaDte.Controls.Add(txtDteFolio);
        grpConsultaDte.Controls.Add(lblDteFolio);
        grpConsultaDte.Controls.Add(txtDteRutReceptor);
        grpConsultaDte.Controls.Add(lblDteRutReceptor);
        grpConsultaDte.Controls.Add(txtDteRutEmpresa);
        grpConsultaDte.Controls.Add(lblDteRutEmpresa);
        grpConsultaDte.Controls.Add(btnConsultarDte);
        grpConsultaDte.Location = new Point(538, 302);
        grpConsultaDte.Name = "grpConsultaDte";
        grpConsultaDte.Size = new Size(526, 180);
        grpConsultaDte.TabIndex = 3;
        grpConsultaDte.TabStop = false;
        grpConsultaDte.Text = "Consulta rechazo boleta / DTE";
        // 
        // cmbDteAmbiente
        // 
        cmbDteAmbiente.DropDownStyle = ComboBoxStyle.DropDownList;
        cmbDteAmbiente.FormattingEnabled = true;
        cmbDteAmbiente.Items.AddRange(new object[] { "0 - Certificacion", "1 - Produccion" });
        cmbDteAmbiente.Location = new Point(357, 89);
        cmbDteAmbiente.Name = "cmbDteAmbiente";
        cmbDteAmbiente.Size = new Size(149, 23);
        cmbDteAmbiente.TabIndex = 10;
        // 
        // lblDteAmbiente
        // 
        lblDteAmbiente.AutoSize = true;
        lblDteAmbiente.Location = new Point(357, 71);
        lblDteAmbiente.Name = "lblDteAmbiente";
        lblDteAmbiente.Size = new Size(61, 15);
        lblDteAmbiente.TabIndex = 9;
        lblDteAmbiente.Text = "Ambiente";
        // 
        // cmbDteTipo
        // 
        cmbDteTipo.DropDownStyle = ComboBoxStyle.DropDownList;
        cmbDteTipo.FormattingEnabled = true;
        cmbDteTipo.Items.AddRange(new object[] { "39", "33", "61", "56" });
        cmbDteTipo.Location = new Point(186, 89);
        cmbDteTipo.Name = "cmbDteTipo";
        cmbDteTipo.Size = new Size(149, 23);
        cmbDteTipo.TabIndex = 8;
        // 
        // lblDteTipo
        // 
        lblDteTipo.AutoSize = true;
        lblDteTipo.Location = new Point(186, 71);
        lblDteTipo.Name = "lblDteTipo";
        lblDteTipo.Size = new Size(53, 15);
        lblDteTipo.TabIndex = 7;
        lblDteTipo.Text = "Tipo DTE";
        // 
        // dtpDteFecha
        // 
        dtpDteFecha.Format = DateTimePickerFormat.Short;
        dtpDteFecha.Location = new Point(19, 89);
        dtpDteFecha.Name = "dtpDteFecha";
        dtpDteFecha.Size = new Size(149, 23);
        dtpDteFecha.TabIndex = 6;
        // 
        // lblDteFecha
        // 
        lblDteFecha.AutoSize = true;
        lblDteFecha.Location = new Point(19, 71);
        lblDteFecha.Name = "lblDteFecha";
        lblDteFecha.Size = new Size(81, 15);
        lblDteFecha.TabIndex = 5;
        lblDteFecha.Text = "Fecha emision";
        // 
        // txtDteFolio
        // 
        txtDteFolio.Location = new Point(357, 39);
        txtDteFolio.Name = "txtDteFolio";
        txtDteFolio.Size = new Size(149, 23);
        txtDteFolio.TabIndex = 4;
        // 
        // lblDteFolio
        // 
        lblDteFolio.AutoSize = true;
        lblDteFolio.Location = new Point(357, 21);
        lblDteFolio.Name = "lblDteFolio";
        lblDteFolio.Size = new Size(35, 15);
        lblDteFolio.TabIndex = 3;
        lblDteFolio.Text = "Folio";
        // 
        // txtDteRutReceptor
        // 
        txtDteRutReceptor.Location = new Point(19, 139);
        txtDteRutReceptor.Name = "txtDteRutReceptor";
        txtDteRutReceptor.Size = new Size(316, 23);
        txtDteRutReceptor.TabIndex = 12;
        // 
        // lblDteRutReceptor
        // 
        lblDteRutReceptor.AutoSize = true;
        lblDteRutReceptor.Location = new Point(19, 121);
        lblDteRutReceptor.Name = "lblDteRutReceptor";
        lblDteRutReceptor.Size = new Size(154, 15);
        lblDteRutReceptor.TabIndex = 11;
        lblDteRutReceptor.Text = "RUT receptor (boleta por defecto)";
        // 
        // txtDteRutEmpresa
        // 
        txtDteRutEmpresa.Location = new Point(19, 39);
        txtDteRutEmpresa.Name = "txtDteRutEmpresa";
        txtDteRutEmpresa.Size = new Size(316, 23);
        txtDteRutEmpresa.TabIndex = 2;
        // 
        // lblDteRutEmpresa
        // 
        lblDteRutEmpresa.AutoSize = true;
        lblDteRutEmpresa.Location = new Point(19, 21);
        lblDteRutEmpresa.Name = "lblDteRutEmpresa";
        lblDteRutEmpresa.Size = new Size(118, 15);
        lblDteRutEmpresa.TabIndex = 1;
        lblDteRutEmpresa.Text = "RUT empresa emisora";
        // 
        // btnConsultarDte
        // 
        btnConsultarDte.Location = new Point(357, 135);
        btnConsultarDte.Name = "btnConsultarDte";
        btnConsultarDte.Size = new Size(149, 28);
        btnConsultarDte.TabIndex = 13;
        btnConsultarDte.Text = "Consultar DTE";
        btnConsultarDte.UseVisualStyleBackColor = true;
        btnConsultarDte.Click += btnConsultarDte_Click;
        // 
        // grpResultado
        // 
        grpResultado.Controls.Add(txtTelefono);
        grpResultado.Controls.Add(lblTelefono);
        grpResultado.Controls.Add(txtCorreo);
        grpResultado.Controls.Add(lblCorreo);
        grpResultado.Controls.Add(txtCiudad);
        grpResultado.Controls.Add(lblCiudad);
        grpResultado.Controls.Add(txtComuna);
        grpResultado.Controls.Add(lblComuna);
        grpResultado.Controls.Add(txtDireccion);
        grpResultado.Controls.Add(lblDireccion);
        grpResultado.Controls.Add(txtGiro);
        grpResultado.Controls.Add(lblGiro);
        grpResultado.Controls.Add(txtRazonSocial);
        grpResultado.Controls.Add(lblRazonSocial);
        grpResultado.Controls.Add(txtRutResultado);
        grpResultado.Controls.Add(lblRutResultado);
        grpResultado.Location = new Point(18, 387);
        grpResultado.Name = "grpResultado";
        grpResultado.Size = new Size(508, 241);
        grpResultado.TabIndex = 4;
        grpResultado.TabStop = false;
        grpResultado.Text = "Datos utiles para factura";
        // 
        // txtTelefono
        // 
        txtTelefono.Location = new Point(19, 198);
        txtTelefono.Name = "txtTelefono";
        txtTelefono.ReadOnly = true;
        txtTelefono.Size = new Size(470, 23);
        txtTelefono.TabIndex = 15;
        // 
        // lblTelefono
        // 
        lblTelefono.AutoSize = true;
        lblTelefono.Location = new Point(19, 180);
        lblTelefono.Name = "lblTelefono";
        lblTelefono.Size = new Size(53, 15);
        lblTelefono.TabIndex = 14;
        lblTelefono.Text = "Telefono";
        // 
        // txtCorreo
        // 
        txtCorreo.Location = new Point(19, 154);
        txtCorreo.Name = "txtCorreo";
        txtCorreo.ReadOnly = true;
        txtCorreo.Size = new Size(470, 23);
        txtCorreo.TabIndex = 13;
        // 
        // lblCorreo
        // 
        lblCorreo.AutoSize = true;
        lblCorreo.Location = new Point(19, 136);
        lblCorreo.Name = "lblCorreo";
        lblCorreo.Size = new Size(43, 15);
        lblCorreo.TabIndex = 12;
        lblCorreo.Text = "Correo";
        // 
        // txtCiudad
        // 
        txtCiudad.Location = new Point(252, 110);
        txtCiudad.Name = "txtCiudad";
        txtCiudad.ReadOnly = true;
        txtCiudad.Size = new Size(237, 23);
        txtCiudad.TabIndex = 11;
        // 
        // lblCiudad
        // 
        lblCiudad.AutoSize = true;
        lblCiudad.Location = new Point(252, 92);
        lblCiudad.Name = "lblCiudad";
        lblCiudad.Size = new Size(46, 15);
        lblCiudad.TabIndex = 10;
        lblCiudad.Text = "Ciudad";
        // 
        // txtComuna
        // 
        txtComuna.Location = new Point(19, 110);
        txtComuna.Name = "txtComuna";
        txtComuna.ReadOnly = true;
        txtComuna.Size = new Size(217, 23);
        txtComuna.TabIndex = 9;
        // 
        // lblComuna
        // 
        lblComuna.AutoSize = true;
        lblComuna.Location = new Point(19, 92);
        lblComuna.Name = "lblComuna";
        lblComuna.Size = new Size(54, 15);
        lblComuna.TabIndex = 8;
        lblComuna.Text = "Comuna";
        // 
        // txtDireccion
        // 
        txtDireccion.Location = new Point(252, 66);
        txtDireccion.Name = "txtDireccion";
        txtDireccion.ReadOnly = true;
        txtDireccion.Size = new Size(237, 23);
        txtDireccion.TabIndex = 7;
        // 
        // lblDireccion
        // 
        lblDireccion.AutoSize = true;
        lblDireccion.Location = new Point(252, 48);
        lblDireccion.Name = "lblDireccion";
        lblDireccion.Size = new Size(57, 15);
        lblDireccion.TabIndex = 6;
        lblDireccion.Text = "Direccion";
        // 
        // txtGiro
        // 
        txtGiro.Location = new Point(19, 66);
        txtGiro.Name = "txtGiro";
        txtGiro.ReadOnly = true;
        txtGiro.Size = new Size(217, 23);
        txtGiro.TabIndex = 5;
        // 
        // lblGiro
        // 
        lblGiro.AutoSize = true;
        lblGiro.Location = new Point(19, 48);
        lblGiro.Name = "lblGiro";
        lblGiro.Size = new Size(30, 15);
        lblGiro.TabIndex = 4;
        lblGiro.Text = "Giro";
        // 
        // txtRazonSocial
        // 
        txtRazonSocial.Location = new Point(252, 22);
        txtRazonSocial.Name = "txtRazonSocial";
        txtRazonSocial.ReadOnly = true;
        txtRazonSocial.Size = new Size(237, 23);
        txtRazonSocial.TabIndex = 3;
        // 
        // lblRazonSocial
        // 
        lblRazonSocial.AutoSize = true;
        lblRazonSocial.Location = new Point(252, 4);
        lblRazonSocial.Name = "lblRazonSocial";
        lblRazonSocial.Size = new Size(74, 15);
        lblRazonSocial.TabIndex = 2;
        lblRazonSocial.Text = "Razon social";
        // 
        // txtRutResultado
        // 
        txtRutResultado.Location = new Point(19, 22);
        txtRutResultado.Name = "txtRutResultado";
        txtRutResultado.ReadOnly = true;
        txtRutResultado.Size = new Size(217, 23);
        txtRutResultado.TabIndex = 1;
        // 
        // lblRutResultado
        // 
        lblRutResultado.AutoSize = true;
        lblRutResultado.Location = new Point(19, 4);
        lblRutResultado.Name = "lblRutResultado";
        lblRutResultado.Size = new Size(26, 15);
        lblRutResultado.TabIndex = 0;
        lblRutResultado.Text = "RUT";
        // 
        // grpResultadoDte
        // 
        grpResultadoDte.Controls.Add(txtDteTrackId);
        grpResultadoDte.Controls.Add(lblDteTrackId);
        grpResultadoDte.Controls.Add(txtDteReparos);
        grpResultadoDte.Controls.Add(lblDteReparos);
        grpResultadoDte.Controls.Add(txtDteDetalle);
        grpResultadoDte.Controls.Add(lblDteDetalle);
        grpResultadoDte.Controls.Add(txtDteEstado);
        grpResultadoDte.Controls.Add(lblDteEstado);
        grpResultadoDte.Location = new Point(538, 491);
        grpResultadoDte.Name = "grpResultadoDte";
        grpResultadoDte.Size = new Size(526, 137);
        grpResultadoDte.TabIndex = 5;
        grpResultadoDte.TabStop = false;
        grpResultadoDte.Text = "Resultado consulta DTE";
        // 
        // txtDteTrackId
        // 
        txtDteTrackId.Location = new Point(357, 39);
        txtDteTrackId.Name = "txtDteTrackId";
        txtDteTrackId.ReadOnly = true;
        txtDteTrackId.Size = new Size(149, 23);
        txtDteTrackId.TabIndex = 3;
        // 
        // lblDteTrackId
        // 
        lblDteTrackId.AutoSize = true;
        lblDteTrackId.Location = new Point(357, 21);
        lblDteTrackId.Name = "lblDteTrackId";
        lblDteTrackId.Size = new Size(47, 15);
        lblDteTrackId.TabIndex = 2;
        lblDteTrackId.Text = "Track ID";
        // 
        // txtDteReparos
        // 
        txtDteReparos.Location = new Point(19, 91);
        txtDteReparos.Name = "txtDteReparos";
        txtDteReparos.ReadOnly = true;
        txtDteReparos.Size = new Size(487, 23);
        txtDteReparos.TabIndex = 7;
        // 
        // lblDteReparos
        // 
        lblDteReparos.AutoSize = true;
        lblDteReparos.Location = new Point(19, 73);
        lblDteReparos.Name = "lblDteReparos";
        lblDteReparos.Size = new Size(55, 15);
        lblDteReparos.TabIndex = 6;
        lblDteReparos.Text = "Reparos";
        // 
        // txtDteDetalle
        // 
        txtDteDetalle.Location = new Point(131, 39);
        txtDteDetalle.Name = "txtDteDetalle";
        txtDteDetalle.ReadOnly = true;
        txtDteDetalle.Size = new Size(204, 23);
        txtDteDetalle.TabIndex = 5;
        // 
        // lblDteDetalle
        // 
        lblDteDetalle.AutoSize = true;
        lblDteDetalle.Location = new Point(131, 21);
        lblDteDetalle.Name = "lblDteDetalle";
        lblDteDetalle.Size = new Size(43, 15);
        lblDteDetalle.TabIndex = 4;
        lblDteDetalle.Text = "Detalle";
        // 
        // txtDteEstado
        // 
        txtDteEstado.Location = new Point(19, 39);
        txtDteEstado.Name = "txtDteEstado";
        txtDteEstado.ReadOnly = true;
        txtDteEstado.Size = new Size(94, 23);
        txtDteEstado.TabIndex = 1;
        // 
        // lblDteEstado
        // 
        lblDteEstado.AutoSize = true;
        lblDteEstado.Location = new Point(19, 21);
        lblDteEstado.Name = "lblDteEstado";
        lblDteEstado.Size = new Size(42, 15);
        lblDteEstado.TabIndex = 0;
        lblDteEstado.Text = "Estado";
        // 
        // grpJson
        // 
        grpJson.Controls.Add(txtRawJson);
        grpJson.Location = new Point(18, 641);
        grpJson.Name = "grpJson";
        grpJson.Size = new Size(1046, 216);
        grpJson.TabIndex = 6;
        grpJson.TabStop = false;
        grpJson.Text = "Respuesta JSON";
        // 
        // txtRawJson
        // 
        txtRawJson.Dock = DockStyle.Fill;
        txtRawJson.Location = new Point(3, 19);
        txtRawJson.Multiline = true;
        txtRawJson.Name = "txtRawJson";
        txtRawJson.ReadOnly = true;
        txtRawJson.ScrollBars = ScrollBars.Both;
        txtRawJson.Size = new Size(1040, 194);
        txtRawJson.TabIndex = 0;
        txtRawJson.WordWrap = false;
        // 
        // lblEstado
        // 
        lblEstado.AutoSize = true;
        lblEstado.Location = new Point(18, 869);
        lblEstado.Name = "lblEstado";
        lblEstado.Size = new Size(34, 15);
        lblEstado.TabIndex = 7;
        lblEstado.Text = "Listo";
        // 
        // Form1
        // 
        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(1082, 898);
        Controls.Add(lblEstado);
        Controls.Add(grpJson);
        Controls.Add(grpResultadoDte);
        Controls.Add(grpResultado);
        Controls.Add(grpConsultaDte);
        Controls.Add(grpConsulta);
        Controls.Add(grpConfiguracion);
        Controls.Add(lblTitulo);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        Name = "Form1";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "Simple RUT Desktop";
        grpConfiguracion.ResumeLayout(false);
        grpConfiguracion.PerformLayout();
        grpConsulta.ResumeLayout(false);
        grpConsulta.PerformLayout();
        grpConsultaDte.ResumeLayout(false);
        grpConsultaDte.PerformLayout();
        grpResultado.ResumeLayout(false);
        grpResultado.PerformLayout();
        grpResultadoDte.ResumeLayout(false);
        grpResultadoDte.PerformLayout();
        grpJson.ResumeLayout(false);
        grpJson.PerformLayout();
        ResumeLayout(false);
        PerformLayout();
    }

    #endregion

    private Label lblTitulo;
    private GroupBox grpConfiguracion;
    private TextBox txtApiKey;
    private Label lblApiKey;
    private TextBox txtTokenUrl;
    private Label lblTokenUrl;
    private TextBox txtRutEndpoint;
    private Label lblRutEndpoint;
    private ComboBox cmbAuthMode;
    private Label lblAuthMode;
    private Button btnGuardarConfig;
    private TextBox txtDteInfoEndpoint;
    private Label lblDteInfoEndpoint;
    private TextBox txtDteAuthPassword;
    private Label lblDteAuthPassword;
    private TextBox txtDteAuthRut;
    private Label lblDteAuthRut;
    private GroupBox grpConsulta;
    private Button btnConsultar;
    private TextBox txtRutConsulta;
    private Label lblRutConsulta;
    private GroupBox grpConsultaDte;
    private ComboBox cmbDteAmbiente;
    private Label lblDteAmbiente;
    private ComboBox cmbDteTipo;
    private Label lblDteTipo;
    private DateTimePicker dtpDteFecha;
    private Label lblDteFecha;
    private TextBox txtDteFolio;
    private Label lblDteFolio;
    private TextBox txtDteRutReceptor;
    private Label lblDteRutReceptor;
    private TextBox txtDteRutEmpresa;
    private Label lblDteRutEmpresa;
    private Button btnConsultarDte;
    private GroupBox grpResultado;
    private TextBox txtTelefono;
    private Label lblTelefono;
    private TextBox txtCorreo;
    private Label lblCorreo;
    private TextBox txtCiudad;
    private Label lblCiudad;
    private TextBox txtComuna;
    private Label lblComuna;
    private TextBox txtDireccion;
    private Label lblDireccion;
    private TextBox txtGiro;
    private Label lblGiro;
    private TextBox txtRazonSocial;
    private Label lblRazonSocial;
    private TextBox txtRutResultado;
    private Label lblRutResultado;
    private GroupBox grpResultadoDte;
    private TextBox txtDteTrackId;
    private Label lblDteTrackId;
    private TextBox txtDteReparos;
    private Label lblDteReparos;
    private TextBox txtDteDetalle;
    private Label lblDteDetalle;
    private TextBox txtDteEstado;
    private Label lblDteEstado;
    private GroupBox grpJson;
    private TextBox txtRawJson;
    private Label lblEstado;
}
