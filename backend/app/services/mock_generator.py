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
    style = metadata.get("style", draw_info.get("style", "pixel_art"))
    view = draw_info.get("view", "side")
    animation = draw_info.get("animation", "idle")
    subject = _infer_subject(draw_info.get("description", ""), draw_info.get("assetName", ""), draw_info.get("assetType", "monster"))
    rng = random.Random(_seed(plan))

    frames: list[Image.Image] = []
    for frame_index in range(frame_count):
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        progress = _animation_progress(animation, frame_index, frame_count)
        asset_type = draw_info.get("assetType", "monster")
        if subject == "sword":
            _draw_sword(draw, width, height, palette, progress, animation)
        elif subject == "shield":
            _draw_shield(draw, width, height, palette)
        elif subject == "potion":
            _draw_potion(draw, width, height, palette)
        elif subject == "key":
            _draw_key(draw, width, height, palette)
        elif subject == "coin":
            _draw_coin(draw, width, height, palette)
        elif subject == "chest":
            _draw_chest(draw, width, height, palette)
        elif asset_type == "tile":
            _draw_tile(draw, width, height, palette, rng)
        elif asset_type == "icon":
            _draw_icon(draw, width, height, palette)
        elif asset_type == "effect":
            _draw_effect(draw, width, height, palette, progress)
        elif asset_type == "prop":
            _draw_prop(draw, width, height, palette)
        else:
            _draw_creature(draw, width, height, palette, progress, asset_type, view, animation)
        _apply_view_marker(draw, width, height, palette, view)
        _apply_style_finish(draw, width, height, palette, style)
        frames.append(image)
    return frames


def _infer_subject(description: str, asset_name: str, asset_type: str) -> str:
    text = f"{description} {asset_name}".lower()
    if any(keyword in text for keyword in ("剑", "刀", "sword", "blade", "匕首", "长矛", "枪")):
        return "sword"
    if any(keyword in text for keyword in ("盾", "shield")):
        return "shield"
    if any(keyword in text for keyword in ("药水", "药瓶", "potion", "瓶")):
        return "potion"
    if any(keyword in text for keyword in ("钥匙", "key")):
        return "key"
    if any(keyword in text for keyword in ("金币", "硬币", "coin", "gold")):
        return "coin"
    if any(keyword in text for keyword in ("宝箱", "箱子", "chest")):
        return "chest"
    return asset_type


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


def _animation_progress(animation: str, frame_index: int, frame_count: int) -> float:
    if frame_count <= 1 or animation == "static":
        return 0
    linear = frame_index / frame_count
    if animation == "attack":
        return min(1, linear * 1.8)
    if animation == "death":
        return frame_index / max(1, frame_count - 1)
    return linear


def _draw_creature(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], progress: float, asset_type: str, view: str, animation: str) -> None:
    primary = _rgb(palette[0])
    secondary = _rgb(palette[1] if len(palette) > 1 else palette[0])
    highlight = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    bounce = math.sin(progress * math.pi * 2) * max(1, height * 0.04)
    if animation == "death":
        bounce = progress * height * 0.18
    cx = width / 2
    cy = height / 2 + bounce
    body_w = width * (0.42 if asset_type == "character" else 0.62)
    body_h = height * (0.62 if asset_type == "character" else 0.48)
    if view == "front":
        body_w *= 0.92
        body_h *= 1.08
    elif view == "top_down":
        body_w *= 1.08
        body_h *= 0.78
    elif view == "isometric":
        cx += width * 0.04
        body_w *= 0.95
        body_h *= 0.88
    if animation == "attack":
        cx += math.sin(progress * math.pi) * width * 0.08
    elif animation == "walk":
        cx += math.sin(progress * math.pi * 2) * width * 0.04
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
        step = math.sin(progress * math.pi * 2) * height * 0.05 if animation == "walk" else 0
        draw.rectangle([cx - body_w * 0.2, cy + body_h * 0.42 + step, cx - body_w * 0.04, cy + body_h * 0.68 + step], fill=secondary + (255,))
        draw.rectangle([cx + body_w * 0.04, cy + body_h * 0.42 - step, cx + body_w * 0.2, cy + body_h * 0.68 - step], fill=secondary + (255,))
    if animation == "attack":
        draw.arc([cx + body_w * 0.08, cy - body_h * 0.5, cx + body_w * 0.72, cy + body_h * 0.42], 290, 65, fill=secondary + (210,), width=line)
    elif animation == "death":
        draw.line([cx - body_w * 0.1, cy - body_h * 0.08, cx + body_w * 0.1, cy + body_h * 0.08], fill=outline + (255,), width=line)
        draw.line([cx + body_w * 0.1, cy - body_h * 0.08, cx - body_w * 0.1, cy + body_h * 0.08], fill=outline + (255,), width=line)


