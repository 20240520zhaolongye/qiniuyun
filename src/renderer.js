import { createRandom } from "./core.js";

function resizeCanvas(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function clear(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  return context;
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
  const [primary, secondary, highlight, accent, white, outline] = plan.draw.palette;
  const progress = plan.metadata.frameCount <= 1 ? 0 : frameIndex / (plan.metadata.frameCount - 1);
  const bounce = Math.sin(progress * Math.PI * 2) * Math.max(1, height * 0.04);
  context.lineWidth = Math.max(1, Math.round(width / 18));
  context.lineCap = "round";
  context.lineJoin = "round";

  if (plan.draw.assetType === "tile") {
    context.fillStyle = secondary;
    context.fillRect(0, 0, width, height);
    context.fillStyle = primary;
    for (let index = 0; index < 18; index += 1) {
      context.fillRect(Math.floor(random() * width), Math.floor(random() * height), 2, 2);
    }
    return;
  }

  const cx = width / 2;
  const cy = height / 2 + bounce;
  context.fillStyle = primary;
  context.strokeStyle = outline || "#172033";
  context.beginPath();
  context.ellipse(cx, cy, width * 0.3, height * 0.24, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = white || highlight;
  context.beginPath();
  context.ellipse(cx - width * 0.08, cy - height * 0.08, width * 0.06, height * 0.04, -0.4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = outline || "#172033";
  context.beginPath();
  context.arc(cx - width * 0.1, cy, Math.max(1, width * 0.035), 0, Math.PI * 2);
  context.arc(cx + width * 0.1, cy, Math.max(1, width * 0.035), 0, Math.PI * 2);
  context.fill();
  context.fillStyle = accent || "#EF5350";
  context.beginPath();
  context.moveTo(cx, cy - height * 0.32);
  context.lineTo(cx - width * 0.05, cy - height * 0.18);
  context.lineTo(cx + width * 0.05, cy - height * 0.18);
  context.closePath();
  context.fill();
}
