from __future__ import annotations

import json
import os
import urllib.request
from typing import Any


class PromptProviderError(RuntimeError):
    pass


def maybe_enhance_prompt(base_prompt: str, payload: dict[str, Any], metadata: dict[str, Any]) -> str:
    provider = os.environ.get("SPRITEFORGE_PROMPT_PROVIDER", "").strip().lower()
    if provider != "ark":
        return base_prompt
    try:
        return _enhance_with_ark(base_prompt, payload, metadata)
    except Exception as exc:
        if os.environ.get("SPRITEFORGE_PROMPT_FALLBACK", "local").strip().lower() == "local":
            return base_prompt + f"\n\nPrompt 生成提示：火山方舟 Prompt 增强失败，已使用本地 Prompt。原因：{exc}"
        raise PromptProviderError(str(exc)) from exc


def _enhance_with_ark(base_prompt: str, payload: dict[str, Any], metadata: dict[str, Any]) -> str:
    api_key = os.environ.get("ARK_API_KEY") or os.environ.get("VOLCENGINE_API_KEY")
    if not api_key:
        raise PromptProviderError("未配置 ARK_API_KEY。")
    base_url = os.environ.get("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
    model = os.environ.get("ARK_CHAT_MODEL") or os.environ.get("ARK_ENDPOINT_ID")
    if not model:
        raise PromptProviderError("未配置 ARK_CHAT_MODEL 或 ARK_ENDPOINT_ID。")

    request = payload["request"]
    style_profile = payload["styleProfile"]
    user_content = "\n".join(
        [
            "请把下面的 2D 游戏素材需求改写成可直接用于图像生成模型的高质量 Prompt。",
            "只输出 Prompt 正文，不要解释。",
            "必须保留素材描述、尺寸、风格、视角、动画、透明背景、游戏素材、不要文字水印等约束。",
            f"素材名称：{request.get('assetName', '')}",
            f"素材描述：{request.get('description', '')}",
            f"素材类型：{request.get('assetType', '')}",
            f"风格：{request.get('style', '')}",
            f"尺寸：{metadata.get('frameWidth')}x{metadata.get('frameHeight')}",
            f"视角：{request.get('view', '')}",
            f"动画：{request.get('animation', '')}, {metadata.get('frameCount')} 帧, {metadata.get('fps')} FPS",
            f"线条：{style_profile.get('lineStyle', '')}",
            f"光照：{style_profile.get('lighting', '')}",
            f"世界观关键词：{style_profile.get('worldKeywords', '')}",
            f"负面约束：{style_profile.get('negativePrompt', '')}",
            "",
            "本地基础 Prompt：",
            base_prompt,
        ]
    )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "你是专业 2D 游戏美术 Prompt 工程师。"},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.4,
    }
    http_request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    with urllib.request.urlopen(http_request, timeout=float(os.environ.get("ARK_CHAT_TIMEOUT_SECONDS", "60"))) as response:
        result = json.loads(response.read().decode("utf-8"))
    try:
        content = result["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise PromptProviderError(f"火山方舟 Chat 返回格式异常: {result}") from exc
    if not content:
        raise PromptProviderError("火山方舟 Chat 返回空 Prompt。")
    return content
