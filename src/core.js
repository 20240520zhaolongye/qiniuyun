export const STYLE_LABELS = {
  pixel_art: "像素风",
  cartoon: "卡通风",
  hand_drawn: "手绘风",
  dark_fantasy: "黑暗风",
  chibi: "Q 版"
};

export const ASSET_TYPE_LABELS = {
  monster: "怪物",
  character: "角色",
  prop: "道具",
  icon: "UI 图标",
  tile: "Tile 地块",
  effect: "技能特效"
};

export const SAMPLE_REQUESTS = [
  {
    request: {
      assetName: "blue_slime_idle",
      description: "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG",
      assetType: "monster",
      style: "pixel_art",
      size: "32x32",
      view: "side",
      animation: "idle",
      frameCount: 4,
      fps: 8,
      exportTarget: "unity"
    },
    styleProfile: {
      styleName: "bright_pixel_fantasy",
      colorPalette: ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
      lineStyle: "clean dark outline",
      lighting: "simple top-left cel shading",
      worldKeywords: "bright fantasy, readable silhouette, low cost prototype",
      negativePrompt: "blurry, realistic photo, 3D render, complex background, watermark, text, noisy details, inconsistent outline"
    }
  },
  {
    request: {
      assetName: "forest_sword_icon",
      description: "绿色宝石短剑图标，金属剑刃，木质握柄，适合背包 UI",
      assetType: "icon",
      style: "cartoon",
      size: "64x64",
      view: "front",
      animation: "static",
      frameCount: 1,
      fps: 8,
      exportTarget: "generic"
    },
    styleProfile: {
      styleName: "clean_cartoon_adventure",
      colorPalette: ["#2D7D46", "#8FD14F", "#F6C343", "#D95D39", "#FFF7D6", "#1D2733"],
      lineStyle: "bold rounded outline",
      lighting: "large soft highlight from upper left",
      worldKeywords: "friendly adventure UI, clear icon silhouette, bright equipment colors",
      negativePrompt: "thin line, muddy colors, complex background, realistic metal, text, watermark"
    }
  },
  {
    request: {
      assetName: "grass_tile_flower",
      description: "明亮草地地面块，带少量小花和泥土边缘，可拼接",
      assetType: "tile",
      style: "hand_drawn",
      size: "32x32",
      view: "top_down",
      animation: "static",
      frameCount: 1,
      fps: 8,
      exportTarget: "godot"
    },
    styleProfile: {
      styleName: "storybook_meadow",
      colorPalette: ["#5EA65B", "#A7D46F", "#F0D15E", "#B9864A", "#FFF4E0", "#40513B"],
      lineStyle: "soft uneven ink outline",
      lighting: "warm ambient daylight",
      worldKeywords: "storybook meadow, hand painted terrain, organic grass clusters",
      negativePrompt: "hard grid lines, photorealistic, noisy texture, dark horror colors, watermark"
    }
  },
  {
    request: {
      assetName: "ember_bat_attack",
      description: "黑暗洞穴里的火焰蝙蝠，尖角和小翅膀，攻击时身体前冲",
      assetType: "monster",
      style: "dark_fantasy",
      size: "64x64",
      view: "side",
      animation: "attack",
      frameCount: 6,
      fps: 10,
      exportTarget: "unity"
    },
    styleProfile: {
      styleName: "ember_dark_fantasy",
      colorPalette: ["#4A1F2D", "#7A2E28", "#F08A24", "#C43B3B", "#E7D6B8", "#12131A"],
      lineStyle: "sharp heavy silhouette",
      lighting: "rim light with hot ember glow",
      worldKeywords: "dark fantasy cave enemy, angular wings, readable hostile silhouette",
      negativePrompt: "cute toy, pastel colors, soft round body, modern UI, text, watermark"
    }
  },
  {
    request: {
      assetName: "chibi_mage_walk",
      description: "Q 版小法师角色，蓝色斗篷和星星法杖，适合俯视冒险游戏",
      assetType: "character",
      style: "chibi",
      size: "64x64",
      view: "front",
      animation: "walk",
      frameCount: 4,
      fps: 8,
      exportTarget: "cocos"
    },
    styleProfile: {
      styleName: "cute_chibi_magic",
      colorPalette: ["#4B7BE5", "#8DD8FF", "#FFD166", "#EF6F8E", "#FFF8E8", "#22304A"],
      lineStyle: "clean rounded outline",
      lighting: "soft candy-like cel shading",
      worldKeywords: "cute chibi proportions, oversized head, magical academy colors",
      negativePrompt: "realistic body proportions, horror mood, gritty texture, tiny eyes, text, watermark"
    }
  },
  {
    request: {
      assetName: "arcane_burst_effect",
      description: "蓝紫色奥术爆发特效，从中心扩散成环形能量",
      assetType: "effect",
      style: "cartoon",
      size: "64x64",
      view: "front",
      animation: "attack",
      frameCount: 6,
      fps: 12,
      exportTarget: "generic"
    },
    styleProfile: {
      styleName: "arcane_cartoon_fx",
      colorPalette: ["#5C6CEB", "#58C4DD", "#F8E56C", "#C65BFF", "#FFFFFF", "#1B2140"],
      lineStyle: "crisp energetic outline",
      lighting: "glowing center with bright rim",
      worldKeywords: "arcane spell effect, radial burst, clean transparent VFX",
      negativePrompt: "smoke photo, background scene, blurry particles, realistic lens flare, text"
    }
  }
];

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

export function normalizePalette(input) {
  const rawColors = Array.isArray(input) ? input : String(input || "").split(",");
  const colors = rawColors
    .map((color) => String(color).trim().toUpperCase())
    .filter((color) => /^#[0-9A-F]{6}$/.test(color));
  return colors.length ? colors : ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"];
}

export function sanitizeFileName(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "");
  return (normalized || "asset").slice(0, 64);
}

export function createRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export async function createAssetPlan(request, styleProfile) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request: {
        ...request,
        assetName: sanitizeFileName(request.assetName),
        frameCount: clamp(request.frameCount, 1, 8),
        fps: clamp(request.fps, 1, 24)
      },
      styleProfile: {
        ...styleProfile,
        colorPalette: normalizePalette(styleProfile.colorPalette)
      }
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export function generateExportJson(plan) {
  return plan.exportJson || JSON.stringify(plan.export, null, 2);
}
