import json
import subprocess
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[3]
CLI_PATH = ROOT_DIR / "build" / "spriteforge_cli.exe"


class CppEngineError(RuntimeError):
    pass


STYLE_LABELS = {
    "pixel_art": "像素风",
    "cartoon": "卡通风",
    "hand_drawn": "手绘风",
    "dark_fantasy": "暗黑幻想风",
    "chibi": "Q版",
}

STYLE_DETAILS = {
    "pixel_art": "低分辨率精灵图，清晰像素边缘，有限色板",
    "cartoon": "轮廓清晰，色块干净，比例活泼",
    "hand_drawn": "柔和手绘轮廓，适合 2D 游戏的绘制质感",
    "dark_fantasy": "高对比暗色氛围，剪影明确，幻想题材色彩克制",
    "chibi": "头身比例可爱，体型紧凑，适合轻量游戏角色",
}

ASSET_TYPE_HINTS = {
    "monster": "敌人怪物精灵",
    "character": "可操作角色精灵",
    "prop": "可收集或可交互道具",
    "icon": "方形 UI 图标",
    "tile": "可拼接地图瓦片",
    "effect": "技能或打击特效",
}


def _build_prompt(payload: dict[str, Any], plan: dict[str, Any]) -> str:
    request = payload["request"]
    style_profile = payload["styleProfile"]
    metadata = plan["metadata"]
    style = request.get("style", "pixel_art")
    asset_type = request.get("assetType", "monster")
    frame_count = int(metadata.get("frameCount", request.get("frameCount", 1)))
    fps = int(metadata.get("fps", request.get("fps", 8)))
    palette = style_profile.get("colorPalette") or []
    animation = request.get("animation", "static")
    animation_text = f"{animation} 动画，{frame_count} 帧，{fps} FPS" if frame_count > 1 else "单帧静态素材"

    return "\n".join(
        [
            f"生成一个 {metadata['frameWidth']}x{metadata['frameHeight']} 的{STYLE_LABELS.get(style, '像素风')} 2D 游戏素材。",
            f"素材类型：{asset_type}（{ASSET_TYPE_HINTS.get(asset_type, '2D 游戏素材')}）",
            f"素材描述：{request.get('description', '')}",
            f"视角：{request.get('view', 'side')}",
            "背景：透明背景",
            f"美术方向：{STYLE_DETAILS.get(style, STYLE_DETAILS['pixel_art'])}；{style_profile.get('worldKeywords', '')}",
            f"主色板：{', '.join(palette)}",
            f"线条风格：{style_profile.get('lineStyle', '')}",
            f"光照方式：{style_profile.get('lighting', '')}",
            f"动画：{animation_text}",
            "",
            "生成要求：",
            "- 可直接用于 2D 游戏开发",
            "- 主体居中",
            "- 剪影清晰，易于识别",
            "- 与项目风格保持一致",
            "- 透明背景",
            "- 适合 Unity、Godot 和 Cocos Creator 工作流",
            "- 不要文字、水印或复杂背景",
            "",
            f"负面约束：{style_profile.get('negativePrompt', '')}",
        ]
    )


def create_plan(payload: dict[str, Any]) -> dict[str, Any]:
    if not CLI_PATH.exists():
        raise CppEngineError(f"C++ CLI not found: {CLI_PATH}")

    process = subprocess.run(
        [str(CLI_PATH)],
        input=json.dumps(payload, ensure_ascii=True),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )

    if process.returncode != 0:
        detail = process.stderr.strip() or process.stdout.strip() or "C++ CLI failed"
        raise CppEngineError(detail)

    try:
        plan = json.loads(process.stdout)
    except json.JSONDecodeError as exc:
        raise CppEngineError(f"Invalid C++ JSON output: {exc}") from exc
    prompt_override = payload.get("promptOverride")
    plan["prompt"] = prompt_override.strip() if isinstance(prompt_override, str) and prompt_override.strip() else _build_prompt(payload, plan)
    plan.setdefault("draw", {})
    plan["draw"]["description"] = payload["request"].get("description", "")
    plan["draw"]["assetName"] = payload["request"].get("assetName", "")
    return plan
