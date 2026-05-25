import { create } from "zustand";
import type { AssetPlan, AssetRequest, GeneratedAsset, StyleProfile } from "./types";

type StoreState = {
  request: AssetRequest;
  styleProfile: StyleProfile;
  plan: AssetPlan | null;
  asset: GeneratedAsset | null;
  loading: boolean;
  error: string | null;
  setRequest: (patch: Partial<AssetRequest>) => void;
  setStyleProfile: (patch: Partial<StyleProfile>) => void;
  generatePlan: () => Promise<void>;
  generateAsset: () => Promise<void>;
};

export const apiBase = (import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api").replace(/\/$/, "");
export const apiOrigin = apiBase.replace(/\/api$/, "");

export const useAssetStore = create<StoreState>((set, get) => ({
  request: {
    assetName: "blue_slime_idle",
    description: "蓝色史莱姆怪物，圆形身体，微笑表情，适合横版幻想 RPG",
    assetType: "monster",
    style: "pixel_art",
    size: "128x128",
    view: "side",
    animation: "idle",
    frameCount: 4,
    fps: 8,
    exportTarget: "unity"
  },
  styleProfile: {
    styleName: "明亮像素幻想",
    colorPalette: ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
    lineStyle: "干净的深色描边",
    lighting: "左上方简化明暗光照",
    worldKeywords: "明亮幻想，可读性强，适合低成本原型",
    negativePrompt: "模糊，写实照片，3D渲染，复杂背景，水印，文字"
  },
  plan: null,
  asset: null,
  loading: false,
  error: null,
  setRequest: (patch) => set((state) => ({ request: { ...state.request, ...patch }, asset: null })),
  setStyleProfile: (patch) => set((state) => ({ styleProfile: { ...state.styleProfile, ...patch }, asset: null })),
  generatePlan: async () => {
    set({ loading: true, error: null, asset: null });
    try {
      const response = await fetch(`${apiBase}/assets/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: get().request, styleProfile: get().styleProfile })
      });
      if (!response.ok) throw new Error(await response.text());
      const plan = (await response.json()) as AssetPlan;
      set({ plan });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法生成 Prompt，请确认后端服务已启动。" });
    } finally {
      set({ loading: false });
    }
  },
  generateAsset: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${apiBase}/assets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: get().request, styleProfile: get().styleProfile })
      });
      if (!response.ok) throw new Error(await response.text());
      const asset = (await response.json()) as GeneratedAsset;
      set({ asset, plan: asset.plan });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "素材生成失败，请检查后端服务是否启动。" });
    } finally {
      set({ loading: false });
    }
  }
}));
