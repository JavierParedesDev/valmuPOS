param(
    [string]$AppName = ""
)

$ErrorActionPreference = "Continue"

function Mask-Secret {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
    if ($Value.Length -le 8) { return ("*" * $Value.Length) }
    return ($Value.Substring(0, 4) + ("*" * ($Value.Length - 8)) + $Value.Substring($Value.Length - 4))
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ==="
}

function Get-FileInfoLine {
    param([string]$Path)
    if (!(Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{
            Exists = $false
            Path = $Path
            Length = ""
            LastWriteTime = ""
            Sha256 = ""
        }
    }

    $item = Get-Item -LiteralPath $Path
    $hash = Get-FileHash -LiteralPath $Path -Algorithm SHA256
    return [pscustomobject]@{
        Exists = $true
        Path = $Path
        Length = $item.Length
        LastWriteTime = $item.LastWriteTime
        Sha256 = $hash.Hash
    }
}

$candidateNames = @()
if (![string]::IsNullOrWhiteSpace($AppName)) {
    $candidateNames += $AppName
}
$candidateNames += @("cajero", "Valmu Cajero", "valmu-cajero", "ValmuCajero")
$candidateNames = $candidateNames | Select-Object -Unique

Write-Section "Rutas SII detectadas"
$existingDirs = @()
foreach ($name in $candidateNames) {
    $dir = Join-Path $env:APPDATA "$name\sii_data"
    if (Test-Path -LiteralPath $dir) {
        $existingDirs += $dir
        Write-Host "OK   $dir"
    } else {
        Write-Host "MISS $dir"
    }
}

if ($existingDirs.Count -eq 0) {
    Write-Host ""
    Write-Host "No se encontro carpeta sii_data en APPDATA."
    exit 1
}

foreach ($dir in $existingDirs) {
    Write-Section "Diagnostico $dir"

    $configPath = Join-Path $dir "config.json"
    $config = $null
    if (Test-Path -LiteralPath $configPath) {
        try {
            $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        } catch {
            Write-Host "ERROR leyendo config.json: $($_.Exception.Message)"
        }
    } else {
        Write-Host "Falta config.json"
    }

    if ($config -ne $null) {
        [pscustomobject]@{
            rutEmisor = $config.rutEmisor
            rutEnvia = $config.rutEnvia
            siiAmbiente = $config.siiAmbiente
            certFilename = $config.certFilename
            caf39 = $config.caf_39_filename
            caf33 = $config.caf_33_filename
            apiKey = Mask-Secret $config.apiKey
            certPassword = Mask-Secret $config.certPassword
        } | Format-List
    }

    Write-Section "Archivos"
    $certName = if ($config.certFilename) { [string]$config.certFilename } else { "certificado.pfx" }
    $caf39Name = if ($config.caf_39_filename) { [string]$config.caf_39_filename } else { "CAF_39.xml" }
    $caf33Name = if ($config.caf_33_filename) { [string]$config.caf_33_filename } else { "CAF_33.xml" }

    @(
        (Get-FileInfoLine $configPath),
        (Get-FileInfoLine (Join-Path $dir $certName)),
        (Get-FileInfoLine (Join-Path $dir $caf39Name)),
        (Get-FileInfoLine (Join-Path $dir $caf33Name))
    ) | Format-Table -AutoSize

    Write-Section "Certificado"
    $certPath = Join-Path $dir $certName
    if (($config -ne $null) -and (Test-Path -LiteralPath $certPath)) {
        try {
            $securePassword = ConvertTo-SecureString ([string]$config.certPassword) -AsPlainText -Force
            $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
                $certPath,
                $securePassword,
                [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
            )
            [pscustomobject]@{
                Subject = $cert.Subject
                Issuer = $cert.Issuer
                NotBefore = $cert.NotBefore
                NotAfter = $cert.NotAfter
                HasPrivateKey = $cert.HasPrivateKey
                Thumbprint = $cert.Thumbprint
            } | Format-List
        } catch {
            Write-Host "ERROR abriendo PFX con la contrasena guardada: $($_.Exception.Message)"
        }
    } else {
        Write-Host "No se puede validar certificado: falta config o archivo PFX."
    }

    Write-Section "Ultimos XML generados"
    $boletasDir = Join-Path $dir "boletas"
    if (Test-Path -LiteralPath $boletasDir) {
        Get-ChildItem -LiteralPath $boletasDir -Filter "*.xml" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 8 FullName, LastWriteTime, Length |
            Format-Table -AutoSize
    } else {
        Write-Host "No existe carpeta boletas."
    }
}
