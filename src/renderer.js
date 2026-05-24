import { createRandom, clamp } from "./core.js";

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgba(hex, alpha = 1) {
  const color = hexToRgb(hex);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function clear(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  return context;
}

export function resizeCanvas(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

export function renderFrame(canvas, plan, frameIndex, scale = 1) {
  const { frameWidth, frameHeight } = plan.metadata;
  resizeCanvas(canvas, frameWidth * scale, frameHeight * scale);
  const context = clear(canvas);
  context.imageSmoothingEnabled = plan.draw.renderMode !== "pixel";
  context.save();
  context.scale(scale, scale);
  drawAsset(context, plan, frameIndex, frameWidth, frameHeight);
  context.restore();
}

export function renderSheet(canvas, plan, scale = 1) {
  const { frameWidth, frameHeight, frameCount } = plan.metadata;
  resizeCanvas(canvas, frameWidth * frameCount * scale, frameHeight * scale);
  const context = clear(canvas);
  context.imageSmoothingEnabled = plan.draw.renderMode !== "pixel";
  context.save();
  context.scale(scale, scale);

  for (let index = 0; index < frameCount; index += 1) {
    context.save();
    context.translate(index * frameWidth, 0);
    drawAsset(context, plan, index, frameWidth, frameHeight);
    context.restore();
  }

  context.restore();
}

function drawAsset(context, plan, frameIndex, width, height) {
  const random = createRandom(plan.seed + frameIndex * 101);
  const palette = plan.draw.palette;
  const primary = palette[0] || "#2E5EAA";
  const secondary = palette[1] || "#43A047";
  const highlight = palette[4] || "#FFFFFF";
  const outline = palette[5] || "#172033";
  const accent = palette[3] || "#EF5350";
  const progress = plan.metadata.frameCount <= 1 ? 0 : frameIndex / (plan.metadata.frameCount - 1);
  const bounce = Math.sin(progress * Math.PI * 2) * Math.max(1, height * 0.04);

  context.lineCap = "round";
  context.lineJoin = "round";

  if (plan.draw.assetType === "tile") {
    drawTile(context, width, height, primary, secondary, accent, outline, random);
    return;
  }

  if (plan.draw.assetType === "icon") {
    drawIcon(context, width, height, primary, secondary, highlight, outline, accent);
    return;
  }

  if (plan.draw.assetType === "effect") {
    drawEffect(context, width, height, primary, accent, highlight, progress);
    return;
  }

  if (plan.draw.assetType === "prop") {
    drawProp(context, width, height, primary, secondary, highlight, outline);
    return;
  }

  drawCreature(context, width, height, primary, secondary, highlight, outline, accent, bounce, plan.draw.assetType);
}

function drawCreature(context, width, height, primary, secondary, highlight, outline, accent, bounce, assetType) {
  const cx = width / 2;
  const cy = height / 2 + bounce;
  const bodyW = width * (assetType === "character" ? 0.42 : 0.62);
  const bodyH = height * (assetType === "character" ? 0.62 : 0.48);
  const line = Math.max(1, Math.round(width / 18));

  context.fillStyle = rgba(primary, 0.98);
  context.strokeStyle = outline;
  context.lineWidth = line;

  if (assetType === "character") {
    roundedBody(context, cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, line * 2);
    context.fill();
    context.stroke();
    context.fillStyle = secondary;
    context.fillRect(cx - bodyW * 0.22, cy + bodyH * 0.32, bodyW * 0.16, bodyH * 0.26);
    context.fillRect(cx + bodyW * 0.06, cy + bodyH * 0.32, bodyW * 0.16, bodyH * 0.26);
  } else {
    context.beginPath();
    context.ellipse(cx, cy + bodyH * 0.08, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.fillStyle = rgba(highlight, 0.72);
  context.beginPath();
  context.ellipse(cx - bodyW * 0.16, cy - bodyH * 0.12, bodyW * 0.14, bodyH * 0.09, -0.4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = outline;
  const eyeY = cy - bodyH * 0.03;
  context.beginPath();
  context.arc(cx - bodyW * 0.16, eyeY, Math.max(1, width * 0.035), 0, Math.PI * 2);
  context.arc(cx + bodyW * 0.16, eyeY, Math.max(1, width * 0.035), 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = outline;
  context.lineWidth = Math.max(1, line * 0.7);
  context.beginPath();
  context.arc(cx, cy + bodyH * 0.08, bodyW * 0.16, 0.15, Math.PI - 0.15);
  context.stroke();

  if (assetType === "monster") {
    context.fillStyle = rgba(accent, 0.82);
    context.beginPath();
    context.moveTo(cx, cy - bodyH * 0.62);
    context.lineTo(cx - bodyW * 0.1, cy - bodyH * 0.42);
    context.lineTo(cx + bodyW * 0.1, cy - bodyH * 0.42);
    context.closePath();
    context.fill();
  }
}

function drawIcon(context, width, height, primary, secondary, highlight, outline, accent) {
  const pad = width * 0.14;
  const line = Math.max(1, Math.round(width / 18));
  context.fillStyle = rgba(primary, 0.22);
  context.strokeStyle = outline;
  context.lineWidth = line;
  roundedBody(context, pad, pad, width - pad * 2, height - pad * 2, width * 0.14);
  context.fill();
  context.stroke();

  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(-0.7);
  context.fillStyle = highlight;
  context.strokeStyle = outline;
  context.lineWidth = line;
  context.beginPath();
  context.moveTo(0, -height * 0.34);
  context.lineTo(width * 0.1, height * 0.1);
  context.lineTo(0, height * 0.22);
  context.lineTo(-width * 0.1, height * 0.1);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = secondary;
  context.fillRect(-width * 0.05, height * 0.2, width * 0.1, height * 0.18);
  context.fillStyle = accent;
  context.fillRect(-width * 0.18, height * 0.12, width * 0.36, height * 0.08);
  context.restore();
}

function drawTile(context, width, height, primary, secondary, accent, outline, random) {
  context.fillStyle = secondary;
  context.fillRect(0, 0, width, height);
  context.fillStyle = rgba(primary, 0.74);
  for (let index = 0; index < 18; index += 1) {
    const x = random() * width;
    const y = random() * height;
    context.fillRect(Math.floor(x), Math.floor(y), Math.max(1, width / 16), Math.max(1, height / 16));
  }
  context.fillStyle = rgba(accent, 0.78);
  for (let index = 0; index < 4; index += 1) {
    const x = random() * width;
    const y = random() * height;
    context.beginPath();
    context.arc(x, y, Math.max(1, width * 0.04), 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = rgba(outline, 0.35);
  context.lineWidth = Math.max(1, width / 32);
  context.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function drawEffect(context, width, height, primary, accent, highlight, progress) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (0.18 + progress * 0.26);
  context.globalCompositeOperation = "source-over";
  for (let index = 3; index >= 0; index -= 1) {
    context.fillStyle = index === 0 ? highlight : index === 1 ? accent : primary;
    context.globalAlpha = clamp(0.25 + progress * 0.25 + index * 0.12, 0.2, 0.9);
    context.beginPath();
    context.arc(cx, cy, radius * (1 + index * 0.28), 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawProp(context, width, height, primary, secondary, highlight, outline) {
  const cx = width / 2;
  const cy = height / 2;
  const line = Math.max(1, Math.round(width / 18));
  context.fillStyle = primary;
  context.strokeStyle = outline;
  context.lineWidth = line;
  roundedBody(context, width * 0.28, height * 0.22, width * 0.44, height * 0.52, width * 0.08);
  context.fill();
  context.stroke();
  context.fillStyle = secondary;
  context.fillRect(width * 0.34, height * 0.42, width * 0.32, height * 0.1);
  context.fillStyle = highlight;
  context.beginPath();
  context.arc(cx, cy - height * 0.12, width * 0.08, 0, Math.PI * 2);
  context.fill();
}

function roundedBody(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}
