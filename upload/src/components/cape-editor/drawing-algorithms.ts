// Drawing algorithm utilities for pixel art tools

export interface Point {
  x: number;
  y: number;
}

/**
 * Bresenham's line algorithm for pixel-perfect lines
 */
export function getLinePixels(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

/**
 * Midpoint circle algorithm for pixel-perfect circles
 */
export function getCirclePixels(cx: number, cy: number, rx: number, ry: number, filled: boolean): Point[] {
  const points: Point[] = [];
  const radiusX = Math.abs(rx);
  const radiusY = Math.abs(ry);

  if (radiusX === 0 && radiusY === 0) {
    points.push({ x: cx, y: cy });
    return points;
  }

  if (filled) {
    // Filled ellipse
    for (let y = -radiusY; y <= radiusY; y++) {
      const xRange = Math.sqrt(1 - (y * y) / (radiusY * radiusY)) * radiusX;
      for (let x = -Math.ceil(xRange); x <= Math.ceil(xRange); x++) {
        points.push({ x: cx + x, y: cy + y });
      }
    }
  } else {
    // Ellipse outline using midpoint algorithm
    let x = 0;
    let y = radiusY;
    const a2 = radiusX * radiusX;
    const b2 = radiusY * radiusY;
    let d1 = b2 - a2 * radiusY + a2 / 4;
    let d2 = 0;

    const addPoints = (px: number, py: number) => {
      points.push({ x: cx + px, y: cy + py });
      points.push({ x: cx - px, y: cy + py });
      points.push({ x: cx + px, y: cy - py });
      points.push({ x: cx - px, y: cy - py });
    };

    // Region 1
    while (a2 * y > b2 * x) {
      addPoints(x, y);
      if (d1 < 0) {
        d1 += b2 * (2 * x + 3);
        x++;
      } else {
        d1 += b2 * (2 * x + 3) + a2 * (-2 * y + 2);
        x++;
        y--;
      }
    }

    // Region 2
    d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2;
    while (y >= 0) {
      addPoints(x, y);
      if (d2 > 0) {
        d2 += a2 * (-2 * y + 3);
        y--;
      } else {
        d2 += b2 * (2 * x + 2) + a2 * (-2 * y + 3);
        x++;
        y--;
      }
    }
  }

  return points;
}

/**
 * Get rectangle outline pixels
 */
export function getRectanglePixels(x0: number, y0: number, x1: number, y1: number, filled: boolean): Point[] {
  const points: Point[] = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        points.push({ x, y });
      }
    }
  } else {
    // Top and bottom edges
    for (let x = minX; x <= maxX; x++) {
      points.push({ x, y: minY });
      points.push({ x, y: maxY });
    }
    // Left and right edges
    for (let y = minY + 1; y < maxY; y++) {
      points.push({ x: minX, y });
      points.push({ x: maxX, y });
    }
  }

  return points;
}