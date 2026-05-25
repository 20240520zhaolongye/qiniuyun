from pydantic import BaseModel, Field


class AssetRequest(BaseModel):
    assetName: str = "blue_slime_idle"
    description: str = "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG"
    assetType: str = "monster"
    style: str = "pixel_art"
    size: str = "32x32"
    view: str = "side"
    animation: str = "idle"
    frameCount: int = Field(default=4, ge=1, le=8)
    fps: int = Field(default=8, ge=1, le=24)
    exportTarget: str = "unity"


class StyleProfile(BaseModel):
    styleName: str = "bright_pixel_fantasy"
    colorPalette: list[str] = Field(
        default_factory=lambda: ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"]
    )
    lineStyle: str = "clean dark outline"
    lighting: str = "simple top-left cel shading"
    worldKeywords: str = "bright fantasy, readable silhouette, low cost prototype"
    negativePrompt: str = "blurry, realistic photo, 3D render, complex background, watermark, text"


class GeneratePayload(BaseModel):
    request: AssetRequest
    styleProfile: StyleProfile


class GenerateResponse(BaseModel):
    id: int
    plan: dict
    files: dict[str, str]
