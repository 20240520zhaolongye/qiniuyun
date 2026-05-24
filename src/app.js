import {
  ASSET_TYPE_LABELS,
  SAMPLE_REQUESTS,
  STYLE_LABELS,
  createAssetPlan,
  generateExportJson,
  normalizePalette,
  sanitizeFileName
} from "./core.js";
import { renderFrame, renderSheet } from "./renderer.js";

const controls = {
  statusText: document.querySelector("#statusText"),
  assetName: document.querySelector("#assetName"),
  description: document.querySelector("#description"),
  assetType: document.querySelector("#assetType"),
  style: document.querySelector("#style"),
  size: document.querySelector("#size"),
  view: document.querySelector("#view"),
  animation: document.querySelector("#animation"),
  frameCount: document.querySelector("#frameCount"),
  fps: document.querySelector("#fps"),
  exportTarget: document.querySelector("#exportTarget"),
  styleName: document.querySelector("#styleName"),
  colorPalette: document.querySelector("#colorPalette"),
  lineStyle: document.querySelector("#lineStyle"),
  lighting: document.querySelector("#lighting"),
  worldKeywords: document.querySelector("#worldKeywords"),
  negativePrompt: document.querySelector("#negativePrompt"),
  previewMeta: document.querySelector("#previewMeta"),
  promptOutput: document.querySelector("#promptOutput"),
  historyList: document.querySelector("#historyList"),
  previewCanvas: document.querySelector("#previewCanvas"),
  sheetCanvas: document.querySelector("#sheetCanvas"),
  canvasStage: document.querySelector(".canvas-stage")
};

let currentPlan = null;
let animationTimer = null;
let activeFrame = 0;
let transparentMode = true;

function readRequest() {
  return {
    assetName: controls.assetName.value,
    description: controls.description.value,
    assetType: controls.assetType.value,
    style: controls.style.value,
    size: controls.size.value,
    view: controls.view.value,
    animation: controls.animation.value,
    frameCount: Number(controls.frameCount.value),
    fps: Number(controls.fps.value),
    exportTarget: controls.exportTarget.value
  };
}

function readStyleProfile() {
  return {
    styleName: controls.styleName.value,
    colorPalette: normalizePalette(controls.colorPalette.value),
    lineStyle: controls.lineStyle.value,
    lighting: controls.lighting.value,
    worldKeywords: controls.worldKeywords.value,
    negativePrompt: controls.negativePrompt.value
  };
}

function setStatus(text) {
  controls.statusText.textContent = text;
}

function renderCurrent(frame = activeFrame) {
  if (!currentPlan) return;
  activeFrame = frame % currentPlan.metadata.frameCount;
  const previewScale = Math.max(1, Math.floor(448 / Math.max(currentPlan.metadata.frameWidth, currentPlan.metadata.frameHeight)));
  const sheetScale = Math.max(1, Math.floor(96 / currentPlan.metadata.frameHeight));
  renderFrame(controls.previewCanvas, currentPlan, activeFrame, previewScale);
  renderSheet(controls.sheetCanvas, currentPlan, sheetScale);
  controls.previewMeta.textContent = `${currentPlan.metadata.frameWidth}x${currentPlan.metadata.frameHeight} · ${currentPlan.metadata.frameCount} 帧 · ${currentPlan.metadata.fps} FPS`;
}

async function generateAsset() {
  const request = readRequest();
  const styleProfile = readStyleProfile();
  setStatus("生成中");
  try {
    currentPlan = await createAssetPlan(request, styleProfile);
    activeFrame = 0;
    controls.promptOutput.textContent = currentPlan.prompt;
    renderCurrent(0);
    addHistory(currentPlan.metadata.assetName, currentPlan.metadata.assetType, currentPlan.metadata.style);
    setStatus("已生成");
  } catch (error) {
    console.error(error);
    setStatus("生成失败");
  }
}

