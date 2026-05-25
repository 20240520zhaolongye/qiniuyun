from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


def _rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.strip().lstrip("#")
    if len(value) != 6:
        return (46, 94, 170)
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def _seed(plan: dict[str, Any]) -> int:
    text = f"{plan.get('seed', '')}:{plan.get('prompt', '')}"
    return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:12], 16)


def generate_frames(plan: dict[str, Any]) -> list[Image.Image]:
    metadata = plan["metadata"]
    draw_info = plan["draw"]
    width = int(metadata["frameWidth"])
    height = int(metadata["frameHeight"])
    frame_count = int(metadata["frameCount"])
    palette = draw_info.get("palette") or ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"]
    rng = random.Random(_seed(plan))

    frames: list[Image.Image] = []
    for frame_index in range(frame_count):
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        progress = 0 if frame_count <= 1 else frame_index / (frame_count - 1)
        asset_type = draw_info.get("assetType", "monster")
        if asset_type == "tile":
            _draw_tile(draw, width, height, palette, rng)
        elif asset_type == "icon":
            _draw_icon(draw, width, height, palette)
        elif asset_type == "effect":
            _draw_effect(draw, width, height, palette, progress)
        elif asset_type == "prop":
            _draw_prop(draw, width, height, palette)
        else:
            _draw_creature(draw, width, height, palette, progress, asset_type)
        frames.append(image)
    return frames


def save_outputs(plan: dict[str, Any], output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = plan["metadata"]
    asset_name = metadata["assetName"]
    frames = generate_frames(plan)
    sheet = Image.new("RGBA", (frames[0].width * len(frames), frames[0].height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * frame.width, 0))

    png_path = output_dir / f"{asset_name}.png"
    sheet_path = output_dir / f"{asset_name}_sheet.png"
    frames[0].save(png_path)
    sheet.save(sheet_path)
    return {"png": str(png_path), "sheet": str(sheet_path)}


def _draw_creature(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], progress: float, asset_type: str) -> None:
    primary = _rgb(palette[0])
    secondary = _rgb(palette[1] if len(palette) > 1 else palette[0])
    highlight = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    bounce = math.sin(progress * math.pi * 2) * max(1, height * 0.04)
    cx = width / 2
    cy = height / 2 + bounce
    body_w = width * (0.42 if asset_type == "character" else 0.62)
    body_h = height * (0.62 if asset_type == "character" else 0.48)
    line = max(1, round(width / 18))
    box = [cx - body_w / 2, cy - body_h / 2, cx + body_w / 2, cy + body_h / 2]
    draw.ellipse(box, fill=primary + (250,), outline=outline + (255,), width=line)
    draw.ellipse(
        [cx - body_w * 0.30, cy - body_h * 0.26, cx - body_w * 0.03, cy - body_h * 0.06],
        fill=highlight + (180,),
    )
    eye_r = max(1, round(width * 0.035))
    for ex in (cx - body_w * 0.16, cx + body_w * 0.16):
        draw.ellipse([ex - eye_r, cy - eye_r, ex + eye_r, cy + eye_r], fill=outline + (255,))
    draw.arc(
        [cx - body_w * 0.16, cy, cx + body_w * 0.16, cy + body_h * 0.22],
        start=10,
        end=170,
        fill=outline + (255,),
        width=line,
    )
    if asset_type == "character":
        draw.rectangle([cx - body_w * 0.2, cy + body_h * 0.42, cx - body_w * 0.04, cy + body_h * 0.68], fill=secondary + (255,))
        draw.rectangle([cx + body_w * 0.04, cy + body_h * 0.42, cx + body_w * 0.2, cy + body_h * 0.68], fill=secondary + (255,))


def _draw_tile(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], rng: random.Random) -> None:
    base = _rgb(palette[1] if len(palette) > 1 else "#43A047")
    grass = _rgb(palette[0])
    flower = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    draw.rectangle([0, 0, width, height], fill=base + (255,))
    for _ in range(24):
        x = rng.randint(0, max(0, width - 2))
        y = rng.randint(0, max(0, height - 2))
        draw.rectangle([x, y, x + 1, y + 1], fill=grass + (220,))
    for _ in range(4):
        x = rng.randint(2, max(2, width - 3))
        y = rng.randint(2, max(2, height - 3))
        draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=flower + (230,))


def _draw_icon(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    primary = _rgb(palette[0])
    accent = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    highlight = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    pad = width * 0.14
    draw.rounded_rectangle([pad, pad, width - pad, height - pad], radius=width * 0.14, fill=primary + (65,), outline=outline + (255,), width=max(1, width // 18))
    draw.polygon([(width / 2, height * 0.18), (width * 0.60, height * 0.62), (width / 2, height * 0.80), (width * 0.40, height * 0.62)], fill=highlight + (255,), outline=outline + (255,))
    draw.rectangle([width * 0.32, height * 0.56, width * 0.68, height * 0.64], fill=accent + (255,))


def _draw_effect(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], progress: float) -> None:
    primary = _rgb(palette[0])
    accent = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    highlight = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    cx = width / 2
    cy = height / 2
    radius = width * (0.16 + progress * 0.28)
    for color, alpha, scale in ((primary, 90, 1.5), (accent, 165, 1.0), (highlight, 230, 0.45)):
        r = radius * scale
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))


def _draw_prop(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    primary = _rgb(palette[0])
    secondary = _rgb(palette[1] if len(palette) > 1 else "#43A047")
    highlight = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    draw.rounded_rectangle([width * 0.28, height * 0.22, width * 0.72, height * 0.74], radius=width * 0.08, fill=primary + (255,), outline=outline + (255,), width=max(1, width // 18))
    draw.rectangle([width * 0.34, height * 0.42, width * 0.66, height * 0.52], fill=secondary + (255,))
    draw.ellipse([width * 0.42, height * 0.28, width * 0.58, height * 0.44], fill=highlight + (210,))
