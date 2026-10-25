param([string] $OutputDirectory = (Join-Path (Get-Location) 'thread-pool-abi-validation'))
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../..')).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Choose a new output directory' }
New-Item -ItemType Directory -Path $output | Out-Null
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$installation) { throw 'MSVC x64 build tools are required' }
$devCmd = Join-Path $installation 'Common7/Tools/VsDevCmd.bat'
$start = [Diagnostics.ProcessStartInfo]::new($env:ComSpec)
$start.Arguments = '/d /s /c ""' + $devCmd + '" -arch=x64 -host_arch=x64 >nul && set"'
$start.UseShellExecute = $false; $start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
$process = [Diagnostics.Process]::Start($start)
$environmentText = $process.StandardOutput.ReadToEnd(); $environmentError = $process.StandardError.ReadToEnd(); $process.WaitForExit()
if ($process.ExitCode -ne 0) { throw $environmentError }
$process.Dispose()
foreach ($line in ($environmentText -split "`r?`n")) {
  if ($line -match '^(Path|INCLUDE|LIB|LIBPATH)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
$include = Join-Path $repo 'skyrim-platform/src/platform_lib'
$vendor = Join-Path $repo 'build/vcpkg_installed/x64-windows-sp/include'
$objects = @()
foreach ($item in @(
  @((Join-Path $PSScriptRoot 'producer20.cpp'), 'c++20', 'producer.obj'),
  @((Join-Path $PSScriptRoot 'consumer-latest.cpp'), 'c++latest', 'consumer.obj'),
  @((Join-Path $include 'ThreadPoolWrapper.cpp'), 'c++20', 'implementation.obj')
)) {
  $object = Join-Path $output $item[2]
  & cl.exe /nologo /c /EHsc /MT /O2 /Z7 /DNOMINMAX /DWIN32_LEAN_AND_MEAN ('/std:' + $item[1]) ('/I' + $include) ('/I' + $vendor) ('/Fo' + $object) $item[0] 2>&1 | Out-File -LiteralPath (Join-Path $output 'compile.log') -Append -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw ('Compile failed: ' + $item[0]) }
  $objects += $object
}
$executable = Join-Path $output 'thread-pool-abi.exe'
& link.exe /nologo ('/OUT:' + $executable) @objects kernel32.lib 2>&1 | Out-File -LiteralPath (Join-Path $output 'compile.log') -Append -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'Regression link failed' }
$start = [Diagnostics.ProcessStartInfo]::new($executable)
$start.UseShellExecute = $false; $start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
$process = [Diagnostics.Process]::Start($start)
$stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
if (!$process.WaitForExit(30000)) { $process.Kill(); throw 'Regression timed out' }
$result = [ordered]@{
  ok = ($process.ExitCode -eq 0)
  exitCode = $process.ExitCode
  stdout = $stdout.GetAwaiter().GetResult()
  stderr = $stderr.GetAwaiter().GetResult()
  sourceSha256 = (Get-FileHash -LiteralPath (Join-Path $include 'ThreadPoolWrapper.cpp') -Algorithm SHA256).Hash.ToLowerInvariant()
  gameStarted = $false
}
$process.Dispose()
$result.ok = $result.ok -and $result.stdout.Contains('1400 tasks')
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $output 'RESULT.json') -Encoding utf8
$result | ConvertTo-Json -Depth 4
if (!$result.ok) { throw 'Mixed-standard ThreadPoolWrapper regression failed' }
