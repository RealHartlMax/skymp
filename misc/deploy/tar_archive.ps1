param(
  [Parameter(Mandatory = $true)][ValidateSet('Create', 'Extract')][string]$Action,
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Formats.Tar
$sourcePath = [IO.Path]::GetFullPath($Source)
$destinationPath = [IO.Path]::GetFullPath($Destination)
if ($Action -eq 'Create') {
  if (Test-Path -LiteralPath $destinationPath) { throw 'Archive already exists' }
  [System.Formats.Tar.TarFile]::CreateFromDirectory($sourcePath, $destinationPath, $false)
} else {
  [IO.Directory]::CreateDirectory($destinationPath) | Out-Null
  [System.Formats.Tar.TarFile]::ExtractToDirectory($sourcePath, $destinationPath, $false)
}
