param(
  [Parameter(Mandatory = $true)][ValidateSet('Create', 'Extract')][string]$Action,
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourcePath = [IO.Path]::GetFullPath($Source)
$destinationPath = [IO.Path]::GetFullPath($Destination)
if ($Action -eq 'Create') {
  if (Test-Path -LiteralPath $destinationPath) { throw 'Archive already exists' }
  [IO.Compression.ZipFile]::CreateFromDirectory($sourcePath, $destinationPath, [IO.Compression.CompressionLevel]::Optimal, $false)
} else {
  [IO.Compression.ZipFile]::ExtractToDirectory($sourcePath, $destinationPath)
}
