from pydantic import BaseModel, Field


class AssetRequest(BaseModel):
    assetName: str = "blue_slime_idle"
    description: str = "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG"
    assetType: str = "monster"
    style: str = "pixel_art"
    size: str = "128x128"
    view: str = "side"
    animation: str = "idle"
    frameCount: int = Field(default=4, ge=1, le=8)
    fps: int = Field(default=8, ge=1, le=24)
    exportTarget: str = "unity"


class StyleProfile(BaseModel):
    styleName: str = "明亮像素幻想"
    colorPalette: list[str] = Field(
        default_factory=lambda: ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"]
    )
    lineStyle: str = "干净的深色描边"
    lighting: str = "左上方简化明暗光照"
    worldKeywords: str = "明亮幻想，可读性强，适合低成本原型"
    negativePrompt: str = "模糊，写实照片，3D渲染，复杂背景，水印，文字"


class GeneratePayload(BaseModel):
    request: AssetRequest
    styleProfile: StyleProfile


class GenerateResponse(BaseModel):
    id: int
    plan: dict
    files: dict[str, str]
