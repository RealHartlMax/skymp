param(
    [Parameter(Mandatory = $true)][string]$GameDirectory,
    [Parameter(Mandatory = $true)][string]$RuntimeDirectory,
    [string]$BackupDirectory,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$game = (Resolve-Path -LiteralPath $GameDirectory).Path.TrimEnd('\', '/')
$runtime = (Resolve-Path -LiteralPath $RuntimeDirectory).Path.TrimEnd('\', '/')
$manifest = Get-Content -LiteralPath (Join-Path $runtime 'runtime-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne 1 -or -not $manifest.files) { throw 'Expected a version-1 runtime manifest' }
$exe = Join-Path $game 'SkyrimSE.exe'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'GameDirectory must contain SkyrimSE.exe' }
$installedVersion = (Get-Item -LiteralPath $exe).VersionInfo.FileVersion
if ($installedVersion -notmatch '\d+\.\d+\.\d+\.\d+') { throw 'Cannot read SkyrimSE.exe version' }
$installedVersion = $Matches[0]
if ($installedVersion -ne $manifest.gameVersion) { throw "Runtime is for Skyrim $($manifest.gameVersion), installed version is $installedVersion" }
if (Get-Process -Name SkyrimSE, SkyrimSELauncher, skse64_loader -ErrorAction SilentlyContinue) { throw 'Close Skyrim and SKSE before changing the installed UI' }

function Assert-SafeFile([string]$root, [string]$relative) {
    if ($relative -match '[\\:\x00-\x1f]' -or $relative.StartsWith('/') -or $relative.Split('/') -contains '..' -or $relative.Split('/') -contains '.') { throw "Unsafe runtime path: $relative" }
    $full = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $full.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path escapes its root' }
    $current = $root
    foreach ($part in $relative.Split('/')) {
        $current = Join-Path $current $part
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Runtime path contains a link: $relative" }
    }
    return $full
}
function Hash([string]$file) { return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
$selected = @($manifest.files | Where-Object { $_.path -ceq 'Data/Platform/Plugins/skymp5-client.js' -or $_.path.StartsWith('Data/Platform/UI/', [StringComparison]::Ordinal) })
foreach ($required in @('Data/Platform/Plugins/skymp5-client.js', 'Data/Platform/UI/build.js', 'Data/Platform/UI/index.html')) {
    if ($required -cnotin $selected.path) { throw "Runtime lacks $required" }
}
$names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$plan = @(
    foreach ($file in $selected) {
        if (-not $names.Add($file.path)) { throw "Duplicate runtime path: $($file.path)" }
        if ($file.path -match '\.(?:dll|exe|bin|ini|pex)$' -or $file.path -match '(?i)(?:auth-data|settings|\.env)(?:\.|$)') { throw "Not a client UI asset: $($file.path)" }
        $source = Assert-SafeFile $runtime $file.path
        $target = Assert-SafeFile $game $file.path
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing runtime file: $($file.path)" }
        if ((Get-Item -LiteralPath $source).Length -ne $file.size -or (Hash $source) -ne $file.sha256) { throw "Runtime hash/size mismatch: $($file.path)" }
        $before = if (Test-Path -LiteralPath $target -PathType Leaf) { Hash $target } else { $null }
        [pscustomobject]@{ path = $file.path; source = $source; target = $target; before = $before; after = $file.sha256; changed = $before -ne $file.sha256 }
    }
)
if (-not ([IO.File]::ReadAllText((Join-Path $runtime 'Data/Platform/Plugins/skymp5-client.js'))).Contains('skympChat:send')) { throw 'Runtime client lacks the ChatBridge' }
if (-not ([IO.File]::ReadAllText((Join-Path $runtime 'Data/Platform/UI/build.js'))).Contains('skympChat:packet')) { throw 'Runtime frontend lacks the ChatBridge' }
$protected = @{}
foreach ($relative in @('Data/Platform/Plugins/skymp5-client-settings.txt', 'Data/Platform/Plugins/auth-data-no-load.js', 'Data/Platform/Plugins/auth-data-no-load.txt')) {
    $file = Join-Path $game $relative
    if (Test-Path -LiteralPath $file -PathType Leaf) { $protected[$relative] = Hash $file }
}
$changed = @($plan | Where-Object changed)
$report = [ordered]@{ passed = $true; applied = $false; gameVersion = $installedVersion; filesChecked = $plan.Count; changedFiles = $changed.Count; nativeFilesChanged = $false; settingsChanged = $false; gameDirectory = $game }
if ($Apply -and $changed.Count -gt 0) {
    if (-not $BackupDirectory) { $BackupDirectory = Join-Path (Join-Path $PSScriptRoot '../../build/backups') ('client-ui-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')) }
    $backup = [IO.Path]::GetFullPath($BackupDirectory)
    foreach ($inputRoot in @($game, $runtime)) {
        if ($backup.Equals($inputRoot, [StringComparison]::OrdinalIgnoreCase) -or $backup.StartsWith($inputRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Keep backups outside the game and runtime source' }
    }
    if (Test-Path -LiteralPath $backup) { throw 'Choose a new backup directory' }
    New-Item -ItemType Directory -Path $backup | Out-Null
    foreach ($file in $changed) {
        if ($file.before) {
            $copy = Assert-SafeFile $backup $file.path
            New-Item -ItemType Directory -Path (Split-Path -Parent $copy) -Force | Out-Null
            Copy-Item -LiteralPath $file.target -Destination $copy
            if ((Hash $copy) -ne $file.before) { throw 'Backup hash mismatch' }
        }
    }
    $record = [ordered]@{ gameDirectory = $game; runtimeDirectory = $runtime; createdAt = [DateTime]::UtcNow.ToString('o'); files = $changed | Select-Object path, before, after }
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backup 'INSTALLATION.json') -Encoding utf8
    try {
        foreach ($file in $changed) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $file.target) -Force | Out-Null
            Copy-Item -LiteralPath $file.source -Destination $file.target -Force
            if ((Hash $file.target) -ne $file.after) { throw "Installed file hash mismatch: $($file.path)" }
        }
        foreach ($relative in $protected.Keys) { if ((Hash (Join-Path $game $relative)) -ne $protected[$relative]) { throw 'Private client settings changed' } }
    } catch {
        foreach ($file in $changed | Where-Object before) { Copy-Item -LiteralPath (Join-Path $backup $file.path) -Destination $file.target -Force }
        throw
    }
    $report.applied = $true
    $report.backupDirectory = $backup
    $report.protectedSettingsUnchanged = $true
} elseif ($Apply) {
    $report.applied = $true
    $report.alreadyCurrent = $true
}
[pscustomobject]$report | ConvertTo-Json