def _draw_sword(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], progress: float, animation: str) -> None:
    metal = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    guard = _rgb(palette[2] if len(palette) > 2 else "#FDD835")
    grip = _rgb(palette[1] if len(palette) > 1 else "#43A047")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    accent = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    line = max(2, width // 22)
    dx = math.sin(progress * math.pi) * width * 0.08 if animation == "attack" else 0
    cx = width * 0.5 + dx
    blade = [
        (cx, height * 0.12),
        (width * 0.62 + dx, height * 0.62),
        (width * 0.52 + dx, height * 0.68),
        (width * 0.38 + dx, height * 0.62),
    ]
    draw.polygon(blade, fill=metal + (255,), outline=outline + (255,))
    draw.line([cx, height * 0.16, width * 0.5 + dx, height * 0.62], fill=outline + (120,), width=max(1, line // 2))
    draw.rounded_rectangle([width * 0.28 + dx, height * 0.60, width * 0.72 + dx, height * 0.70], radius=line, fill=guard + (255,), outline=outline + (255,), width=line)
    draw.rounded_rectangle([width * 0.43 + dx, height * 0.68, width * 0.57 + dx, height * 0.88], radius=line, fill=grip + (255,), outline=outline + (255,), width=line)
    draw.ellipse([width * 0.42 + dx, height * 0.84, width * 0.58 + dx, height * 0.98], fill=accent + (255,), outline=outline + (255,), width=line)


def _draw_shield(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    primary = _rgb(palette[0])
    accent = _rgb(palette[2] if len(palette) > 2 else "#FDD835")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    line = max(2, width // 18)
    points = [(width * 0.5, height * 0.12), (width * 0.78, height * 0.25), (width * 0.72, height * 0.68), (width * 0.5, height * 0.9), (width * 0.28, height * 0.68), (width * 0.22, height * 0.25)]
    draw.polygon(points, fill=primary + (255,), outline=outline + (255,))
    draw.line([width * 0.5, height * 0.18, width * 0.5, height * 0.82], fill=accent + (255,), width=line)
    draw.arc([width * 0.32, height * 0.22, width * 0.68, height * 0.62], 205, 335, fill=accent + (220,), width=line)


def _draw_potion(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    liquid = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    glass = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    cork = _rgb(palette[1] if len(palette) > 1 else "#43A047")
    line = max(2, width // 20)
    draw.rounded_rectangle([width * 0.42, height * 0.1, width * 0.58, height * 0.32], radius=line, fill=cork + (255,), outline=outline + (255,), width=line)
    draw.ellipse([width * 0.24, height * 0.28, width * 0.76, height * 0.88], fill=glass + (95,), outline=outline + (255,), width=line)
    draw.pieslice([width * 0.28, height * 0.38, width * 0.72, height * 0.86], 0, 180, fill=liquid + (210,))
    draw.ellipse([width * 0.42, height * 0.42, width * 0.54, height * 0.54], fill=glass + (180,))


def _draw_key(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    gold = _rgb(palette[2] if len(palette) > 2 else "#FDD835")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    line = max(2, width // 18)
    draw.ellipse([width * 0.16, height * 0.34, width * 0.44, height * 0.62], fill=gold + (255,), outline=outline + (255,), width=line)
    draw.ellipse([width * 0.25, height * 0.43, width * 0.35, height * 0.53], fill=(0, 0, 0, 0), outline=outline + (255,), width=max(1, line // 2))
    draw.rounded_rectangle([width * 0.40, height * 0.45, width * 0.84, height * 0.53], radius=line, fill=gold + (255,), outline=outline + (255,), width=line)
    draw.rectangle([width * 0.72, height * 0.52, width * 0.80, height * 0.68], fill=gold + (255,), outline=outline + (255,))
    draw.rectangle([width * 0.58, height * 0.52, width * 0.66, height * 0.62], fill=gold + (255,), outline=outline + (255,))


def _draw_coin(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    gold = _rgb(palette[2] if len(palette) > 2 else "#FDD835")
    accent = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    line = max(2, width // 18)
    draw.ellipse([width * 0.18, height * 0.18, width * 0.82, height * 0.82], fill=gold + (255,), outline=outline + (255,), width=line)
    draw.ellipse([width * 0.3, height * 0.3, width * 0.7, height * 0.7], outline=accent + (230,), width=line)
    draw.line([width * 0.5, height * 0.34, width * 0.5, height * 0.66], fill=outline + (180,), width=max(1, line // 2))


def _draw_chest(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str]) -> None:
    wood = _rgb(palette[1] if len(palette) > 1 else "#43A047")
    gold = _rgb(palette[2] if len(palette) > 2 else "#FDD835")
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    line = max(2, width // 18)
    draw.rounded_rectangle([width * 0.18, height * 0.34, width * 0.82, height * 0.78], radius=line, fill=wood + (255,), outline=outline + (255,), width=line)
    draw.arc([width * 0.18, height * 0.14, width * 0.82, height * 0.58], 180, 360, fill=outline + (255,), width=line)
    draw.rectangle([width * 0.47, height * 0.34, width * 0.53, height * 0.78], fill=gold + (255,))
    draw.rectangle([width * 0.42, height * 0.48, width * 0.58, height * 0.62], fill=gold + (255,), outline=outline + (255,))


def _apply_view_marker(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], view: str) -> None:
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    accent = _rgb(palette[2] if len(palette) > 2 else "#FDD835")
    line = max(1, width // 64)
    if view == "front":
        draw.line([width * 0.5, height * 0.18, width * 0.5, height * 0.82], fill=outline + (90,), width=line)
    elif view == "top_down":
        draw.arc([width * 0.18, height * 0.18, width * 0.82, height * 0.82], 205, 335, fill=accent + (150,), width=line * 2)
    elif view == "isometric":
        draw.polygon(
            [(width * 0.5, height * 0.16), (width * 0.83, height * 0.5), (width * 0.5, height * 0.84), (width * 0.17, height * 0.5)],
            outline=outline + (95,),
        )


def _apply_style_finish(draw: ImageDraw.ImageDraw, width: int, height: int, palette: list[str], style: str) -> None:
    outline = _rgb(palette[5] if len(palette) > 5 else "#172033")
    highlight = _rgb(palette[4] if len(palette) > 4 else "#FFFFFF")
    accent = _rgb(palette[3] if len(palette) > 3 else "#EF5350")
    line = max(1, width // 48)
    if style == "cartoon":
        draw.arc([width * 0.22, height * 0.18, width * 0.78, height * 0.58], 200, 335, fill=highlight + (160,), width=line * 2)
    elif style == "hand_drawn":
        for offset in (0, width * 0.012, -width * 0.012):
            draw.arc([width * 0.2 + offset, height * 0.2, width * 0.8 + offset, height * 0.8], 25, 155, fill=outline + (100,), width=line)
    elif style == "dark_fantasy":
        draw.rectangle([line, line, width - line, height - line], outline=outline + (180,), width=line * 2)
    elif style == "chibi":
        r = max(2, width * 0.035)
        draw.ellipse([width * 0.72 - r, height * 0.24 - r, width * 0.72 + r, height * 0.24 + r], fill=accent + (180,))


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
