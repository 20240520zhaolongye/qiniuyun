$ErrorActionPreference = "Stop"

$env:SPRITEFORGE_AI_PROVIDER = "ark"
Remove-Item Env:\SPRITEFORGE_PROMPT_PROVIDER -ErrorAction SilentlyContinue
$env:ARK_BASE_URL = if ($env:ARK_BASE_URL) { $env:ARK_BASE_URL } else { "https://ark.cn-beijing.volces.com/api/v3" }
$env:ARK_IMAGE_MODEL = if ($env:ARK_IMAGE_MODEL) { $env:ARK_IMAGE_MODEL } else { "ep-20260525182237-2v79h" }
$env:ARK_IMAGE_SIZE = if ($env:ARK_IMAGE_SIZE) { $env:ARK_IMAGE_SIZE } else { "2K" }
$env:ARK_IMAGE_RESPONSE_FORMAT = if ($env:ARK_IMAGE_RESPONSE_FORMAT) { $env:ARK_IMAGE_RESPONSE_FORMAT } else { "url" }
$env:ARK_IMAGE_WATERMARK = if ($env:ARK_IMAGE_WATERMARK) { $env:ARK_IMAGE_WATERMARK } else { "false" }

if (!$env:ARK_API_KEY) {
  throw "ARK_API_KEY is required. Set it first: `$env:ARK_API_KEY='your_api_key'"
}

& (Join-Path $PSScriptRoot "dev.ps1")
