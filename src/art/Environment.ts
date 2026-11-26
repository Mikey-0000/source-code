// Chapter-specific tilesets and parallax backgrounds, generated procedurally (original art).
import { C, TILE, VIEW_H } from './Palette';
import { canvas, disc, line, px, rect, type Ctx } from './Painter';
import { hash2, rng } from '../core/Util';

export type Theme = 'boot' | 'exception' | 'root';
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function dither(ctx: Ctx, x0: number, y0: number, w: number, h: number, a: string, b: string) {
  for (let y = 0; y < h; y++) { const t = y / h; for (let x = 0; x < w; x++) px(ctx, x0 + x, y0 + y, (BAYER[y % 4][x % 4] / 16) < t ? b : a); }
}

interface Pal { base: string; base2: string; seam: string; edge: string; edge2: string; accent: string; crack: string }
const PALS: Record<Theme, Pal> = {
  boot: { base: '#1a1a1e', base2: '#212126', seam: '#0c0c0e', edge: '#d9d9dc', edge2: '#4a4a52', accent: C.dimRed, crack: '#0f0f12' },
  exception: { base: '#1c1214', base2: '#26161a', seam: '#0b0607', edge: '#e8c9cd', edge2: '#6a2a33', accent: C.red, crack: C.dimRed },
  root: { base: '#111715', base2: '#16201c', seam: '#070a09', edge: '#cfe9dc', edge2: '#2f4a3d', accent: C.green, crack: '#0a2a1a' },
};

function drawTile(ctx: Ctx, ox: number, oy: number, theme: Theme, tx: number, ty: number, open: { t: boolean; b: boolean; l: boolean; r: boolean }) {
  const p = PALS[theme];
  rect(ctx, ox, oy, TILE, TILE, ((tx + ty) & 1) ? p.base : p.base2);
  // grain
  for (let i = 0; i < 22; i++) { const x = Math.floor(hash2(tx, ty, i) * 32), y = Math.floor(hash2(ty, tx, i + 50) * 32); px(ctx, ox + x, oy + y, hash2(i, tx + ty, 3) > .5 ? p.edge2 : p.seam); }
  // panel seams
  rect(ctx, ox, oy + TILE - 1, TILE, 1, p.seam); rect(ctx, ox + TILE - 1, oy, 1, TILE, p.seam);
  if (hash2(tx, ty, 9) > .55) rect(ctx, ox + 3, oy + 3, 2, 2, p.edge2), rect(ctx, ox + TILE - 6, oy + TILE - 6, 2, 2, p.edge2);
  // cracks (exception: bright, boot: dark)
  const ck = hash2(tx, ty, 11);
  if (ck > (theme === 'exception' ? .45 : .8)) { let x = 4 + Math.floor(hash2(tx, ty, 12) * 22), y = 0; for (let k = 0; k < 28; k++) { px(ctx, ox + x, oy + y, p.crack); y++; x += Math.floor(hash2(k, tx + ty, 13) * 3) - 1; if (x < 1 || x > 30) break; } }
  // vents / cable runs
  if (hash2(tx, ty, 21) > .86) { for (let i = 0; i < 5; i++) rect(ctx, ox + 6, oy + 6 + i * 4, 20, 2, p.seam); }
  if (theme === 'exception' && hash2(tx, ty, 31) > .82) { const dx = Math.floor(hash2(tx, ty, 32) * 10) - 5; rect(ctx, ox + 4 + dx, oy + 10, 14, 3, p.accent); rect(ctx, ox + 8 + dx, oy + 13, 12, 2, C.darkRed); }
  if (theme === 'root' && hash2(tx, ty, 41) > .8) { rect(ctx, ox + 6, oy + 8, 20, 10, '#02140a'); for (let i = 0; i < 3; i++) rect(ctx, ox + 8, oy + 10 + i * 3, 4 + Math.floor(hash2(i, tx, 5) * 12), 1, C.dimGreen); }
  // lit edges where open
  if (open.t) {
    rect(ctx, ox, oy, TILE, 2, p.edge); rect(ctx, ox, oy + 2, TILE, 2, p.edge2); rect(ctx, ox, oy + 4, TILE, 1, p.seam);
    if (hash2(tx, ty, 61) > .6) for (let i = 2; i < 30; i += 4) rect(ctx, ox + i, oy + 6, 2, 1, p.seam);
    if (hash2(tx, ty, 62) > .8) { rect(ctx, ox + 6, oy, 10, 1, '#ffffff'); }
    if (hash2(tx, ty, 63) > .85) { for (let i = 0; i < 32; i += 8) { rect(ctx, ox + i, oy + 2, 4, 2, C.bone); rect(ctx, ox + i + 4, oy + 2, 4, 2, C.void); } }
  }
  if (open.b) { rect(ctx, ox, oy + TILE - 3, TILE, 3, p.seam); if (hash2(tx, ty, 71) > .7) { rect(ctx, ox + 12, oy + TILE - 3, 2, 3 + Math.floor(hash2(tx, ty, 72) * 3), p.edge2); } }
  if (open.l) { rect(ctx, ox, oy, 1, TILE, p.edge2); rect(ctx, ox + 1, oy, 1, TILE, p.seam); }
  if (open.r) { rect(ctx, ox + TILE - 2, oy, 1, TILE, p.seam); rect(ctx, ox + TILE - 1, oy, 1, TILE, p.edge2); }
  if (open.t && open.l) rect(ctx, ox, oy, 2, 2, '#ffffff');
}