function addHistory(name, type, style) {
  const item = document.createElement("li");
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  item.innerHTML = `<span>${time}</span><strong>${name}</strong><span>类型：${ASSET_TYPE_LABELS[type] || type}</span><span>风格：${STYLE_LABELS[style] || style}</span>`;
  controls.historyList.prepend(item);
  while (controls.historyList.children.length > 8) {
    controls.historyList.lastElementChild.remove();
  }
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

function downloadText(text, fileName) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function ensureGenerated() {
  if (!currentPlan) {
    await generateAsset();
  }
  return currentPlan;
}

async function downloadPng() {
  const plan = await ensureGenerated();
  const offscreen = document.createElement("canvas");
  renderFrame(offscreen, plan, activeFrame, 1);
  downloadDataUrl(offscreen.toDataURL("image/png"), `${plan.metadata.assetName}.png`);
  setStatus("已下载 PNG");
}

async function downloadSheet() {
  const plan = await ensureGenerated();
  const offscreen = document.createElement("canvas");
  renderSheet(offscreen, plan, 1);
  downloadDataUrl(offscreen.toDataURL("image/png"), `${plan.metadata.assetName}_sheet.png`);
  setStatus("已下载 Sprite Sheet");
}

async function downloadJson() {
  const plan = await ensureGenerated();
  downloadText(generateExportJson(plan), `${plan.metadata.assetName}.json`);
  setStatus("已下载 JSON");
}

async function togglePlay() {
  if (!currentPlan) {
    await generateAsset();
  }
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
    setStatus("已暂停");
    return;
  }

  const interval = Math.round(1000 / currentPlan.metadata.fps);
  animationTimer = setInterval(() => {
    renderCurrent(activeFrame + 1);
  }, interval);
  setStatus("播放中");
}

function applyStyleProfile(profile) {
  if (!profile) return;
  controls.styleName.value = profile.styleName || controls.styleName.value;
  controls.colorPalette.value = normalizePalette(profile.colorPalette || controls.colorPalette.value).join(",");
  controls.lineStyle.value = profile.lineStyle || controls.lineStyle.value;
  controls.lighting.value = profile.lighting || controls.lighting.value;
  controls.worldKeywords.value = profile.worldKeywords || controls.worldKeywords.value;
  controls.negativePrompt.value = profile.negativePrompt || controls.negativePrompt.value;
}

async function applySample() {
  const sample = SAMPLE_REQUESTS[Math.floor(Math.random() * SAMPLE_REQUESTS.length)];
  const request = sample.request || sample;
  controls.assetName.value = request.assetName;
  controls.description.value = request.description;
  controls.assetType.value = request.assetType;
  controls.style.value = request.style;
  controls.size.value = request.size;
  controls.view.value = request.view;
  controls.animation.value = request.animation;
  controls.frameCount.value = request.frameCount;
  controls.fps.value = request.fps || controls.fps.value;
  controls.exportTarget.value = request.exportTarget || controls.exportTarget.value;
  applyStyleProfile(sample.styleProfile);
  await generateAsset();
}

async function resetStyle() {
  controls.styleName.value = "bright_pixel_fantasy";
  controls.colorPalette.value = "#2E5EAA,#43A047,#FDD835,#EF5350,#FFFFFF,#172033";
  controls.lineStyle.value = "clean dark outline";
  controls.lighting.value = "simple top-left cel shading";
  controls.worldKeywords.value = "bright fantasy, readable silhouette, low cost prototype";
  controls.negativePrompt.value = "blurry, realistic photo, 3D render, complex background, watermark, text, noisy details, inconsistent outline";
  await generateAsset();
}

function bindEvents() {
  document.querySelector("#generateBtn").addEventListener("click", () => generateAsset());
  document.querySelector("#downloadPngBtn").addEventListener("click", () => downloadPng());
  document.querySelector("#downloadSheetBtn").addEventListener("click", () => downloadSheet());
  document.querySelector("#downloadJsonBtn").addEventListener("click", () => downloadJson());
  document.querySelector("#playBtn").addEventListener("click", () => togglePlay());
  document.querySelector("#randomizeBtn").addEventListener("click", () => applySample());
  document.querySelector("#resetStyleBtn").addEventListener("click", () => resetStyle());
  document.querySelector("#transparentBtn").addEventListener("click", () => {
    transparentMode = !transparentMode;
    controls.canvasStage.classList.toggle("solid", !transparentMode);
  });
  document.querySelector("#copyPromptBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(controls.promptOutput.textContent);
    setStatus("Prompt 已复制");
  });

  [
    controls.assetName,
    controls.description,
    controls.assetType,
    controls.style,
    controls.size,
    controls.view,
    controls.animation,
    controls.frameCount,
    controls.fps,
    controls.exportTarget,
    controls.styleName,
    controls.colorPalette,
    controls.lineStyle,
    controls.lighting,
    controls.worldKeywords,
    controls.negativePrompt
  ].forEach((element) => {
    element.addEventListener("change", () => {
      controls.assetName.value = sanitizeFileName(controls.assetName.value);
      generateAsset();
    });
  });
}

bindEvents();
generateAsset();
