from __future__ import annotations

import copy
import base64
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image

from app.services.mock_generator import save_outputs as save_mock_outputs


class AiGenerationError(RuntimeError):
    pass


def save_outputs(plan: dict[str, Any], output_dir: Path) -> dict[str, str]:
    provider = os.environ.get("SPRITEFORGE_AI_PROVIDER", "mock").strip().lower()
    if provider in {"comfyui", "ark"}:
        try:
            if provider == "ark":
                return _save_ark_outputs(plan, output_dir)
            return _save_comfyui_outputs(plan, output_dir)
        except Exception as exc:
            if os.environ.get("SPRITEFORGE_AI_FALLBACK", "mock").strip().lower() == "mock":
                plan.setdefault("metadata", {})["generationProvider"] = "mock_fallback"
                plan["metadata"]["generationWarning"] = str(exc)
                return save_mock_outputs(plan, output_dir)
            raise AiGenerationError(str(exc)) from exc

    plan.setdefault("metadata", {})["generationProvider"] = "mock"
    return save_mock_outputs(plan, output_dir)


def _save_ark_outputs(plan: dict[str, Any], output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = plan["metadata"]
    image_bytes = _call_ark_image_api(plan)
    source_path = output_dir / f"{metadata['assetName']}_ark.png"
    source_path.write_bytes(image_bytes)

    image = _make_near_white_transparent(Image.open(source_path).convert("RGBA"))
    frame_width = int(metadata["frameWidth"])
    frame_height = int(metadata["frameHeight"])
    frame_count = int(metadata["frameCount"])
    frames = _prepare_frames(image, frame_width, frame_height, frame_count)

    png_path = output_dir / f"{metadata['assetName']}.png"
    sheet_path = output_dir / f"{metadata['assetName']}_sheet.png"
    frames[0].save(png_path)
    sheet = Image.new("RGBA", (frame_width * frame_count, frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * frame_width, 0))
    sheet.save(sheet_path)

    metadata["generationProvider"] = "ark"
    return {"png": str(png_path), "sheet": str(sheet_path)}


def _call_ark_image_api(plan: dict[str, Any]) -> bytes:
    api_key = os.environ.get("ARK_API_KEY") or os.environ.get("VOLCENGINE_API_KEY")
    if not api_key:
        raise AiGenerationError("未配置 ARK_API_KEY，无法调用火山方舟。")

    base_url = os.environ.get("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
    model = os.environ.get("ARK_IMAGE_MODEL") or os.environ.get("ARK_ENDPOINT_ID") or "doubao-seedream-3-0-t2i-250415"
    size = os.environ.get("ARK_IMAGE_SIZE") or _ark_size_from_plan(plan)
    response_format = os.environ.get("ARK_IMAGE_RESPONSE_FORMAT", "url")
    watermark = os.environ.get("ARK_IMAGE_WATERMARK", "false").strip().lower() in {"1", "true", "yes", "on"}

    try:
        from openai import OpenAI

        client = OpenAI(base_url=base_url, api_key=api_key)
        response = client.images.generate(
            model=model,
            prompt=_ark_image_prompt(plan["prompt"]),
            size=size,
            response_format=response_format,
            extra_body={"watermark": watermark},
        )
        first = response.data[0]
        if getattr(first, "b64_json", None):
            return base64.b64decode(first.b64_json)
        if getattr(first, "url", None):
            with urllib.request.urlopen(first.url, timeout=float(os.environ.get("ARK_TIMEOUT_SECONDS", "120"))) as image_response:
                return image_response.read()
        raise AiGenerationError("火山方舟 SDK 未返回图片数据。")
    except ImportError:
        return _call_ark_image_api_raw(base_url, api_key, model, _ark_image_prompt(plan["prompt"]), size, response_format, watermark)


def _ark_image_prompt(prompt: str) -> str:
    suffix = os.environ.get(
        "ARK_IMAGE_PROMPT_SUFFIX",
        "single centered 2D game sprite asset, transparent or plain background, no text, no watermark, full body visible, clean silhouette",
    )
    if not suffix.strip():
        return prompt
    return f"{prompt}\n{suffix}"


def _ark_size_from_plan(plan: dict[str, Any]) -> str:
    if os.environ.get("ARK_USE_NATIVE_SIZE", "false").strip().lower() in {"1", "true", "yes", "on"}:
        return os.environ.get("ARK_NATIVE_SIZE", "2K")
    metadata = plan["metadata"]
    return f"{int(metadata['frameWidth'])}x{int(metadata['frameHeight'])}"


def _make_near_white_transparent(image: Image.Image) -> Image.Image:
    if os.environ.get("ARK_REMOVE_WHITE_BACKGROUND", "true").strip().lower() not in {"1", "true", "yes", "on"}:
        return image
    pixels = image.load()
    if pixels is None:
        return image
    threshold = int(os.environ.get("ARK_WHITE_THRESHOLD", "246"))
    original = image.copy()
    visited: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []

    def is_white(pixel: tuple[int, int, int, int]) -> bool:
        red, green, blue, alpha = pixel
        return alpha > 0 and red >= threshold and green >= threshold and blue >= threshold

    for x in range(image.width):
        for y in (0, image.height - 1):
            if is_white(pixels[x, y]):
                stack.append((x, y))
    for y in range(image.height):
        for x in (0, image.width - 1):
            if is_white(pixels[x, y]):
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in visited or x < 0 or y < 0 or x >= image.width or y >= image.height:
            continue
        if not is_white(pixels[x, y]):
            continue
        visited.add((x, y))
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox is None:
        return original
    visible_pixels = sum(1 for alpha in image.getchannel("A").getdata() if alpha > 0)
    min_visible_ratio = float(os.environ.get("ARK_MIN_VISIBLE_RATIO", "0.01"))
    if visible_pixels / (image.width * image.height) < min_visible_ratio:
        return original
    return image


def _call_ark_image_api_raw(base_url: str, api_key: str, model: str, prompt: str, size: str, response_format: str, watermark: bool) -> bytes:
    timeout = float(os.environ.get("ARK_TIMEOUT_SECONDS", "120"))
    image_path = os.environ.get("ARK_IMAGE_PATH", "/images/generations")
    body = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "response_format": response_format,
        "watermark": watermark,
    }
    request = urllib.request.Request(
        f"{base_url}{image_path}",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    try:
        first = payload["data"][0]
    except (KeyError, IndexError, TypeError) as exc:
        raise AiGenerationError(f"火山方舟返回格式异常: {payload}") from exc

    if first.get("b64_json"):
        return base64.b64decode(first["b64_json"])
    if first.get("url"):
        with urllib.request.urlopen(first["url"], timeout=timeout) as image_response:
            return image_response.read()
    raise AiGenerationError(f"火山方舟未返回图片数据: {payload}")


def _save_comfyui_outputs(plan: dict[str, Any], output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = plan["metadata"]
    workflow = _load_workflow()
    prompt_payload = _inject_prompt(workflow, plan)
    base_url = os.environ.get("COMFYUI_BASE_URL", "http://127.0.0.1:8188").rstrip("/")
    timeout = float(os.environ.get("COMFYUI_TIMEOUT_SECONDS", "120"))

    prompt_id = _queue_prompt(base_url, prompt_payload)
    image_bytes = _wait_for_image(base_url, prompt_id, timeout)
    source_path = output_dir / f"{metadata['assetName']}_comfyui.png"
    source_path.write_bytes(image_bytes)

    image = Image.open(source_path).convert("RGBA")
    frame_width = int(metadata["frameWidth"])
    frame_height = int(metadata["frameHeight"])
    frame_count = int(metadata["frameCount"])
    frames = _prepare_frames(image, frame_width, frame_height, frame_count)

    png_path = output_dir / f"{metadata['assetName']}.png"
    sheet_path = output_dir / f"{metadata['assetName']}_sheet.png"
    frames[0].save(png_path)
    sheet = Image.new("RGBA", (frame_width * frame_count, frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * frame_width, 0))
    sheet.save(sheet_path)

    metadata["generationProvider"] = "comfyui"
    return {"png": str(png_path), "sheet": str(sheet_path)}


def _load_workflow() -> dict[str, Any]:
    workflow_path = os.environ.get("COMFYUI_WORKFLOW_PATH")
    if not workflow_path:
        raise AiGenerationError("未配置 COMFYUI_WORKFLOW_PATH，无法调用 ComfyUI。")
    path = Path(workflow_path)
    if not path.exists():
        raise AiGenerationError(f"ComfyUI 工作流不存在: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _inject_prompt(workflow: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    payload = copy.deepcopy(workflow)
    prompt_text = plan["prompt"]
    negative_text = _extract_negative_prompt(prompt_text)
    positive_node = os.environ.get("COMFYUI_POSITIVE_NODE_ID")
    negative_node = os.environ.get("COMFYUI_NEGATIVE_NODE_ID")

    if positive_node:
        _set_node_text(payload, positive_node, prompt_text)
    else:
        _set_first_text_node(payload, prompt_text)
    if negative_node:
        _set_node_text(payload, negative_node, negative_text)

    _set_generation_size(payload, int(plan["metadata"]["frameWidth"]), int(plan["metadata"]["frameHeight"]))
    return payload


def _extract_negative_prompt(prompt: str) -> str:
    marker = "负面约束："
    if marker not in prompt:
        return ""
    return prompt.split(marker, 1)[1].strip()


def _set_node_text(workflow: dict[str, Any], node_id: str, text: str) -> None:
    node = workflow.get(str(node_id))
    if not isinstance(node, dict):
        raise AiGenerationError(f"ComfyUI 节点不存在: {node_id}")
    inputs = node.setdefault("inputs", {})
    if "text" in inputs:
        inputs["text"] = text
    elif "prompt" in inputs:
        inputs["prompt"] = text
    else:
        inputs["text"] = text


def _set_first_text_node(workflow: dict[str, Any], text: str) -> None:
    for node in workflow.values():
        if not isinstance(node, dict):
            continue
        inputs = node.get("inputs")
        if isinstance(inputs, dict) and ("text" in inputs or "prompt" in inputs):
            if "text" in inputs:
                inputs["text"] = text
            else:
                inputs["prompt"] = text
            return
    raise AiGenerationError("ComfyUI 工作流中没有可写入 Prompt 的 text/prompt 节点。")


def _set_generation_size(workflow: dict[str, Any], width: int, height: int) -> None:
    for node in workflow.values():
        if not isinstance(node, dict):
            continue
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            continue
        if "width" in inputs and "height" in inputs:
            inputs["width"] = width
            inputs["height"] = height


def _queue_prompt(base_url: str, workflow: dict[str, Any]) -> str:
    body = json.dumps({"prompt": workflow}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/prompt",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    prompt_id = payload.get("prompt_id")
    if not prompt_id:
        raise AiGenerationError("ComfyUI 未返回 prompt_id。")
    return str(prompt_id)


def _wait_for_image(base_url: str, prompt_id: str, timeout: float) -> bytes:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with urllib.request.urlopen(f"{base_url}/history/{urllib.parse.quote(prompt_id)}", timeout=15) as response:
            history = json.loads(response.read().decode("utf-8"))
        item = history.get(prompt_id, {})
        image = _find_first_output_image(item)
        if image:
            return _download_image(base_url, image)
        time.sleep(1)
    raise AiGenerationError("ComfyUI 生成超时。")


def _find_first_output_image(history_item: dict[str, Any]) -> dict[str, Any] | None:
    outputs = history_item.get("outputs", {})
    if not isinstance(outputs, dict):
        return None
    for output in outputs.values():
        images = output.get("images") if isinstance(output, dict) else None
        if isinstance(images, list) and images:
            image = images[0]
            if isinstance(image, dict) and image.get("filename"):
                return image
    return None


def _download_image(base_url: str, image: dict[str, Any]) -> bytes:
    query = urllib.parse.urlencode(
        {
            "filename": image["filename"],
            "subfolder": image.get("subfolder", ""),
            "type": image.get("type", "output"),
        }
    )
    with urllib.request.urlopen(f"{base_url}/view?{query}", timeout=30) as response:
        return response.read()


def _prepare_frames(image: Image.Image, frame_width: int, frame_height: int, frame_count: int) -> list[Image.Image]:
    sheet_width = frame_width * frame_count
    expected_ratio = sheet_width / frame_height
    actual_ratio = image.width / image.height if image.height else expected_ratio
    looks_like_sheet = frame_count > 1 and abs(actual_ratio - expected_ratio) <= 0.2
    if image.width == sheet_width and image.height == frame_height:
        sheet = image
    elif looks_like_sheet and image.width >= sheet_width and image.height >= frame_height:
        sheet = image.resize((sheet_width, frame_height), Image.Resampling.LANCZOS)
    else:
        grid_frames = _extract_grid_frames(image, frame_width, frame_height, frame_count)
        if grid_frames:
            return grid_frames
        frame = image.resize((frame_width, frame_height), Image.Resampling.LANCZOS)
        return [frame.copy() for _ in range(frame_count)]

    return [sheet.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height)) for index in range(frame_count)]


def _extract_grid_frames(image: Image.Image, frame_width: int, frame_height: int, frame_count: int) -> list[Image.Image] | None:
    if frame_count <= 1:
        return None

    candidates: list[tuple[int, int]] = []
    for columns in range(2, frame_count + 1):
        rows = (frame_count + columns - 1) // columns
        if columns * rows >= frame_count:
            candidates.append((columns, rows))
    candidates.sort(key=lambda item: (abs((image.width / image.height) - (item[0] / item[1])), item[0] * item[1]))

    for columns, rows in candidates:
        cell_width = image.width / columns
        cell_height = image.height / rows
        if cell_width < 8 or cell_height < 8:
            continue
        frames: list[Image.Image] = []
        for index in range(frame_count):
            column = index % columns
            row = index // columns
            left = round(column * cell_width)
            top = round(row * cell_height)
            right = round((column + 1) * cell_width)
            bottom = round((row + 1) * cell_height)
            cell = image.crop((left, top, right, bottom))
            frames.append(cell.resize((frame_width, frame_height), Image.Resampling.LANCZOS))
        if _frames_are_visibly_different(frames):
            return frames
    return None


def _frames_are_visibly_different(frames: list[Image.Image]) -> bool:
    if len(frames) < 2:
        return False
    first = frames[0].resize((32, 32), Image.Resampling.BILINEAR).convert("RGB")
    for frame in frames[1:]:
        sample = frame.resize((32, 32), Image.Resampling.BILINEAR).convert("RGB")
        total = 0
        for first_pixel, sample_pixel in zip(first.getdata(), sample.getdata()):
            total += sum(abs(a - b) for a, b in zip(first_pixel, sample_pixel))
        if total / (32 * 32 * 3) > 2:
            return True
    return False
