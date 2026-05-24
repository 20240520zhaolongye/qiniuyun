export const SAMPLE_REQUESTS = [
  {
    assetName: "blue_slime_idle",
    assetType: "monster",
    description: "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG",
    style: "pixel_art",
    size: "32x32",
    animation: "idle",
    frameCount: 4
  },
  {
    assetName: "forest_sword_icon",
    assetType: "icon",
    description: "绿色宝石短剑图标，金属剑刃，木质握柄，适合背包 UI",
    style: "cartoon",
    size: "64x64",
    animation: "static",
    frameCount: 1
  }
];

export function parseSize(size) {
  const match = /^(\d+)x(\d+)$/i.exec(String(size).trim());
  if (!match) throw new Error(`Invalid size: ${size}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function sanitizeFileName(value) {
  return String(value || "asset")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .slice(0, 64) || "asset";
}

export function normalizePalette(input) {
  const colors = Array.isArray(input) ? input : String(input || "").split(",");
  const normalized = colors
    .map((color) => color.trim())
    .filter((color) => /^#[0-9a-f]{6}$/i.test(color));
  return normalized.length ? normalized : ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"];
}

export function makeSeed(input) {
  const text = JSON.stringify(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRandom(seed) {
  let value = seed || 1;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPrompt(request) {
  const size = parseSize(request.size);
  return [
    `Generate a ${size.width}x${size.height} ${request.style} 2D game asset.`,
    `Asset type: ${request.assetType}`,
    `Description: ${request.description}`,
    "Background: transparent",
    `Animation: ${request.frameCount > 1 ? `${request.animation} animation, ${request.frameCount} frames` : "single static frame"}`,
    "Requirements: game-ready, centered, readable silhouette, no text, no watermark"
  ].join("\n");
}

export function createAssetPlan(request) {
  const size = parseSize(request.size);
  const frameCount = Math.max(1, Math.min(8, Number(request.frameCount) || 1));
  return {
    seed: makeSeed(request),
    prompt: buildPrompt({ ...request, frameCount }),
    metadata: {
      assetName: sanitizeFileName(request.assetName),
      assetType: request.assetType,
      style: request.style,
      frameWidth: size.width,
      frameHeight: size.height,
      frameCount,
      fps: Math.max(1, Math.min(24, Number(request.fps) || 8))
    },
    draw: {
      palette: normalizePalette(),
      renderMode: request.style === "pixel_art" ? "pixel" : "smooth",
      assetType: request.assetType,
      animation: request.animation
    }
  };
}

export function generateExportJson(plan) {
  return JSON.stringify({
    ...plan.metadata,
    files: {
      png: `${plan.metadata.assetName}.png`,
      spriteSheet: `${plan.metadata.assetName}_sheet.png`,
      metadata: `${plan.metadata.assetName}.json`
    }
  }, null, 2);
}
