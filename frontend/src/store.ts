import { create } from "zustand";
import type { AssetPlan, AssetRequest, GeneratedAsset, GeneratePayload, StyleProfile } from "./types";

type StoreState = {
  request: AssetRequest;
  styleProfile: StyleProfile;
  plan: AssetPlan | null;
  asset: GeneratedAsset | null;
  promptText: string;
  loading: boolean;
  error: string | null;
  setRequest: (patch: Partial<AssetRequest>) => void;
  setStyleProfile: (patch: Partial<StyleProfile>) => void;
  setPromptText: (promptText: string) => void;
  generatePlan: () => Promise<void>;
  generateAsset: () => Promise<void>;
};

export const apiBase = (import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api").replace(/\/$/, "");
export const apiOrigin = apiBase.replace(/\/api$/, "");

const defaultRequest: AssetRequest = {
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
};

const defaultStyleProfile: StyleProfile = {
  styleName: "明亮像素幻想",
  colorPalette: ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
  lineStyle: "干净的深色描边",
  lighting: "左上方简化明暗光照",
  worldKeywords: "明亮幻想，可读性强，适合低成本原型",
  negativePrompt: "模糊，写实照片，3D渲染，复杂背景，水印，文字"
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

let activePlanRequest = 0;
let activeAssetRequest = 0;

export const useAssetStore = create<StoreState>((set, get) => ({
  request: defaultRequest,
  styleProfile: defaultStyleProfile,
  plan: null,
  asset: null,
  promptText: "",
  loading: false,
  error: null,
  setRequest: (patch) =>
    set((state) => ({
      request: { ...state.request, ...patch },
      plan: null,
      promptText: "",
      asset: null,
      error: null
    })),
  setStyleProfile: (patch) =>
    set((state) => ({
      styleProfile: { ...state.styleProfile, ...patch },
      plan: null,
      promptText: "",
      asset: null,
      error: null
    })),
  setPromptText: (promptText) => set({ promptText, error: null }),
  generatePlan: async () => {
    const requestId = ++activePlanRequest;
    set({ loading: true, error: null, asset: null });
    try {
      const { request, styleProfile } = get();
      const payload: GeneratePayload = { request, styleProfile };
      const plan = await postJson<AssetPlan>(`${apiBase}/assets/plan`, payload);
      if (requestId !== activePlanRequest) return;
      set({ plan, promptText: plan.prompt });
    } catch (error) {
      if (requestId !== activePlanRequest) return;
      set({ error: error instanceof Error ? error.message : "无法生成 Prompt，请确认后端服务已启动。" });
    } finally {
      if (requestId === activePlanRequest) set({ loading: false });
    }
  },
  generateAsset: async () => {
    const requestId = ++activeAssetRequest;
    set({ loading: true, error: null });
    try {
      const { request, styleProfile } = get();
      const promptOverride = get().promptText.trim() || undefined;
      const payload: GeneratePayload = { request, styleProfile, promptOverride };
      const asset = await postJson<GeneratedAsset>(`${apiBase}/assets/generate`, payload);
      if (requestId !== activeAssetRequest) return;
      set({ asset, plan: asset.plan, promptText: asset.plan.prompt });
    } catch (error) {
      if (requestId !== activeAssetRequest) return;
      set({ error: error instanceof Error ? error.message : "素材生成失败，请检查后端服务是否启动。" });
    } finally {
      if (requestId === activeAssetRequest) set({ loading: false });
    }
  }
}));
