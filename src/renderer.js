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
  const style = plan.draw.style || plan.metadata.style || "pixel_art";
  const assetType = plan.draw.assetType || plan.metadata.assetType || "monster";
  const palette = normalizeDrawPalette(plan.draw.palette);
  const random = createRandom(plan.seed + frameIndex * 997);
  const progress = plan.metadata.frameCount <= 1 ? 0 : frameIndex / (plan.metadata.frameCount - 1);
  const motion = getMotion(plan, progress, width, height);

  context.save();
  context.lineCap = style === "dark_fantasy" ? "butt" : "round";
  context.lineJoin = style === "dark_fantasy" ? "miter" : "round";
  context.lineWidth = style === "pixel_art" ? Math.max(1, Math.round(width / 24)) : Math.max(2, Math.round(width / 18));
  context.strokeStyle = style === "dark_fantasy" ? "#0E1017" : palette.outline;

  if (style === "pixel_art") {
    context.translate(0.5, 0.5);
  }
  if (style === "hand_drawn") {
    context.rotate((random() - 0.5) * 0.04);
  }

  const state = { style, palette, random, motion, width, height };
  if (assetType === "tile") drawTile(context, state);
  else if (assetType === "icon") drawIcon(context, state);
  else if (assetType === "effect") drawEffect(context, state);
  else if (assetType === "prop") drawProp(context, state);
  else if (assetType === "character") drawCharacter(context, state);
  else drawMonster(context, state);

  context.restore();
}

function normalizeDrawPalette(colors = []) {
  const [primary = "#2E5EAA", secondary = "#43A047", highlight = "#FDD835", accent = "#EF5350", white = "#FFFFFF", outline = "#172033"] = colors;
  return { primary, secondary, highlight, accent, white, outline };
}

function getMotion(plan, progress, width, height) {
  const wave = Math.sin(progress * Math.PI * 2);
  const animation = plan.draw.animation || plan.metadata.animationName || "static";
  return {
    wave,
    bob: animation === "static" ? 0 : wave * Math.max(1, height * 0.05),
    lunge: animation === "attack" ? Math.sin(progress * Math.PI) * width * 0.1 : 0,
    step: animation === "walk" ? wave * width * 0.04 : 0,
    fade: animation === "death" ? 1 - progress * 0.45 : 1
  };
}

function drawTile(context, { style, palette, random, width, height }) {
  context.fillStyle = style === "dark_fantasy" ? "#2B2A2F" : palette.secondary;
  context.fillRect(0, 0, width, height);
  const cell = style === "pixel_art" ? Math.max(2, Math.round(width / 8)) : Math.max(3, width / 7);
  for (let index = 0; index < 26; index += 1) {
    const x = snap(random() * width, style);
    const y = snap(random() * height, style);
    context.fillStyle = random() > 0.55 ? palette.primary : palette.highlight;
    if (style === "hand_drawn") {
      context.beginPath();
      context.ellipse(x, y, cell * random(), cell * 0.42, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(x, y, Math.max(1, cell * 0.45), Math.max(1, cell * 0.45));
    }
  }
  if (style === "dark_fantasy") {
    context.strokeStyle = palette.accent;
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 4) {
      line(context, x, 0, x + width * 0.12, height);
    }
  }
}

function drawIcon(context, state) {
  const { style, palette, width, height, motion } = state;
  const cx = width / 2;
  const cy = height / 2 + motion.bob;
  if (style !== "pixel_art") {
    context.fillStyle = tint(palette.secondary, 0.22);
    roundRect(context, width * 0.13, height * 0.13, width * 0.74, height * 0.74, width * 0.12);
    context.fill();
    context.stroke();
  }
  context.save();
  context.translate(cx + motion.lunge, cy);
  context.rotate(-0.7);
  context.fillStyle = palette.white;
  polygon(context, [[0, -height * 0.32], [width * 0.08, height * 0.05], [0, height * 0.18], [-width * 0.08, height * 0.05]]);
  context.fill();
  context.stroke();
  context.fillStyle = palette.highlight;
  rect(context, -width * 0.16, height * 0.13, width * 0.32, height * 0.07, style);
  context.fill();
  context.stroke();
  context.fillStyle = palette.accent;
  rect(context, -width * 0.05, height * 0.2, width * 0.1, height * 0.2, style);
  context.fill();
  context.stroke();
  context.restore();
}

