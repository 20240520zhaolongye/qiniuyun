$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "build\spriteforge_cpp.exe"

& (Join-Path $PSScriptRoot "build-cpp.ps1")
& $exe
