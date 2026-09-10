export const IMAGE_FIT_MODES = Object.freeze(["stretch", "cover", "contain"]);

export function fittedImageRect(imageWidth, imageHeight, target, transform = {}) {
  const x = Number(target?.x) || 0; const y = Number(target?.y) || 0;
  const targetWidth = Math.max(0, Number(target?.width) || 0); const targetHeight = Math.max(0, Number(target?.height) || 0);
  const sourceWidth = Math.max(0, Number(imageWidth) || 0); const sourceHeight = Math.max(0, Number(imageHeight) || 0);
  const fit = IMAGE_FIT_MODES.includes(transform.backgroundFit) ? transform.backgroundFit : "stretch";
  const zoom = Number.isFinite(transform.backgroundZoom) && transform.backgroundZoom > 0 ? transform.backgroundZoom : 1;
  const offsetX = Number.isFinite(transform.backgroundOffsetX) ? transform.backgroundOffsetX : 0;
  const offsetY = Number.isFinite(transform.backgroundOffsetY) ? transform.backgroundOffsetY : 0;
  if (!sourceWidth || !sourceHeight || !targetWidth || !targetHeight) return { x, y, width: targetWidth, height: targetHeight };
  let width; let height;
  if (fit === "stretch") { width = targetWidth * zoom; height = targetHeight * zoom; }
  else { const ratio = (fit === "cover" ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)) * zoom; width = sourceWidth * ratio; height = sourceHeight * ratio; }
  return { x: x + (targetWidth - width) / 2 + offsetX, y: y + (targetHeight - height) / 2 + offsetY, width, height };
}

export function drawFittedImage(context, image, target, transform = {}) {
  const rect = fittedImageRect(image.width, image.height, target, transform);
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height); return rect;
}
