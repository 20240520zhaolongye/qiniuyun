import os

from fastapi import APIRouter

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/generation")
def generation_config() -> dict[str, object]:
    provider = os.environ.get("SPRITEFORGE_AI_PROVIDER", "ark").strip().lower()
    fallback = os.environ.get("SPRITEFORGE_AI_FALLBACK", "none").strip().lower()
    return {
        "provider": provider,
        "fallback": fallback,
        "arkConfigured": bool(os.environ.get("ARK_API_KEY") or os.environ.get("VOLCENGINE_API_KEY")),
        "arkImageModel": os.environ.get("ARK_IMAGE_MODEL") or os.environ.get("ARK_ENDPOINT_ID") or "",
        "arkImageSize": os.environ.get("ARK_IMAGE_SIZE") or "",
    }