export function renderTileLayer(grid: string[], theme: Theme): HTMLCanvasElement {
  const h = grid.length, w = grid[0].length; const [c, x] = canvas(w * TILE, h * TILE);
  const solid = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < w && ty < h && grid[ty][tx] === '#';
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) if (grid[ty][tx] === '#') drawTile(x, tx * TILE, ty * TILE, theme, tx, ty, { t: !solid(tx, ty - 1), b: !solid(tx, ty + 1), l: !solid(tx - 1, ty), r: !solid(tx + 1, ty) });
  return c;
}

export interface BgLayer { canvas: HTMLCanvasElement; factor: number; y: number }
const BW = 1024;

export function buildBackground(theme: Theme): BgLayer[] {
  const r = rng(theme === 'boot' ? 11 : theme === 'exception' ? 23 : 37);
  const wrapDraw = (ctx: Ctx, fn: (ox: number) => void) => { fn(0); fn(-BW); fn(BW); };
  const layers: BgLayer[] = [];
  // ---- far ----
  { const [c, x] = canvas(BW, 360);
    if (theme === 'exception') {
      dither(x, 0, 0, BW, 150, '#0b0405', '#2a0810'); dither(x, 0, 150, BW, 120, '#2a0810', '#5a0f1c'); rect(x, 0, 270, BW, 90, '#0b0405');
      for (let i = 0; i < 26; i++) { const y = Math.floor(r() * 250), h = 1 + Math.floor(r() * 3); rect(x, Math.floor(r() * BW), y, 40 + Math.floor(r() * 220), h, r() > .5 ? C.dimRed : C.darkRed); }
      // jagged black mountains with red rim
      let h0 = 220; for (let xx = 0; xx < BW; xx += 8) { h0 += Math.floor((r() - .5) * 26); h0 = Math.max(150, Math.min(260, h0)); if (xx >= BW - 8) h0 = 220; rect(x, xx, h0, 8, 360 - h0, '#08060a'); rect(x, xx, h0, 8, 1, C.dimRed); }
      for (let i = 0; i < 40; i++) rect(x, Math.floor(r() * BW), Math.floor(r() * 260), 2, 1, C.red);
    } else if (theme === 'root') {
      dither(x, 0, 0, BW, 360, '#050806', '#0c1a13');
      for (let i = 0; i < 90; i++) rect(x, Math.floor(r() * BW), Math.floor(r() * 340), 1, 1, hash2(i, 1) > .5 ? C.dimGreen : C.steel);
    } else {
      dither(x, 0, 0, BW, 140, '#050506', '#16161a'); dither(x, 0, 140, BW, 130, '#16161a', '#2a2a30'); rect(x, 0, 270, BW, 90, '#0a0a0c');
      for (let i = 0; i < 70; i++) px(x, Math.floor(r() * BW), Math.floor(r() * 200), r() > .8 ? C.bone : C.steel2);
      // abandoned monolith towers with window grids
      let xx = 0; while (xx < BW) { const w = 28 + Math.floor(r() * 60), h = 90 + Math.floor(r() * 150); const top = 330 - h;
        rect(x, xx, top, w, h, '#0e0e11'); rect(x, xx, top, w, 1, C.steel); rect(x, xx + w - 1, top, 1, h, '#08080a');
        for (let wy = top + 6; wy < 326; wy += 7) for (let wx = xx + 4; wx < xx + w - 4; wx += 6) if (r() > .72) rect(x, wx, wy, 3, 3, r() > .9 ? C.dimRed : '#3a3a42');
        if (r() > .6) rect(x, xx + w / 2, top - 14, 1, 14, C.steel); if (r() > .8) px(x, xx + w / 2, top - 15, C.red);
        xx += w + 6 + Math.floor(r() * 18); }
      rect(x, 0, 326, BW, 34, '#060607');
    }
    layers.push({ canvas: c, factor: 0.12, y: 0 }); }
  // ---- mid ----
  { const [c, x] = canvas(BW, 360);
    if (theme === 'exception') {
      for (let i = 0; i < 16; i++) { const cx = Math.floor(r() * BW), cy = 60 + Math.floor(r() * 180), s = 14 + Math.floor(r() * 34);
        wrapDraw(x, ox => { const X = cx + ox; line(x, X, cy, X + s, cy, 1, C.dimRed); line(x, X + s, cy, X + s, cy + s, 1, C.dimRed); line(x, X, cy + s, X + s, cy + s, 1, C.dimRed); line(x, X, cy, X, cy + s, 1, C.dimRed); line(x, X + s, cy, X + s + 8, cy - 8, 1, C.darkRed); rect(x, X + 2, cy + 2, s - 3, s - 3, r() > .6 ? '#190608' : '#0b0507'); }); }
      for (let i = 0; i < 12; i++) { const cx = Math.floor(r() * BW), h = 90 + Math.floor(r() * 120); wrapDraw(x, ox => { rect(x, cx + ox, 330 - h, 12 + Math.floor(r() * 12), h, '#0d0809'); rect(x, cx + ox, 330 - h, 3, h, C.darkRed); }); }
    } else {
      // server racks + CRT walls + gantry
      for (let i = 0; i < 9; i++) { const cx = Math.floor(i * BW / 9) + Math.floor(r() * 20), w = 56 + Math.floor(r() * 28), h = 120 + Math.floor(r() * 90);
        wrapDraw(x, ox => { const X = cx + ox; rect(x, X, 330 - h, w, h, '#111114'); rect(x, X, 330 - h, w, 2, C.steel2); rect(x, X + w - 2, 330 - h, 2, h, '#08080a');
          for (let ry = 330 - h + 8; ry < 322; ry += 8) { rect(x, X + 4, ry, w - 8, 5, '#18181c'); for (let k = 0; k < 6; k++) if (hash2(k, ry + cx, 3) > .55) rect(x, X + 6 + k * 5, ry + 1, 2, 2, theme === 'root' ? (hash2(k, ry, 4) > .5 ? C.green : C.dimGreen) : (hash2(k, ry, 4) > .93 ? C.red : '#3d3d45')); } }); }
      // hanging cables
      for (let i = 0; i < 18; i++) { const sx = Math.floor(r() * BW), sag = 20 + Math.floor(r() * 50), len = 80 + Math.floor(r() * 120);
        wrapDraw(x, ox => { for (let k = 0; k <= len; k += 2) px(x, sx + ox + k, 8 + Math.sin(k / len * Math.PI) * sag, '#0a0a0c'), px(x, sx + ox + k, 9 + Math.sin(k / len * Math.PI) * sag, C.steel3); }); }
      rect(x, 0, 330, BW, 30, '#0a0a0c');
    }
    layers.push({ canvas: c, factor: 0.32, y: 0 }); }
  // ---- near ----
  { const [c, x] = canvas(BW, 360);
    for (let i = 0; i < 5; i++) { const cx = Math.floor(i * BW / 5 + r() * 60), w = 14 + Math.floor(r() * 14);
      wrapDraw(x, ox => { rect(x, cx + ox, 0, w, 360, theme === 'exception' ? '#080406' : '#070708'); rect(x, cx + ox + w - 2, 0, 2, 360, theme === 'exception' ? C.darkRed : C.steel3); rect(x, cx + ox, 0, 1, 360, C.steel3);
        for (let k = 30; k < 340; k += 40 + Math.floor(r() * 20)) rect(x, cx + ox - 4, k, w + 8, 4, '#0b0b0d'); }); }
    layers.push({ canvas: c, factor: 0.6, y: 0 }); }
  return layers;
}
export const BG_HEIGHT = VIEW_H;
export { disc };
