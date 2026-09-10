export function rasterLinePoints(x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const points = []; const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1; const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1; let error = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 }); if (x0 === x1 && y0 === y1) break;
    const doubled = error * 2; if (doubled >= dy) { error += dy; x0 += sx; } if (doubled <= dx) { error += dx; y0 += sy; }
  }
  return points;
}

export function drawPixelLine(ctx, x0, y0, x1, y1, color, dash = null) {
  const points = rasterLinePoints(x0, y0, x1, y1); const cycle = dash ? dash[0] + dash[1] : 0; ctx.save(); ctx.fillStyle = color;
  points.forEach(({ x, y }, index) => { if (!dash || index % cycle < dash[0]) ctx.fillRect(x, y, 1, 1); }); ctx.restore();
}

export function drawPixelPolyline(ctx, points, color, closed = false, dash = null) {
  if (points.length < 2) return;
  for (let index = 1; index < points.length; index++) drawPixelLine(ctx, points[index - 1][0], points[index - 1][1], points[index][0], points[index][1], color, dash);
  if (closed) drawPixelLine(ctx, points.at(-1)[0], points.at(-1)[1], points[0][0], points[0][1], color, dash);
}

export function drawPixelRectangle(ctx, rectangle, color) {
  const left = Math.round(rectangle.x); const top = Math.round(rectangle.y); const right = Math.round(rectangle.x + rectangle.width); const bottom = Math.round(rectangle.y + rectangle.height);
  drawPixelPolyline(ctx, [[left, top], [right, top], [right, bottom], [left, bottom]], color, true);
}

export function drawPixelCircle(ctx, centerX, centerY, radius, color) {
  const cx = Math.round(centerX); const cy = Math.round(centerY); let x = Math.max(0, Math.round(radius)); let y = 0; let error = 1 - x; ctx.save(); ctx.fillStyle = color;
  while (x >= y) {
    for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(cx + px, cy + py, 1, 1);
    y++; if (error < 0) error += 2 * y + 1; else { x--; error += 2 * (y - x) + 1; }
  }
  ctx.restore();
}

export function drawPixelShape(ctx, shape, color) {
  if (shape.type === "polygon") drawPixelPolyline(ctx, shape.points, color, true);
  else if (shape.type === "rectangle") drawPixelRectangle(ctx, shape, color);
  else if (shape.type === "circle") drawPixelCircle(ctx, shape.x, shape.y, shape.radius, color);
}
