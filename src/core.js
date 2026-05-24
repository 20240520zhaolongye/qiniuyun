export const SAMPLE_REQUESTS = [
  {
    assetName: "blue_slime_idle",
    assetType: "monster",
    description: "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG",
    style: "pixel_art",
    size: "32x32",
    view: "side",
    animation: "idle",
    frameCount: 4
  },
  {
    assetName: "forest_sword_icon",
    assetType: "icon",
    description: "绿色宝石短剑图标，金属剑刃，木质握柄，适合背包 UI",
    style: "cartoon",
    size: "64x64",
    view: "front",
    animation: "static",
    frameCount: 1
  },
  {
    assetName: "grass_tile",
    assetType: "tile",
    description: "明亮草地地面块，带少量小花和泥土边缘，可拼接",
    style: "pixel_art",
    size: "32x32",
    view: "top_down",
    animation: "static",
    frameCount: 1
  },
  {
    assetName: "fireball_cast",
    assetType: "effect",
    description: "橙红色火球技能特效，从小火苗逐渐膨胀",
    style: "cartoon",
    size: "64x64",
    view: "side",
    animation: "attack",
    frameCount: 6
  }
];

export function normalizePalette(input) {
  const colors = Array.isArray(input) ? input : String(input || "").split(",");
  const normalized = colors
    .map((color) => color.trim())
    .filter(Boolean)
    .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
    .map((color) => color.toUpperCase());

  return normalized.length > 0
    ? normalized
    : ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"];
}

export function sanitizeFileName(value) {
  return String(value || "asset")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .slice(0, 64) || "asset";
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

export async function createAssetPlan(request, styleProfile) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, styleProfile })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `C++ generator failed with ${response.status}`);
  }

  return response.json();
}

export function generateExportJson(plan) {
  return plan.exportJson || JSON.stringify(plan.metadata, null, 2);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
