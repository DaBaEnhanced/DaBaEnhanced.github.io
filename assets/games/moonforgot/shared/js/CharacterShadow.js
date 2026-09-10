const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value)));

export function characterShadowSettings(character = {}) {
  const spriteWidth = Math.max(1, character.sprite?.width ?? character.sprite?.frameWidth ?? 48); const shadow = character.shadow ?? {};
  return { enabled: shadow.enabled !== false, width: Math.max(1, Number(shadow.width ?? spriteWidth * .68)), height: Math.max(1, Number(shadow.height ?? 8)), offsetX: Number(shadow.offsetX ?? 0), offsetY: Number(shadow.offsetY ?? -1), opacity: clamp(shadow.opacity ?? .28, 0, 1), falloff: clamp(shadow.falloff ?? .7, .01, 1) };
}

export function drawCharacterShadow(context, character, position, scale = 1) {
  const shadow = characterShadowSettings(character); if (!shadow.enabled || shadow.opacity <= 0 || !(scale > 0)) return false;
  context.save(); context.translate(position.x + shadow.offsetX * scale, position.y + shadow.offsetY * scale); context.scale(shadow.width * scale / 2, shadow.height * scale / 2);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1); const color = `rgba(0,0,0,${shadow.opacity})`; gradient.addColorStop(0, color); const solidUntil = 1 - shadow.falloff; if (solidUntil > 0) gradient.addColorStop(solidUntil, color); gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient; context.beginPath(); context.arc(0, 0, 1, 0, Math.PI * 2); context.fill(); context.restore(); return true;
}
