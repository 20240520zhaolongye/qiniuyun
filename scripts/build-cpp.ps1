$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root "build"
$exe = Join-Path $buildDir "spriteforge_cpp.exe"
$cliExe = Join-Path $buildDir "spriteforge_cli.exe"

New-Item -ItemType Directory -Force $buildDir | Out-Null
g++ -std=c++17 -O2 -finput-charset=UTF-8 -fexec-charset=UTF-8 -Isrc_cpp src_cpp/core.cpp src_cpp/server.cpp -lws2_32 -o $exe
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
g++ -std=c++17 -O2 -finput-charset=UTF-8 -fexec-charset=UTF-8 -Isrc_cpp src_cpp/core.cpp src_cpp/cli.cpp -o $cliExe
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
