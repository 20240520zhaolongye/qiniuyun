export type AssetRequest = {
  assetName: string;
  description: string;
  assetType: string;
  style: string;
  size: string;
  view: string;
  animation: string;
  frameCount: number;
  fps: number;
  exportTarget: string;
};

export type StyleProfile = {
  styleName: string;
  colorPalette: string[];
  lineStyle: string;
  lighting: string;
  worldKeywords: string;
  negativePrompt: string;
};

export type AssetPlan = {
  seed: number;
  prompt: string;
  metadata: {
    assetName: string;
    assetType: string;
    style: string;
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    animationName: string;
    fps: number;
    exportTarget: string;
    generationProvider?: string;
    generationWarning?: string;
  };
};

export type GeneratedAsset = {
  id: number;
  plan: AssetPlan;
  files: {
    png: string;
    sheet: string;
    metadata: string;
  };
};

export type GeneratePayload = {
  request: AssetRequest;
  styleProfile: StyleProfile;
  promptOverride?: string;
};
