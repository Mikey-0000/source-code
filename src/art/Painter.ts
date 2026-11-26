export type Ctx = CanvasRenderingContext2D;
export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!; x.imageSmoothingEnabled = false; return [c, x];
}
export const px = (c: Ctx, x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
export const rect = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
/** Thick pixel line (Bresenham with square brush). */
export function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, t: number, col: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy;
  c.fillStyle = col; const o = Math.floor(t / 2);
  for (let i = 0; i < 400; i++) { c.fillRect(x0 - o, y0 - o, t, t); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } }
}
/** Crisp filled ellipse (no anti-aliasing). */
export function disc(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.0001)) + 0.5); c.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
}
export function ring(c: Ctx, cx: number, cy: number, r: number, col: string) {
  c.fillStyle = col; const n = Math.max(16, r * 8);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
}
/** Adds a 1px outline (with deterministic gaps for a "fractured" look) around non-transparent pixels. */
export function outline(c: Ctx, w: number, h: number, col: [number, number, number], gap = 0, seed = 1) {
  const img = c.getImageData(0, 0, w, h), d = img.data; const out = new Uint8ClampedArray(d);
  const A = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (A(x, y) > 40) continue;
    if (A(x - 1, y) > 40 || A(x + 1, y) > 40 || A(x, y - 1) > 40 || A(x, y + 1) > 40) {
      const hsh = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
      if (gap && hsh % gap === 0) continue;
      const i = (y * w + x) * 4; out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = 255;
    }
  }
  c.putImageData(new ImageData(out, w, h), 0, 0);
}
export function flipH(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, x] = canvas(src.width, src.height); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c;
}
