namespace SimpleRutDesktop;

static class Program
{
    /// <summary>
    ///  The main entry point for the application.
    /// </summary>
    [STAThread]
    static async Task Main(string[] args)
    {
        if (args.Any(arg => string.Equals(arg, "--diagnostico-factura", StringComparison.OrdinalIgnoreCase)))
        {
            Environment.ExitCode = await Services.FacturaDiagnosticRunner.RunAsync(args);
            return;
        }

        // To customize application configuration such as set high DPI settings or default font,
        // see https://aka.ms/applicationconfiguration.
        ApplicationConfiguration.Initialize();
        Application.Run(new Form1());
    }    
}
