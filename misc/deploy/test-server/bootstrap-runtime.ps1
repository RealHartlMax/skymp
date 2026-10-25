param(
  [switch]$CheckOnly,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ServerArguments
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { throw 'Dieses Serverpaket benoetigt Windows x64.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$runtimeRoot = Join-Path $PSScriptRoot '.runtime'
if ((Test-Path -LiteralPath $runtimeRoot) -and ((Get-Item -LiteralPath $runtimeRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw '.runtime darf kein Verzeichnislink sein.' }
function Test-Node([string]$Candidate) {
  if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) { return $false }
  try { & $Candidate -e "if (+process.versions.node.split('.')[0] < 22 || process.arch !== 'x64') process.exit(1)" 2>$null; return $LASTEXITCODE -eq 0 } catch { return $false }
}
function Remove-RuntimeStage([string]$Directory) {
  $resolved = [IO.Path]::GetFullPath($Directory)
  $parent = [IO.Path]::GetFullPath($runtimeRoot)
  if ([IO.Path]::GetDirectoryName($resolved) -ne $parent -or [IO.Path]::GetFileName($resolved) -notmatch '^staging-[a-f0-9]{32}$') { throw 'Ungueltiges temporaeres Laufzeitverzeichnis.' }
  if (Test-Path -LiteralPath $resolved) {
    if ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Temporaeres Laufzeitverzeichnis ist ein Link.' }
    for ($attempt = 0; $attempt -lt 4; $attempt++) {
      try { Remove-Item -LiteralPath $resolved -Recurse -Force; return }
      catch { if ($attempt -eq 3) { Write-Warning 'Temporaere Laufzeitdateien sind noch gesperrt und bleiben zur spaeteren Bereinigung erhalten.' } else { Start-Sleep -Milliseconds 300 } }
    }
  }
}
$currentNode = $null
$pointer = Join-Path $runtimeRoot 'node-path.txt'
if (Test-Path -LiteralPath $pointer) {
  $folder = (Get-Content -LiteralPath $pointer -Raw).Trim()
  if ($folder -match '^node-v22\.[0-9]+\.[0-9]+-win-x64$') {
    $candidate = Join-Path (Join-Path $runtimeRoot $folder) 'node.exe'
    if (Test-Node $candidate) { $currentNode = $candidate }
  }
}
$node = $null
if (-not $currentNode -and $env:SKYMP_MANAGED_NODE -ne '1') {
  $systemNode = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($systemNode -and (Test-Node $systemNode.Source)) { $node = $systemNode.Source }
}
if (-not $node) {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $checkedFile = Join-Path $runtimeRoot 'checked-at.txt'
  $checked = 0L
  if (Test-Path -LiteralPath $checkedFile) { [void][long]::TryParse((Get-Content -LiteralPath $checkedFile -Raw).Trim(), [ref]$checked) }
  $cached = $currentNode -and $now -ge $checked -and ($now - $checked) -lt 86400
  if ($env:SKYMP_RUNTIME_OFFLINE -eq '1' -or $cached) {
    if (-not $currentNode) { throw 'Offline-Start: keine passende Node.js-Laufzeit vorhanden.' }
  } else {
    [void][IO.Directory]::CreateDirectory($runtimeRoot)
    $stage = Join-Path $runtimeRoot ('staging-' + [guid]::NewGuid().ToString('N'))
    try {
      [void][IO.Directory]::CreateDirectory($stage)
      Write-Host '[SkyMP] Pruefe die aktuelle Node.js-22-LTS-Laufzeit bei nodejs.org ...'
      $sums = Join-Path $stage 'SHASUMS256.txt'
      Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt' -OutFile $sums -TimeoutSec 30
      $entry = [regex]::Match((Get-Content -LiteralPath $sums -Raw), '(?m)^([a-f0-9]{64})\s+(node-(v22\.[0-9]+\.[0-9]+)-win-x64\.zip)\r?$')
      if (-not $entry.Success) { throw 'Keine gueltige Node.js-x64-Pruefsumme erhalten.' }
      $archiveName = $entry.Groups[2].Value
      $version = $entry.Groups[3].Value
      $folder = $archiveName.Substring(0, $archiveName.Length - 4)
      $destination = Join-Path $runtimeRoot $folder
      $candidate = Join-Path $destination 'node.exe'
      if (-not (Test-Node $candidate)) {
        $archive = Join-Path $stage $archiveName
        Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$version/$archiveName" -OutFile $archive -TimeoutSec 180
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Groups[1].Value) { throw 'Node.js-Pruefsumme stimmt nicht. Installation abgebrochen.' }
        $stagedFolder = Join-Path $stage $folder
        [void][IO.Directory]::CreateDirectory($stagedFolder)
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($archive)
        try {
          foreach ($name in @('node.exe', 'LICENSE')) {
            $item = $zip.GetEntry($folder + '/' + $name)
            if (-not $item) { throw "Node.js-Archivdatei fehlt: $name" }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($item, (Join-Path $stagedFolder $name))
          }
        } finally { $zip.Dispose() }
        if (-not (Test-Node (Join-Path $stagedFolder 'node.exe'))) { throw 'Die neue Node.js-Laufzeit ist nicht ausfuehrbar.' }
        if (Test-Path -LiteralPath $destination) { throw 'Zielversion existiert, ist aber unvollstaendig. Den Ordner pruefen, bevor erneut installiert wird.' }
        # The validated version name fixes both absolute targets below this server's .runtime.
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($destination)) -ne [IO.Path]::GetFullPath($runtimeRoot)) { throw 'Ungueltiges Installationsziel.' }
        Move-Item -LiteralPath $stagedFolder -Destination $destination
      }
      $stagedPointer = Join-Path $stage 'node-path.txt'
      [IO.File]::WriteAllText($stagedPointer, $folder)
      if (Test-Path -LiteralPath $pointer) { [IO.File]::Replace($stagedPointer, $pointer, (Join-Path $stage 'previous-node-path.txt')) }
      else { [IO.File]::Move($stagedPointer, $pointer) }
      [IO.File]::WriteAllText($checkedFile, [string]$now)
      $currentNode = $candidate
    } catch {
      if (-not $currentNode) { throw }
      Write-Warning ('Laufzeitupdate nicht verfuegbar; vorhandene gepruefte Laufzeit bleibt aktiv. ' + $_.Exception.Message)
    } finally { Remove-RuntimeStage $stage }
  }
  $node = $currentNode
}
if (-not (Test-Node $node)) { throw 'Keine passende Node.js-x64-Laufzeit ab Version 22 vorhanden.' }
$env:PATH = [IO.Path]::GetDirectoryName($node) + [IO.Path]::PathSeparator + $env:PATH
if (Test-Path -LiteralPath './scam_native.node') {
  & $node -e "try { require(require('node:path').resolve('scam_native.node')); } catch (e) { console.error(e.message); process.exit(1); }" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[SkyMP] Installiere/aktualisiere die Microsoft Visual-C++-Laufzeit ...'
    [void][IO.Directory]::CreateDirectory($runtimeRoot)
    $installer = Join-Path $runtimeRoot 'vc_redist.x64.exe'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/vc14/vc_redist.x64.exe' -OutFile $installer -TimeoutSec 180
    $signature = Get-AuthenticodeSignature -LiteralPath $installer
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation(?:,|$)') { throw 'Microsoft-Signatur der C++-Laufzeit konnte nicht bestaetigt werden.' }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $admin = ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    $parameters = @{ FilePath=$installer; ArgumentList=@('/install','/quiet','/norestart'); Wait=$true; PassThru=$true; WindowStyle='Hidden' }
    if (-not $admin) { $parameters.Verb = 'RunAs' }
    $installation = Start-Process @parameters
    if ($installation.ExitCode -notin @(0, 1638, 3010)) { throw "C++-Laufzeitinstallation fehlgeschlagen: $($installation.ExitCode)" }
    & $node -e "require(require('node:path').resolve('scam_native.node'))"
    if ($LASTEXITCODE -ne 0) { throw 'Die native Servererweiterung kann nach der Laufzeitinstallation nicht geladen werden. Siehe Fehlermeldung.' }
  }
}
if ($CheckOnly) { Write-Output $node; exit 0 }
& $node setup-server.cjs --ensure
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $node check-install.cjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $node server-supervisor.cjs @ServerArguments
exit $LASTEXITCODE
