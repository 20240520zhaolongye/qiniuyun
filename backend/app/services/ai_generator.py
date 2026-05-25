from __future__ import annotations

import copy
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
    if provider == "comfyui":
        try:
            return _save_comfyui_outputs(plan, output_dir)
        except Exception as exc:
            if os.environ.get("SPRITEFORGE_AI_FALLBACK", "mock").strip().lower() == "mock":
                plan.setdefault("metadata", {})["generationProvider"] = "mock_fallback"
                plan["metadata"]["generationWarning"] = str(exc)
                return save_mock_outputs(plan, output_dir)
            raise AiGenerationError(str(exc)) from exc

    plan.setdefault("metadata", {})["generationProvider"] = "mock"
    return save_mock_outputs(plan, output_dir)


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
    if image.width >= frame_width * frame_count and image.height >= frame_height:
        return [image.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height)) for index in range(frame_count)]

    frame = image.resize((frame_width, frame_height), Image.Resampling.LANCZOS)
    return [frame.copy() for _ in range(frame_count)]