function drawEffect(context, { style, palette, width, height, motion }) {
  const cx = width / 2;
  const cy = height / 2;
  const pulse = 0.58 + Math.abs(motion.wave) * 0.24;
  context.globalAlpha = motion.fade;
  if (style === "pixel_art") {
    context.fillStyle = palette.accent;
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      const radius = width * pulse * (0.18 + (index % 3) * 0.04);
      context.fillRect(snap(cx + Math.cos(angle) * radius, style), snap(cy + Math.sin(angle) * radius, style), 4, 4);
    }
    context.fillStyle = palette.highlight;
    context.fillRect(cx - width * 0.12, cy - height * 0.12, width * 0.24, height * 0.24);
    return;
  }
  for (let index = 0; index < 3; index += 1) {
    context.strokeStyle = [palette.accent, palette.highlight, palette.white][index];
    context.lineWidth = Math.max(2, width * (0.07 - index * 0.015));
    context.beginPath();
    context.arc(cx, cy, width * pulse * (0.16 + index * 0.1), index * 0.9, Math.PI * 1.7 + index * 0.6);
    context.stroke();
  }
  context.fillStyle = palette.white;
  star(context, cx, cy, width * 0.12, width * 0.28, style === "dark_fantasy" ? 6 : 8);
  context.fill();
}

function drawProp(context, { style, palette, width, height, motion }) {
  const x = width * 0.22;
  const y = height * 0.34 + motion.bob;
  const w = width * 0.56;
  const h = height * 0.42;
  context.fillStyle = style === "dark_fantasy" ? palette.primary : palette.accent;
  roundRect(context, x, y, w, h, style === "pixel_art" ? 0 : width * 0.06);
  context.fill();
  context.stroke();
  context.fillStyle = palette.highlight;
  rect(context, x + w * 0.43, y, w * 0.14, h, style);
  context.fill();
  context.stroke();
  context.fillStyle = palette.secondary;
  rect(context, x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.16, style);
  context.fill();
}

function drawCharacter(context, state) {
  const { style, palette, width, height, motion } = state;
  const cx = width / 2 + motion.step;
  const base = height * 0.76;
  const headRadius = style === "chibi" ? width * 0.22 : width * 0.16;
  const bodyHeight = style === "chibi" ? height * 0.24 : height * 0.34;
  drawLegs(context, cx, base, width, height, motion, style, palette);
  context.fillStyle = palette.primary;
  roundRect(context, cx - width * 0.16, base - bodyHeight, width * 0.32, bodyHeight, style === "pixel_art" ? 0 : width * 0.08);
  context.fill();
  context.stroke();
  context.fillStyle = palette.highlight;
  polygon(context, [[cx, base - bodyHeight * 0.92], [cx - width * 0.1, base - bodyHeight * 0.25], [cx + width * 0.1, base - bodyHeight * 0.25]]);
  context.fill();
  context.fillStyle = palette.white;
  circle(context, cx, base - bodyHeight - headRadius * 0.78 + motion.bob * 0.25, headRadius, style);
  context.fill();
  context.stroke();
  drawEyes(context, cx, base - bodyHeight - headRadius * 0.8 + motion.bob * 0.25, headRadius, style, palette);
}

