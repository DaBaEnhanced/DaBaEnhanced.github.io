export const SCREEN_EFFECT_DEFINITIONS = Object.freeze([
  { id: "flash", label: "Flash" },
  { id: "shake", label: "Screen shake" },
  { id: "glitch", label: "Digital glitch" },
  { id: "scanlines", label: "Scanline pulse" },
  { id: "colorGrade", label: "Color grade (brightness / gamma / saturation)" }
]);

export const SCREEN_EFFECT_IDS = new Set(SCREEN_EFFECT_DEFINITIONS.map((effect) => effect.id));

const progressFor = (effect, time) => Math.max(0, Math.min(1, (time - effect.started) / Math.max(1, effect.duration)));
const envelopeFor = (effect, time) => Math.sin(progressFor(effect, time) * Math.PI);
const intensityFor = (effect) => Math.max(0, Number(effect.intensity) || 0);
const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

export function colorGradePixel(red, green, blue, { brightness = 1, gamma = 1, saturation = 1, amount = 1 } = {}) {
  brightness = Math.max(0, Number(brightness) || 0); gamma = Math.max(.01, Number(gamma) || 1); saturation = Math.max(0, Number(saturation) || 0); amount = Math.max(0, Math.min(1, Number(amount) || 0));
  const correct = (channel) => Math.pow(Math.max(0, Math.min(255, channel)) / 255, 1 / gamma) * 255 * brightness;
  const corrected = [correct(red), correct(green), correct(blue)]; const luminance = corrected[0] * .2126 + corrected[1] * .7152 + corrected[2] * .0722;
  return corrected.map((channel, index) => clampByte([red, green, blue][index] + (luminance + (channel - luminance) * saturation - [red, green, blue][index]) * amount));
}

export function applyColorGrade(ctx, effect, amount, width, height) {
  if (!(width > 0 && height > 0 && amount > 0)) return false;
  try {
    const image = ctx.getImageData(0, 0, width, height); const data = image.data; const brightness = Math.max(0, Number(effect.brightness ?? 1) || 0); const gamma = Math.max(.01, Number(effect.gamma ?? 1) || 1); const saturation = Math.max(0, Number(effect.saturation ?? 1) || 0); const blend = Math.max(0, Math.min(1, amount));
    const correction = new Float32Array(256); for (let channel = 0; channel < 256; channel++) correction[channel] = Math.pow(channel / 255, 1 / gamma) * 255 * brightness;
    for (let index = 0; index < data.length; index += 4) { const red = data[index]; const green = data[index + 1]; const blue = data[index + 2]; const correctedRed = correction[red]; const correctedGreen = correction[green]; const correctedBlue = correction[blue]; const luminance = correctedRed * .2126 + correctedGreen * .7152 + correctedBlue * .0722; data[index] = clampByte(red + (luminance + (correctedRed - luminance) * saturation - red) * blend); data[index + 1] = clampByte(green + (luminance + (correctedGreen - luminance) * saturation - green) * blend); data[index + 2] = clampByte(blue + (luminance + (correctedBlue - luminance) * saturation - blue) * blend); }
    ctx.putImageData(image, 0, 0); return true;
  } catch { return false; /* Cross-origin images can make a canvas unreadable. */ }
}

export function screenEffectOffset(effects, time, width, height) {
  let x = 0; let y = 0;
  for (const effect of effects) if (effect.effect === "shake") {
    const elapsed = time - effect.started; const strength = intensityFor(effect) * envelopeFor(effect, time);
    x += Math.sin(elapsed * .19) * 7 * strength * width / 320; y += Math.cos(elapsed * .27) * 5 * strength * height / 180;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

export function drawScreenEffect(ctx, canvas, effect, time, width, height) {
  const progress = progressFor(effect, time); const envelope = envelopeFor(effect, time); const intensity = intensityFor(effect); const color = effect.color || "#aadcd2";
  ctx.save();
  if (effect.effect === "scanlines") {
    ctx.globalAlpha = envelope * intensity * .45; ctx.fillStyle = color;
    const spacing = Math.max(2, Math.round(height / 60));
    for (let y = (Math.floor(progress * spacing * 8) % spacing); y < height; y += spacing) ctx.fillRect(0, y, width, 1);
  } else if (effect.effect === "glitch") {
    const phase = Math.floor((time - effect.started) / 45); ctx.globalAlpha = Math.min(.9, envelope * intensity);
    for (let index = 0; index < 6; index++) {
      const wave = Math.sin((phase + 1) * (index + 3) * 12.9898); const y = Math.abs(Math.floor(wave * 997)) % Math.max(1, height); const bandHeight = 1 + Math.abs(Math.floor(wave * 37)) % Math.max(2, Math.round(height / 14)); const offset = Math.round(Math.sin(phase * 2.3 + index) * intensity * width / 18);
      ctx.drawImage(canvas, 0, y, width, bandHeight, offset, y, width, bandHeight);
    }
    ctx.globalAlpha = envelope * intensity * .2; ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
  } else if (effect.effect === "flash") {
    ctx.globalAlpha = envelope * intensity; ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
  } else if (effect.effect === "colorGrade") {
    applyColorGrade(ctx, effect, envelope * intensity, width, height);
  }
  ctx.restore();
}
