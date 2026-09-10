const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function noise(index, seed = 0) {
  const value = Math.sin(index * 91.3458 + seed * 17.217) * 47453.5453;
  return value - Math.floor(value);
}

export function lightOverlayIntensity(light = {}, time = 0) {
  const mode = light.lightMode ?? "fixed"; const speed = Math.max(.05, Number(light.lightSpeed) || 1); const phase = Math.max(0, time) * speed / 1000;
  if (mode === "blink") return phase % 1 < clamp01(light.lightDuty ?? .5) ? 1 : 0;
  if (mode === "pulse") return .2 + .8 * (.5 + .5 * Math.sin(phase * Math.PI * 2 - Math.PI / 2));
  if (mode === "flicker") { const step = Math.floor(phase * 14); const coarse = noise(step, String(light.id ?? "light").length); const fine = noise(step * 3 + 7, 3); return .18 + .82 * (coarse * .72 + fine * .28); }
  if (mode === "sparkle") return sparkleOverlayFrame(light, time).intensity;
  return 1;
}

export function sparkleOverlayFrame(light = {}, time = 0) {
  const speed = Math.max(.05, Number(light.lightSpeed) || 1); const phase = Math.max(0, time) * speed / 1000 % 1; const duty = clamp01(light.lightDuty ?? .65);
  if (duty <= 0 || phase >= duty) return { intensity: 0, scale: 0, rotation: 0 };
  const progress = phase / duty; const envelope = Math.sin(progress * Math.PI); const start = Number(light.lightRotation) || 0; const spin = Number.isFinite(light.lightSpin) ? light.lightSpin : 45;
  return { intensity: envelope * envelope, scale: envelope, rotation: (start + progress * spin) * Math.PI / 180 };
}

function rgba(color, alpha) {
  const match = /^#([0-9a-f]{6})$/i.exec(color ?? ""); if (!match) return alpha >= 1 ? (color || "#fff4b0") : `rgba(255,244,176,${alpha})`;
  const value = Number.parseInt(match[1], 16); return `rgba(${value >> 16},${value >> 8 & 255},${value & 255},${alpha})`;
}

export function drawLightOverlay(ctx, light = {}, time = 0, alpha = 1) {
  const width = Math.max(1, Number(light.width) || 32); const height = Math.max(1, Number(light.height) || width); const intensity = clamp01(light.lightIntensity ?? 1) * lightOverlayIntensity(light, time) * clamp01(alpha) * clamp01(light.opacity ?? 1);
  if (intensity <= 0) return;
  const softness = Math.max(.05, Math.min(.95, Number(light.lightSoftness) || .65)); const core = Math.max(0, Math.min(.45, Number(light.lightCore) || .08));
  ctx.save(); ctx.translate((Number(light.x) || 0) + width / 2, (Number(light.y) || 0) + height / 2);
  if (light.lightMode === "sparkle") { const frame = sparkleOverlayFrame(light, time); ctx.rotate(frame.rotation); ctx.scale(width / 2 * frame.scale, height / 2 * frame.scale); }
  else ctx.scale(width / 2, height / 2);
  ctx.globalAlpha = intensity; ctx.globalCompositeOperation = "screen";
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); const color = light.lightColor ?? "#fff4b0";
  gradient.addColorStop(0, rgba(color, 1)); gradient.addColorStop(core, rgba(color, 1)); gradient.addColorStop(Math.min(.96, core + (1 - softness) * .42 + .12), rgba(color, .62)); gradient.addColorStop(Math.min(.98, .58 + softness * .22), rgba(color, .16)); gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  if (light.lightMode === "sparkle") fillFourPointStar(ctx, Math.max(.02, Math.min(.5, Number(light.lightSpikeWidth) || .12)));
  else ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function fillFourPointStar(ctx, width) {
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(width, -width); ctx.lineTo(1, 0); ctx.lineTo(width, width); ctx.lineTo(0, 1); ctx.lineTo(-width, width); ctx.lineTo(-1, 0); ctx.lineTo(-width, -width); ctx.closePath(); ctx.fill();
}