function drawMonster(context, state) {
  const { style, palette, width, height, motion } = state;
  const cx = width / 2 + motion.lunge;
  const cy = height * 0.58 + motion.bob;
  if (style === "dark_fantasy") {
    context.fillStyle = palette.primary;
    polygon(context, [
      [cx - width * 0.32, cy + height * 0.13],
      [cx - width * 0.22, cy - height * 0.12],
      [cx - width * 0.08, cy - height * 0.24],
      [cx + width * 0.12, cy - height * 0.2],
      [cx + width * 0.31, cy + height * 0.03],
      [cx + width * 0.18, cy + height * 0.22]
    ]);
    context.fill();
    context.stroke();
    drawHorns(context, cx, cy, width, height, palette);
  } else if (style === "pixel_art") {
    context.fillStyle = palette.primary;
    rect(context, cx - width * 0.28, cy - height * 0.18, width * 0.56, height * 0.34, style);
    context.fill();
    context.stroke();
    context.fillStyle = palette.secondary;
    rect(context, cx - width * 0.2, cy - height * 0.28, width * 0.4, height * 0.16, style);
    context.fill();
    context.stroke();
  } else {
    context.fillStyle = style === "chibi" ? palette.secondary : palette.primary;
    context.beginPath();
    context.ellipse(cx, cy, width * 0.3, height * 0.24, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  drawEyes(context, cx, cy - height * 0.02, width * (style === "chibi" ? 0.24 : 0.16), style, palette);
  context.fillStyle = palette.accent;
  polygon(context, [[cx, cy - height * 0.34], [cx - width * 0.06, cy - height * 0.18], [cx + width * 0.06, cy - height * 0.18]]);
  context.fill();
}

function drawLegs(context, cx, base, width, height, motion, style, palette) {
  context.strokeStyle = palette.outline;
  context.fillStyle = palette.accent;
  const stride = motion.wave * width * 0.05;
  rect(context, cx - width * 0.11 - stride, base - height * 0.14, width * 0.08, height * 0.14, style);
  context.fill();
  context.stroke();
  rect(context, cx + width * 0.03 + stride, base - height * 0.14, width * 0.08, height * 0.14, style);
  context.fill();
  context.stroke();
}

function drawEyes(context, cx, cy, radius, style, palette) {
  const eye = Math.max(1.5, radius * (style === "chibi" ? 0.18 : 0.13));
  context.fillStyle = palette.outline;
  circle(context, cx - radius * 0.45, cy, eye, style);
  context.fill();
  circle(context, cx + radius * 0.45, cy, eye, style);
  context.fill();
  if (style !== "dark_fantasy") {
    context.fillStyle = palette.white;
    circle(context, cx - radius * 0.5, cy - eye * 0.35, Math.max(1, eye * 0.35), style);
    context.fill();
    circle(context, cx + radius * 0.4, cy - eye * 0.35, Math.max(1, eye * 0.35), style);
    context.fill();
  }
}

function drawHorns(context, cx, cy, width, height, palette) {
  context.fillStyle = palette.highlight;
  polygon(context, [[cx - width * 0.16, cy - height * 0.16], [cx - width * 0.26, cy - height * 0.34], [cx - width * 0.04, cy - height * 0.22]]);
  context.fill();
  context.stroke();
  polygon(context, [[cx + width * 0.13, cy - height * 0.16], [cx + width * 0.24, cy - height * 0.33], [cx + width * 0.02, cy - height * 0.22]]);
  context.fill();
  context.stroke();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  if (!radius) {
    context.rect(x, y, width, height);
    return;
  }
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function rect(context, x, y, width, height, style) {
  context.beginPath();
  context.rect(snap(x, style), snap(y, style), snap(width, style), snap(height, style));
}

function circle(context, x, y, radius, style) {
  context.beginPath();
  if (style === "pixel_art") {
    context.rect(snap(x - radius), snap(y - radius), snap(radius * 2), snap(radius * 2));
  } else {
    context.arc(x, y, radius, 0, Math.PI * 2);
  }
}

function line(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function polygon(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function star(context, cx, cy, inner, outer, count) {
  context.beginPath();
  for (let index = 0; index < count * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (index / (count * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function snap(value, style = "pixel_art") {
  return style === "pixel_art" ? Math.round(value) : value;
}

function tint(hex, amount) {
  const number = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((number >> 16) & 255) + 255 * amount));
  const g = Math.min(255, Math.round(((number >> 8) & 255) + 255 * amount));
  const b = Math.min(255, Math.round((number & 255) + 255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}
