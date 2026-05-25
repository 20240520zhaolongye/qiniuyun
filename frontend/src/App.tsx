import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { apiOrigin, useAssetStore } from "./store";

function App() {
  const { request, styleProfile, plan, asset, promptText, loading, error, setRequest, setStyleProfile, setPromptText, generateAsset, generatePlan } =
    useAssetStore();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    setPreviewError(null);
    canvasRef.current.innerHTML = "";

    const stageSize = 480;
    const stage = new Konva.Stage({ container: canvasRef.current, width: stageSize, height: stageSize });
    const layer = new Konva.Layer();
    layer.add(new Konva.Rect({ x: 0, y: 0, width: stageSize, height: stageSize, fill: "#eef2f6" }));

    if (asset && plan) {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const frameWidth = plan.metadata.frameWidth;
        const frameHeight = plan.metadata.frameHeight;
        const frameCount = Math.max(1, plan.metadata.frameCount);
        const sheetWidth = frameWidth * frameCount;
        const imageSize = Math.min(stageSize - 48, stageSize - 48);
        const scale = Math.min(imageSize / sheetWidth, imageSize / frameHeight);
        const previewWidth = sheetWidth * scale;
        const previewHeight = frameHeight * scale;

        const sheetNode = new Konva.Image({
          image,
          x: (stageSize - previewWidth) / 2,
          y: (stageSize - previewHeight) / 2,
          width: previewWidth,
          height: previewHeight,
          imageSmoothingEnabled: plan.metadata.style !== "pixel_art"
        });
        layer.add(sheetNode);
        layer.draw();
      };
      image.onerror = () => {
        setPreviewError("图片加载失败，请检查后端服务和素材下载接口。");
      };
      image.src = `${apiOrigin}${asset.files.sheet}?v=${asset.id}`;
    } else {
      layer.add(
        new Konva.Text({
          x: 24,
          y: 24,
          text: plan ? "Prompt 已按当前参数生成。点击“生成素材”后，这里会显示素材预览。" : "修改参数后请点击“生成 Prompt”刷新提示词。",
          fontSize: 18,
          fontFamily: "Arial",
          fill: "#172033",
          width: stageSize - 48
        })
      );
    }

    stage.add(layer);
    return () => {
      stage.destroy();
    };
  }, [plan, asset]);

  const paletteText = useMemo(() => styleProfile.colorPalette.join(","), [styleProfile.colorPalette]);
  const palettePreview = useMemo(() => styleProfile.colorPalette.slice(0, 6), [styleProfile.colorPalette]);
  const downloadBase = asset ? `${apiOrigin}/api/assets/${asset.id}/download` : "";
  const updatePaletteColor = (index: number, color: string) => {
    const nextPalette = [...styleProfile.colorPalette];
    nextPalette[index] = color;
    setStyleProfile({ colorPalette: nextPalette });
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f4f0e8_0%,#eef4f0_48%,#f8efd9_100%)] p-4 md:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[360px_1fr_360px]">
        <section className="rounded-lg border border-[#d8cfbf] bg-[#fffaf2] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">SpriteForge</h1>
              <p className="text-sm text-[#6d7180]">C++ Core + FastAPI + React</p>
            </div>
            <span className="rounded-full border border-[#bdd9c9] bg-[#eef8f1] px-3 py-1 text-xs text-[#245b45]">
              {loading ? "生成中" : "就绪"}
            </span>
          </div>

          <label className="mb-3 block text-sm">
            素材名称
            <input className="mt-1 w-full rounded border px-3 py-2" value={request.assetName} onChange={(event) => setRequest({ assetName: event.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            文本描述
            <textarea className="mt-1 w-full rounded border px-3 py-2" rows={4} value={request.description} onChange={(event) => setRequest({ description: event.target.value })} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Select label="素材类型" value={request.assetType} onChange={(assetType) => setRequest({ assetType })} options={assetTypes} />
            <Select label="图片风格" value={request.style} onChange={(style) => setRequest({ style })} options={styles} />
            <Select label="素材大小" value={request.size} onChange={(size) => setRequest({ size })} options={sizes} />
            <Select label="视角" value={request.view} onChange={(view) => setRequest({ view })} options={views} />
            <Select label="动画" value={request.animation} onChange={(animation) => setRequest({ animation })} options={animations} />
            <Select label="导出目标" value={request.exportTarget} onChange={(exportTarget) => setRequest({ exportTarget })} options={targets} />
            <NumberInput label="帧数" value={request.frameCount} min={1} max={8} onChange={(frameCount) => setRequest({ frameCount })} />
            <NumberInput label="FPS" value={request.fps} min={1} max={24} onChange={(fps) => setRequest({ fps })} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="rounded border border-[#2e5eaa] px-4 py-2 text-[#2e5eaa]" onClick={() => void generatePlan()} disabled={loading}>
              生成 Prompt
            </button>
            <button className="rounded bg-[#2e5eaa] px-4 py-2 text-white" onClick={() => void generateAsset()} disabled={loading}>
              {loading ? "生成中..." : "生成素材"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="rounded-lg border border-[#d8cfbf] bg-[#fffaf2] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <strong>预览</strong>
            <span className="text-sm text-[#6d7180]">
              {plan
                ? `${plan.metadata.frameWidth}x${plan.metadata.frameHeight} · ${plan.metadata.frameCount} 帧 · ${plan.metadata.fps} FPS${
                    plan.metadata.generationProvider ? ` · ${plan.metadata.generationProvider}` : ""
                  }`
                : "等待生成"}
            </span>
          </div>
          <div className="min-h-[520px] rounded border border-[#d8cfbf] bg-[#eef2f6] p-4">
            <div ref={canvasRef} />
            {previewError ? <p className="mt-3 text-sm text-red-700">{previewError}</p> : null}
          </div>
          {plan?.metadata.generationWarning ? <p className="mt-3 text-sm text-amber-700">生成已回退到 Mock：{plan.metadata.generationWarning}</p> : null}
          {asset && plan ? (
            <section className="mt-4 rounded border border-[#d8cfbf] bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong>动画演示</strong>
                <span className="text-xs text-[#6d7180]">
                  {plan.metadata.animationName} · {plan.metadata.frameCount} 帧 · {plan.metadata.fps} FPS
                </span>
              </div>
              <div className="flex min-h-48 items-center justify-center rounded border border-[#e2d8c8] bg-[#eef2f6] p-4">
                <div
                  className="sprite-animation-viewport"
                  style={
                    {
                      "--preview-width": `${Math.min(plan.metadata.frameWidth, 320)}px`,
                      "--preview-height": `${Math.min(plan.metadata.frameHeight, 320)}px`,
                      "--frame-count": plan.metadata.frameCount,
                      "--duration": `${Math.max(0.1, plan.metadata.frameCount / Math.max(1, plan.metadata.fps))}s`,
                      imageRendering: plan.metadata.style === "pixel_art" ? "pixelated" : "auto"
                    } as React.CSSProperties
                  }
                >
                  <img
                    className="sprite-animation-sheet"
                    src={`${apiOrigin}${asset.files.sheet}?v=${asset.id}`}
                    alt="动画演示"
                    draggable={false}
                    style={{ width: `${Math.min(plan.metadata.frameWidth, 320) * plan.metadata.frameCount}px`, height: `${Math.min(plan.metadata.frameHeight, 320)}px` }}
                  />
                </div>
              </div>
            </section>
          ) : null}
          <label className="mt-4 block text-sm">
            Prompt
            <textarea
              className="mt-1 h-48 w-full resize-y overflow-auto rounded border border-[#d8cfbf] bg-white p-3 font-mono text-xs"
              value={promptText}
              placeholder="点击“生成 Prompt”后可在这里编辑，生成素材时会使用此 Prompt。"
              onChange={(event) => setPromptText(event.target.value)}
            />
          </label>
          {asset ? (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a className="rounded border border-[#2f8f70] px-3 py-2 text-[#1f6d54]" href={`${downloadBase}/png`}>
                下载 PNG
              </a>
              <a className="rounded border border-[#2f8f70] px-3 py-2 text-[#1f6d54]" href={`${downloadBase}/sheet`}>
                下载 Sprite Sheet
              </a>
              <a className="rounded border border-[#2f8f70] px-3 py-2 text-[#1f6d54]" href={`${downloadBase}/json`}>
                下载 JSON
              </a>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-[#d8cfbf] bg-[#fffaf2] p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">风格档案</h2>
          <label className="mb-3 block text-sm">
            风格名称
            <input className="mt-1 w-full rounded border px-3 py-2" value={styleProfile.styleName} onChange={(event) => setStyleProfile({ styleName: event.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            主色板
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={paletteText}
              onChange={(event) => setStyleProfile({ colorPalette: event.target.value.split(",").map((color) => color.trim()).filter(Boolean) })}
            />
          </label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {palettePreview.map((color, index) => (
              <label key={`${index}-${color}`} className="flex items-center gap-2 rounded border border-[#d8cfbf] bg-white px-2 py-2 text-xs">
                <input className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" type="color" value={normalizeColorValue(color)} onChange={(event) => updatePaletteColor(index, event.target.value)} />
                <span className="truncate font-mono">{normalizeColorValue(color).toUpperCase()}</span>
              </label>
            ))}
          </div>
          <label className="mb-3 block text-sm">
            线条
            <input className="mt-1 w-full rounded border px-3 py-2" value={styleProfile.lineStyle} onChange={(event) => setStyleProfile({ lineStyle: event.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            光照
            <input className="mt-1 w-full rounded border px-3 py-2" value={styleProfile.lighting} onChange={(event) => setStyleProfile({ lighting: event.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            世界观关键词
            <input className="mt-1 w-full rounded border px-3 py-2" value={styleProfile.worldKeywords} onChange={(event) => setStyleProfile({ worldKeywords: event.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            负面约束
            <textarea className="mt-1 w-full rounded border px-3 py-2" rows={4} value={styleProfile.negativePrompt} onChange={(event) => setStyleProfile({ negativePrompt: event.target.value })} />
          </label>
          <div className="text-sm text-[#6d7180]">导出格式: PNG / Sprite Sheet / JSON</div>
        </section>
      </div>
    </main>
  );
}

function normalizeColorValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2E5EAA";
}

export default App;

const assetTypes = [
  ["monster", "怪物"],
  ["character", "角色"],
  ["prop", "道具"],
  ["icon", "UI 图标"],
  ["tile", "地图瓦片"],
  ["effect", "特效"]
];

const styles = [
  ["pixel_art", "像素风"],
  ["cartoon", "卡通风"],
  ["hand_drawn", "手绘风"],
  ["dark_fantasy", "暗黑幻想"],
  ["chibi", "Q版"]
];

const sizes = [["128x128", "128x128"], ["256x256", "256x256"], ["512x512", "512x512"], ["1024x1024", "1024x1024"]];
const views = [["side", "侧面"], ["front", "正面"], ["top_down", "俯视"], ["isometric", "等距"]];
const animations = [["idle", "待机"], ["walk", "行走"], ["attack", "攻击"], ["death", "死亡"], ["static", "静态"]];
const targets = [["unity", "Unity"], ["godot", "Godot"], ["cocos", "Cocos"], ["generic", "通用"]];

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <select className="mt-1 w-full rounded border px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className="mt-1 w-full rounded border px-3 py-2"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
      />
    </label>
  );
}
