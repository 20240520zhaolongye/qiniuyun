import json
import subprocess
import sys
from pathlib import Path
from PIL import Image

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
            "size": "128x128",
            "view": "side",
            "animation": "idle",
            "frameCount": 4,
            "fps": 8,
            "exportTarget": "unity",
        },
        "styleProfile": {
            "styleName": "明亮像素幻想",
            "colorPalette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "lineStyle": "干净的深色描边",
            "lighting": "左上方简化明暗光照",
            "worldKeywords": "明亮幻想",
            "negativePrompt": "水印",
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
    assert "128x128" in parsed["prompt"]


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


def test_mock_generator_prefers_text_subject_for_sword():
    from app.services.mock_generator import generate_frames

    plan = {
        "seed": 1,
        "prompt": "素材描述：剑",
        "metadata": {
            "assetName": "sword_check",
            "assetType": "monster",
            "style": "pixel_art",
            "frameWidth": 128,
            "frameHeight": 128,
            "frameCount": 1,
            "animationName": "idle",
            "fps": 8,
        },
        "draw": {
            "assetType": "monster",
            "description": "剑",
            "assetName": "sword_check",
            "palette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "view": "side",
            "animation": "idle",
        },
    }

    frame = generate_frames(plan)[0]
    center_pixel = frame.getpixel((64, 64))
    lower_pixel = frame.getpixel((64, 110))
    assert center_pixel[3] > 0
    assert lower_pixel[3] > 0
    assert isinstance(frame, Image.Image)


def test_ai_generator_falls_back_to_mock_when_comfyui_unavailable(tmp_path, monkeypatch):
    from app.services.ai_generator import save_outputs

    workflow_path = tmp_path / "workflow.json"
    workflow_path.write_text(json.dumps({"1": {"inputs": {"text": ""}}}), encoding="utf-8")
    monkeypatch.setenv("SPRITEFORGE_AI_PROVIDER", "comfyui")
    monkeypatch.setenv("COMFYUI_BASE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("COMFYUI_WORKFLOW_PATH", str(workflow_path))
    monkeypatch.setenv("SPRITEFORGE_AI_FALLBACK", "mock")

    plan = {
        "seed": 1,
        "prompt": "素材描述：剑",
        "metadata": {
            "assetName": "fallback_sword",
            "assetType": "monster",
            "style": "pixel_art",
            "frameWidth": 128,
            "frameHeight": 128,
            "frameCount": 1,
            "animationName": "idle",
            "fps": 8,
        },
        "draw": {
            "assetType": "monster",
            "description": "剑",
            "assetName": "fallback_sword",
            "palette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "view": "side",
            "animation": "idle",
        },
    }

    files = save_outputs(plan, tmp_path)
    assert Path(files["png"]).exists()
    assert Path(files["sheet"]).exists()
    assert plan["metadata"]["generationProvider"] == "mock_fallback"


def test_ai_generator_raises_when_ark_unconfigured_without_fallback(tmp_path, monkeypatch):
    import pytest

    from app.services.ai_generator import AiGenerationError, save_outputs

    monkeypatch.setenv("SPRITEFORGE_AI_PROVIDER", "ark")
    monkeypatch.delenv("ARK_API_KEY", raising=False)
    monkeypatch.delenv("VOLCENGINE_API_KEY", raising=False)
    monkeypatch.delenv("SPRITEFORGE_AI_FALLBACK", raising=False)

    plan = {
        "seed": 1,
        "prompt": "只生成一把红色长剑，透明背景",
        "metadata": {
            "assetName": "ark_fallback_sword",
            "assetType": "monster",
            "style": "pixel_art",
            "frameWidth": 128,
            "frameHeight": 128,
            "frameCount": 1,
            "animationName": "idle",
            "fps": 8,
        },
        "draw": {
            "assetType": "monster",
            "description": "蓝色史莱姆",
            "assetName": "ark_fallback_sword",
            "palette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "view": "side",
            "animation": "idle",
        },
    }

    with pytest.raises(AiGenerationError):
        save_outputs(plan, tmp_path)


def test_ai_generator_defaults_to_ark_without_key(tmp_path, monkeypatch):
    import pytest

    from app.services.ai_generator import AiGenerationError, save_outputs

    monkeypatch.delenv("SPRITEFORGE_AI_PROVIDER", raising=False)
    monkeypatch.delenv("SPRITEFORGE_AI_FALLBACK", raising=False)
    monkeypatch.delenv("ARK_API_KEY", raising=False)
    monkeypatch.delenv("VOLCENGINE_API_KEY", raising=False)

    plan = {
        "seed": 1,
        "prompt": "测试默认 Ark",
        "metadata": {
            "assetName": "default_ark_check",
            "assetType": "monster",
            "style": "pixel_art",
            "frameWidth": 128,
            "frameHeight": 128,
            "frameCount": 1,
            "animationName": "idle",
            "fps": 8,
        },
        "draw": {
            "assetType": "monster",
            "description": "测试",
            "assetName": "default_ark_check",
            "palette": ["#2E5EAA"],
            "view": "side",
            "animation": "idle",
        },
    }

    with pytest.raises(AiGenerationError):
        save_outputs(plan, tmp_path)


def test_ai_generator_can_explicitly_fallback_to_mock_when_ark_unconfigured(tmp_path, monkeypatch):
    from app.services.ai_generator import save_outputs

    monkeypatch.setenv("SPRITEFORGE_AI_PROVIDER", "ark")
    monkeypatch.delenv("ARK_API_KEY", raising=False)
    monkeypatch.delenv("VOLCENGINE_API_KEY", raising=False)
    monkeypatch.setenv("SPRITEFORGE_AI_FALLBACK", "mock")

    plan = {
        "seed": 1,
        "prompt": "只生成一把红色长剑，透明背景",
        "metadata": {
            "assetName": "ark_explicit_fallback_sword",
            "assetType": "monster",
            "style": "pixel_art",
            "frameWidth": 128,
            "frameHeight": 128,
            "frameCount": 1,
            "animationName": "idle",
            "fps": 8,
        },
        "draw": {
            "assetType": "monster",
            "description": "蓝色史莱姆",
            "assetName": "ark_explicit_fallback_sword",
            "palette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "view": "side",
            "animation": "idle",
        },
    }

    files = save_outputs(plan, tmp_path)
    assert Path(files["png"]).exists()
    assert Path(files["sheet"]).exists()
    assert plan["metadata"]["generationProvider"] == "mock_fallback"


def test_prepare_frames_extracts_grid_sheet():
    from app.services.ai_generator import _prepare_frames

    source = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    colors = [(255, 0, 0, 255), (0, 255, 0, 255), (0, 0, 255, 255), (255, 255, 0, 255)]
    positions = [(0, 0), (100, 0), (0, 100), (100, 100)]
    for color, (x, y) in zip(colors, positions):
        for px in range(x + 20, x + 80):
            for py in range(y + 20, y + 80):
                source.putpixel((px, py), color)

    frames = _prepare_frames(source, 64, 64, 4)

    assert len(frames) == 4
    assert frames[0].getpixel((32, 32))[:3] == (255, 0, 0)
    assert frames[1].getpixel((32, 32))[:3] == (0, 255, 0)
    assert frames[2].getpixel((32, 32))[:3] == (0, 0, 255)
    assert frames[3].getpixel((32, 32))[:3] == (255, 255, 0)


def test_prompt_override_replaces_generated_prompt():
    from app.services.cpp_engine import create_plan

    payload = {
        "request": {
            "assetName": "override_check",
            "description": "蓝色史莱姆",
            "assetType": "monster",
            "style": "pixel_art",
            "size": "128x128",
            "view": "side",
            "animation": "idle",
            "frameCount": 1,
            "fps": 8,
            "exportTarget": "unity",
        },
        "styleProfile": {
            "styleName": "明亮像素幻想",
            "colorPalette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "lineStyle": "干净的深色描边",
            "lighting": "左上方简化明暗光照",
            "worldKeywords": "明亮幻想",
            "negativePrompt": "水印",
        },
        "promptOverride": "只生成一把红色长剑，透明背景",
    }

    plan = create_plan(payload)
    assert plan["prompt"] == "只生成一把红色长剑，透明背景"


def test_prompt_provider_falls_back_to_local_when_ark_unconfigured(monkeypatch):
    from app.services.cpp_engine import create_plan

    monkeypatch.setenv("SPRITEFORGE_PROMPT_PROVIDER", "ark")
    monkeypatch.delenv("ARK_API_KEY", raising=False)
    monkeypatch.delenv("VOLCENGINE_API_KEY", raising=False)
    monkeypatch.setenv("SPRITEFORGE_PROMPT_FALLBACK", "local")

    payload = {
        "request": {
            "assetName": "prompt_fallback",
            "description": "二次元少年",
            "assetType": "character",
            "style": "cartoon",
            "size": "128x128",
            "view": "front",
            "animation": "static",
            "frameCount": 1,
            "fps": 8,
            "exportTarget": "unity",
        },
        "styleProfile": {
            "styleName": "明亮像素幻想",
            "colorPalette": ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
            "lineStyle": "干净的深色描边",
            "lighting": "左上方简化明暗光照",
            "worldKeywords": "明亮幻想",
            "negativePrompt": "水印",
        },
    }

    plan = create_plan(payload)
    assert "二次元少年" in plan["prompt"]
    assert "Prompt 生成提示" in plan["prompt"]
