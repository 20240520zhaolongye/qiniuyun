$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$apiPort = if ($env:PORT) { [int]$env:PORT } else { 8000 }
$webPort = if ($env:WEB_PORT) { [int]$env:WEB_PORT } else { 5173 }
$pythonExe = Join-Path $root "backend\.venv\Scripts\python.exe"

function Test-PortInUse([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)
}

if (!(Test-Path $pythonExe)) {
  Write-Host "Creating backend virtual environment..."
  python -m venv (Join-Path $root "backend\.venv")
}

$sitePackages = Get-ChildItem (Join-Path $root "backend\.venv\Lib\site-packages") -Directory -ErrorAction SilentlyContinue
$hasBackendDeps = $sitePackages.Name -contains "uvicorn" -and $sitePackages.Name -contains "fastapi" -and $sitePackages.Name -contains "PIL"
if (!$hasBackendDeps) {
  Write-Host "Installing backend dependencies..."
  & $pythonExe -m pip install -r (Join-Path $root "backend\requirements.txt") pytest
}

while (Test-PortInUse $apiPort) {
  Write-Host "API port $apiPort is in use, trying $($apiPort + 1)..."
  $apiPort += 1
}

while (Test-PortInUse $webPort) {
  Write-Host "Web port $webPort is in use, trying $($webPort + 1)..."
  $webPort += 1
}

Write-Host "Starting SpriteForge API on http://127.0.0.1:$apiPort"
Write-Host "Starting SpriteForge Web on http://127.0.0.1:$webPort"

$apiEnvCommand = "`$env:PORT='$apiPort';"
foreach ($name in @(
  "SPRITEFORGE_AI_PROVIDER",
  "SPRITEFORGE_PROMPT_PROVIDER",
  "SPRITEFORGE_AI_FALLBACK",
  "ARK_API_KEY",
  "ARK_BASE_URL",
  "ARK_IMAGE_MODEL",
  "ARK_ENDPOINT_ID",
  "ARK_IMAGE_SIZE",
  "ARK_IMAGE_RESPONSE_FORMAT",
  "ARK_IMAGE_WATERMARK",
  "ARK_IMAGE_PROMPT_SUFFIX",
  "ARK_REMOVE_WHITE_BACKGROUND",
  "ARK_WHITE_THRESHOLD",
  "ARK_MIN_VISIBLE_RATIO",
  "ARK_TIMEOUT_SECONDS"
)) {
  $value = [Environment]::GetEnvironmentVariable($name, "Process")
  if (($null -eq $value -or $value -eq "") -and $name -eq "ARK_API_KEY") {
    $value = [Environment]::GetEnvironmentVariable($name, "User")
  }
  if (($null -eq $value -or $value -eq "") -and $name -eq "ARK_API_KEY") {
    $value = [Environment]::GetEnvironmentVariable($name, "Machine")
  }
  if ($null -ne $value -and $value -ne "") {
    $escaped = $value.Replace("'", "''")
    $apiEnvCommand += " `$env:$name='$escaped';"
  }
}

$apiArgs = @(
  "-NoExit",
  "-Command",
  "Set-Location '$root'; $apiEnvCommand & '$pythonExe' 'backend\run.py'"
)

$webArgs = @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\frontend'; `$env:VITE_API_BASE='http://127.0.0.1:$apiPort/api'; npm run dev -- --host 127.0.0.1 --port $webPort"
)

Start-Process -FilePath "powershell" -ArgumentList $apiArgs -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process -FilePath "powershell" -ArgumentList $webArgs -WindowStyle Normal

Write-Host ""
Write-Host "Open http://127.0.0.1:$webPort"
