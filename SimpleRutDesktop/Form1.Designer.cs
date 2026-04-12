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
        grpJson = new GroupBox();
        txtRawJson = new TextBox();
        lblEstado = new Label();
        grpConfiguracion.SuspendLayout();
        grpConsulta.SuspendLayout();
        grpResultado.SuspendLayout();
        grpJson.SuspendLayout();
        SuspendLayout();
        // 
        // lblTitulo
        // 
        lblTitulo.AutoSize = true;
        lblTitulo.Font = new Font("Segoe UI", 15.75F, FontStyle.Bold, GraphicsUnit.Point, 0);
        lblTitulo.Location = new Point(18, 15);
        lblTitulo.Name = "lblTitulo";
        lblTitulo.Size = new Size(384, 30);
        lblTitulo.TabIndex = 0;
        lblTitulo.Text = "Consulta RUT para Facturación Simple";
        // 
        // grpConfiguracion
        // 
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
        grpConfiguracion.Size = new Size(939, 182);
        grpConfiguracion.TabIndex = 1;
        grpConfiguracion.TabStop = false;
        grpConfiguracion.Text = "Configuración";
        // 
        // btnGuardarConfig
        // 
        btnGuardarConfig.Location = new Point(782, 138);
        btnGuardarConfig.Name = "btnGuardarConfig";
        btnGuardarConfig.Size = new Size(137, 28);
        btnGuardarConfig.TabIndex = 8;
        btnGuardarConfig.Text = "Guardar Configuración";
        btnGuardarConfig.UseVisualStyleBackColor = true;
        btnGuardarConfig.Click += btnGuardarConfig_Click;
        // 
        // cmbAuthMode
        // 
        cmbAuthMode.DropDownStyle = ComboBoxStyle.DropDownList;
        cmbAuthMode.FormattingEnabled = true;
        cmbAuthMode.Items.AddRange(new object[] { "Bearer Token", "Basic api:apikey", "x-api-key" });
        cmbAuthMode.Location = new Point(19, 139);
        cmbAuthMode.Name = "cmbAuthMode";
        cmbAuthMode.Size = new Size(180, 23);
        cmbAuthMode.TabIndex = 7;
        cmbAuthMode.SelectedIndexChanged += cmbAuthMode_SelectedIndexChanged;
        // 
        // lblAuthMode
        // 
        lblAuthMode.AutoSize = true;
        lblAuthMode.Location = new Point(19, 121);
        lblAuthMode.Name = "lblAuthMode";
        lblAuthMode.Size = new Size(116, 15);
        lblAuthMode.TabIndex = 6;
        lblAuthMode.Text = "Modo autenticación";
        // 
        // txtRutEndpoint
        // 
        txtRutEndpoint.Location = new Point(19, 92);
        txtRutEndpoint.Name = "txtRutEndpoint";
        txtRutEndpoint.Size = new Size(900, 23);
        txtRutEndpoint.TabIndex = 5;
        // 
        // lblRutEndpoint
        // 
        lblRutEndpoint.AutoSize = true;
        lblRutEndpoint.Location = new Point(19, 74);
        lblRutEndpoint.Name = "lblRutEndpoint";
        lblRutEndpoint.Size = new Size(318, 15);
        lblRutEndpoint.TabIndex = 4;
        lblRutEndpoint.Text = "Endpoint consulta RUT (usa {rut}, por ejemplo .../{rut})";
        // 
        // txtTokenUrl
        // 
        txtTokenUrl.Location = new Point(493, 40);
        txtTokenUrl.Name = "txtTokenUrl";
        txtTokenUrl.Size = new Size(426, 23);
        txtTokenUrl.TabIndex = 3;
        // 
        // lblTokenUrl
        // 
        lblTokenUrl.AutoSize = true;
        lblTokenUrl.Location = new Point(493, 22);
        lblTokenUrl.Name = "lblTokenUrl";
        lblTokenUrl.Size = new Size(108, 15);
        lblTokenUrl.TabIndex = 2;
        lblTokenUrl.Text = "URL token Bearer";
        // 
        // txtApiKey
        // 
        txtApiKey.Location = new Point(19, 40);
        txtApiKey.Name = "txtApiKey";
        txtApiKey.Size = new Size(451, 23);
        txtApiKey.TabIndex = 1;
        // 
        // lblApiKey
        // 
        lblApiKey.AutoSize = true;
        lblApiKey.Location = new Point(19, 22);
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
        grpConsulta.Location = new Point(18, 249);
        grpConsulta.Name = "grpConsulta";
        grpConsulta.Size = new Size(939, 76);
        grpConsulta.TabIndex = 2;
        grpConsulta.TabStop = false;
        grpConsulta.Text = "Consulta";
        // 
        // btnConsultar
        // 
        btnConsultar.Location = new Point(782, 30);
        btnConsultar.Name = "btnConsultar";
        btnConsultar.Size = new Size(137, 28);
        btnConsultar.TabIndex = 2;
        btnConsultar.Text = "Consultar RUT";
        btnConsultar.UseVisualStyleBackColor = true;
        btnConsultar.Click += btnConsultar_Click;
        // 
        // txtRutConsulta
        // 
        txtRutConsulta.Location = new Point(19, 33);
        txtRutConsulta.Name = "txtRutConsulta";
        txtRutConsulta.Size = new Size(250, 23);
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
        grpResultado.Location = new Point(18, 333);
        grpResultado.Name = "grpResultado";
        grpResultado.Size = new Size(939, 210);
        grpResultado.TabIndex = 3;
        grpResultado.TabStop = false;
        grpResultado.Text = "Datos útiles para factura";
        // 
        // txtTelefono
        // 
        txtTelefono.Location = new Point(493, 169);
        txtTelefono.Name = "txtTelefono";
        txtTelefono.ReadOnly = true;
        txtTelefono.Size = new Size(426, 23);
        txtTelefono.TabIndex = 15;
        // 
        // lblTelefono
        // 
        lblTelefono.AutoSize = true;
        lblTelefono.Location = new Point(493, 151);
        lblTelefono.Name = "lblTelefono";
        lblTelefono.Size = new Size(55, 15);
        lblTelefono.TabIndex = 14;
        lblTelefono.Text = "Teléfono";
        // 
        // txtCorreo
        // 
        txtCorreo.Location = new Point(19, 169);
        txtCorreo.Name = "txtCorreo";
        txtCorreo.ReadOnly = true;
        txtCorreo.Size = new Size(451, 23);
        txtCorreo.TabIndex = 13;
        // 
        // lblCorreo
        // 
        lblCorreo.AutoSize = true;
        lblCorreo.Location = new Point(19, 151);
        lblCorreo.Name = "lblCorreo";
        lblCorreo.Size = new Size(43, 15);
        lblCorreo.TabIndex = 12;
        lblCorreo.Text = "Correo";
        // 
        // txtCiudad
        // 
        txtCiudad.Location = new Point(493, 121);
        txtCiudad.Name = "txtCiudad";
        txtCiudad.ReadOnly = true;
        txtCiudad.Size = new Size(426, 23);
        txtCiudad.TabIndex = 11;
        // 
        // lblCiudad
        // 
        lblCiudad.AutoSize = true;
        lblCiudad.Location = new Point(493, 103);
        lblCiudad.Name = "lblCiudad";
        lblCiudad.Size = new Size(46, 15);
        lblCiudad.TabIndex = 10;
        lblCiudad.Text = "Ciudad";
        // 
        // txtComuna
        // 
        txtComuna.Location = new Point(19, 121);
        txtComuna.Name = "txtComuna";
        txtComuna.ReadOnly = true;
        txtComuna.Size = new Size(451, 23);
        txtComuna.TabIndex = 9;
        // 
        // lblComuna
        // 
        lblComuna.AutoSize = true;
        lblComuna.Location = new Point(19, 103);
        lblComuna.Name = "lblComuna";
        lblComuna.Size = new Size(54, 15);
        lblComuna.TabIndex = 8;
        lblComuna.Text = "Comuna";
        // 
        // txtDireccion
        // 
        txtDireccion.Location = new Point(493, 73);
        txtDireccion.Name = "txtDireccion";
        txtDireccion.ReadOnly = true;
        txtDireccion.Size = new Size(426, 23);
        txtDireccion.TabIndex = 7;
        // 
        // lblDireccion
        // 
        lblDireccion.AutoSize = true;
        lblDireccion.Location = new Point(493, 55);
        lblDireccion.Name = "lblDireccion";
        lblDireccion.Size = new Size(57, 15);
        lblDireccion.TabIndex = 6;
        lblDireccion.Text = "Dirección";
        // 
        // txtGiro
        // 
        txtGiro.Location = new Point(19, 73);
        txtGiro.Name = "txtGiro";
        txtGiro.ReadOnly = true;
        txtGiro.Size = new Size(451, 23);
        txtGiro.TabIndex = 5;
        // 
        // lblGiro
        // 
        lblGiro.AutoSize = true;
        lblGiro.Location = new Point(19, 55);
        lblGiro.Name = "lblGiro";
        lblGiro.Size = new Size(30, 15);
        lblGiro.TabIndex = 4;
        lblGiro.Text = "Giro";
        // 
        // txtRazonSocial
        // 
        txtRazonSocial.Location = new Point(493, 25);
        txtRazonSocial.Name = "txtRazonSocial";
        txtRazonSocial.ReadOnly = true;
        txtRazonSocial.Size = new Size(426, 23);
        txtRazonSocial.TabIndex = 3;
        // 
        // lblRazonSocial
        // 
        lblRazonSocial.AutoSize = true;
        lblRazonSocial.Location = new Point(493, 7);
        lblRazonSocial.Name = "lblRazonSocial";
        lblRazonSocial.Size = new Size(75, 15);
        lblRazonSocial.TabIndex = 2;
        lblRazonSocial.Text = "Razón social";
        // 
        // txtRutResultado
        // 
        txtRutResultado.Location = new Point(19, 25);
        txtRutResultado.Name = "txtRutResultado";
        txtRutResultado.ReadOnly = true;
        txtRutResultado.Size = new Size(451, 23);
        txtRutResultado.TabIndex = 1;
        // 
        // lblRutResultado
        // 
        lblRutResultado.AutoSize = true;
        lblRutResultado.Location = new Point(19, 7);
        lblRutResultado.Name = "lblRutResultado";
        lblRutResultado.Size = new Size(26, 15);
        lblRutResultado.TabIndex = 0;
        lblRutResultado.Text = "RUT";
        // 
        // grpJson
        // 
        grpJson.Controls.Add(txtRawJson);
        grpJson.Location = new Point(18, 551);
        grpJson.Name = "grpJson";
        grpJson.Size = new Size(939, 181);
        grpJson.TabIndex = 4;
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
        txtRawJson.Size = new Size(933, 159);
        txtRawJson.TabIndex = 0;
        txtRawJson.WordWrap = false;
        // 
        // lblEstado
        // 
        lblEstado.AutoSize = true;
        lblEstado.Location = new Point(18, 741);
        lblEstado.Name = "lblEstado";
        lblEstado.Size = new Size(34, 15);
        lblEstado.TabIndex = 5;
        lblEstado.Text = "Listo";
        // 
        // Form1
        // 
        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(976, 770);
        Controls.Add(lblEstado);
        Controls.Add(grpJson);
        Controls.Add(grpResultado);
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
        grpResultado.ResumeLayout(false);
        grpResultado.PerformLayout();
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
    private GroupBox grpConsulta;
    private Button btnConsultar;
    private TextBox txtRutConsulta;
    private Label lblRutConsulta;
    private GroupBox grpResultado;
    private TextBox txtRutResultado;
    private Label lblRutResultado;
    private TextBox txtRazonSocial;
    private Label lblRazonSocial;
    private TextBox txtGiro;
    private Label lblGiro;
    private TextBox txtDireccion;
    private Label lblDireccion;
    private TextBox txtComuna;
    private Label lblComuna;
    private TextBox txtCiudad;
    private Label lblCiudad;
    private TextBox txtCorreo;
    private Label lblCorreo;
    private TextBox txtTelefono;
    private Label lblTelefono;
    private GroupBox grpJson;
    private TextBox txtRawJson;
    private Label lblEstado;
}
