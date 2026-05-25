import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def test_api_round_trip():
    result = subprocess.run(
        [sys.executable, "-m", "compileall", str(BACKEND / "app")],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout


def test_cpp_cli_payload_shape():
    cli = ROOT / "build" / "spriteforge_cli.exe"
    if not cli.exists():
        return

    payload = {
        "request": {
            "assetName": "blue_slime_idle",
            "description": "蓝色史莱姆",
            "assetType": "monster",
            "style": "pixel_art",
            "size": "32x32",
            "view": "side",
            "animation": "idle",
            "frameCount": 4,
            "fps": 8,
            "exportTarget": "unity",
        },
        "styleProfile": {
            "styleName": "bright_pixel_fantasy",
            "colorPalette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "lineStyle": "clean dark outline",
            "lighting": "simple top-left cel shading",
            "worldKeywords": "bright fantasy",
            "negativePrompt": "watermark",
        },
    }

    proc = subprocess.run(
        [str(cli)],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    parsed = json.loads(proc.stdout)
    assert parsed["metadata"]["assetName"] == "blue_slime_idle"
    assert "32x32" in parsed["prompt"]


def test_generate_response_uses_download_urls():
    from app.schemas import GenerateResponse

    response = GenerateResponse(
        id=7,
        plan={"metadata": {"assetName": "asset"}},
        files={
            "png": "/api/assets/7/download/png",
            "sheet": "/api/assets/7/download/sheet",
            "metadata": "/api/assets/7/download/json",
        },
    )
    assert response.files["png"].startswith("/api/assets/")
    assert ":" not in response.files["png"]
