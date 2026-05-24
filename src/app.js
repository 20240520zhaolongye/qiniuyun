import {
  SAMPLE_REQUESTS,
  createAssetPlan,
  generateExportJson,
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
  animation: document.querySelector("#animation"),
  frameCount: document.querySelector("#frameCount"),
  fps: document.querySelector("#fps"),
  previewMeta: document.querySelector("#previewMeta"),
  promptOutput: document.querySelector("#promptOutput"),
  previewCanvas: document.querySelector("#previewCanvas"),
  sheetCanvas: document.querySelector("#sheetCanvas"),
  canvasStage: document.querySelector(".canvas-stage")
};

let currentPlan = null;
let activeFrame = 0;
let animationTimer = null;

function readRequest() {
  return {
    assetName: controls.assetName.value,
    description: controls.description.value,
    assetType: controls.assetType.value,
    style: controls.style.value,
    size: controls.size.value,
    animation: controls.animation.value,
    frameCount: Number(controls.frameCount.value),
    fps: Number(controls.fps.value)
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
  controls.previewMeta.textContent = `${currentPlan.metadata.frameWidth}x${currentPlan.metadata.frameHeight} · ${currentPlan.metadata.frameCount} frames · ${currentPlan.metadata.fps} FPS`;
}

function generateAsset() {
  currentPlan = createAssetPlan(readRequest());
  activeFrame = 0;
  controls.promptOutput.textContent = currentPlan.prompt;
  renderCurrent(0);
  setStatus("Generated");
}

function togglePlay() {
  if (!currentPlan) generateAsset();
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
    setStatus("Paused");
    return;
  }
  animationTimer = setInterval(() => renderCurrent(activeFrame + 1), Math.round(1000 / currentPlan.metadata.fps));
  setStatus("Playing");
}

function applySample() {
  const sample = SAMPLE_REQUESTS[Math.floor(Math.random() * SAMPLE_REQUESTS.length)];
  controls.assetName.value = sample.assetName;
  controls.description.value = sample.description;
  controls.assetType.value = sample.assetType;
  controls.style.value = sample.style;
  controls.size.value = sample.size;
  controls.animation.value = sample.animation;
  controls.frameCount.value = sample.frameCount;
  generateAsset();
}

function downloadText(text, fileName) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindEvents() {
  document.querySelector("#generateBtn").addEventListener("click", generateAsset);
  document.querySelector("#playBtn").addEventListener("click", togglePlay);
  document.querySelector("#randomizeBtn").addEventListener("click", applySample);
  document.querySelector("#transparentBtn").addEventListener("click", () => controls.canvasStage.classList.toggle("solid"));
  document.querySelector("#copyPromptBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(controls.promptOutput.textContent);
    setStatus("Prompt copied");
  });
  document.querySelector("#sheetCanvas").addEventListener("dblclick", () => {
    const plan = currentPlan || createAssetPlan(readRequest());
    downloadText(generateExportJson(plan), `${plan.metadata.assetName}.json`);
  });
  [controls.assetName, controls.description, controls.assetType, controls.style, controls.size, controls.animation, controls.frameCount, controls.fps]
    .forEach((element) => element.addEventListener("change", () => {
      controls.assetName.value = sanitizeFileName(controls.assetName.value);
      generateAsset();
    }));
}

bindEvents();
generateAsset();
