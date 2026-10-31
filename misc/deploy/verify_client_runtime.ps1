param([Parameter(Mandatory = $true)][string]$PackageDirectory)
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path -LiteralPath $PackageDirectory).Path
$report = Get-Content -LiteralPath (Join-Path $packageRoot 'VALIDATION.json') -Raw | ConvertFrom-Json
$archivePath = Join-Path $packageRoot $report.archive
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $report.archiveSHA256) { throw 'Archive SHA-256 mismatch' }
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
$count = 0
try {
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName.EndsWith('/')) { continue }
        if (-not $entry.FullName.StartsWith('client-runtime/') -or $entry.FullName.Contains('..')) { throw 'Unexpected archive path' }
        $staged = Join-Path (Join-Path $packageRoot 'upload') $entry.FullName
        if ($entry.Length -ne (Get-Item -LiteralPath $staged).Length) { throw "ZIP size mismatch: $($entry.FullName)" }
        $stream = $entry.Open()
        try { $actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant() }
        finally { $stream.Dispose() }
        if ($actual -ne (Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "ZIP entry hash mismatch: $($entry.FullName)" }
        $count++
    }
}
finally { $archive.Dispose() }
[pscustomobject]@{ passed = $true; verifier = '.NET ZipArchive and SHA256'; entries = $count; skyrimStarted = $false } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $packageRoot 'ZIP-VALIDATION.json') -Encoding utf8
Write-Output "Validated $count runtime ZIP entries"
