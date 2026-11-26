// Atmosphere & screen effects: code rain, light shafts, fog, the ADMIN eye, shockwaves, floating debris, tinted sprites.
import { VIEW_H, VIEW_W } from '../art/Palette';
import { hash2 } from '../core/Util';
import { settings } from '../core/Settings';

type Ctx = CanvasRenderingContext2D;
const mk = (w: number, h: number): [HTMLCanvasElement, Ctx] => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!]; };

export interface ThemeTint { rgb: string; accent: string }
export const TINTS: Record<string, ThemeTint> = {
  boot: { rgb: '110,190,255', accent: '#6ae6ff' },
  exception: { rgb: '255,70,90', accent: '#ff5a6e' },
  root: { rgb: '80,255,150', accent: '#53ff9a' },
};
const tintOf = (theme: string) => TINTS[theme] ?? TINTS.boot;

// ───────── tinted silhouettes (rim light, trail, ghost) ─────────
const tintCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
export function tinted(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  let m = tintCache.get(src); if (!m) { m = new Map(); tintCache.set(src, m); }
  let c = m.get(color); if (c) return c;
  const [cv, x] = mk(src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, src.width, src.height); m.set(color, cv); return cv;
}

// ───────── cached layers ─────────
const fogCache = new Map<string, HTMLCanvasElement>();
function fogFor(theme: string): HTMLCanvasElement {
  let c = fogCache.get(theme); if (c) return c;
  const [cv, x] = mk(512, 96); const t = tintOf(theme);
  for (let i = 0; i < 30; i++) {
    const bx = hash2(i, 1, 11) * 512, by = 30 + hash2(i, 2, 11) * 56, r = 26 + hash2(i, 3, 11) * 44;
    for (const ox of [-512, 0, 512]) { const g = x.createRadialGradient(bx + ox, by, 0, bx + ox, by, r); g.addColorStop(0, `rgba(${t.rgb},0.22)`); g.addColorStop(1, `rgba(${t.rgb},0)`); x.fillStyle = g; x.fillRect(bx + ox - r, by - r, r * 2, r * 2); }
  }
  fogCache.set(theme, cv); return cv;
}
const rainCache = new Map<string, HTMLCanvasElement>();
function rainFor(theme: string): HTMLCanvasElement {
  let c = rainCache.get(theme); if (c) return c;
  const [cv, x] = mk(160, 256); const t = tintOf(theme);
  for (let col = 0; col < 20; col++) {
    const cx = col * 8 + 2; let y = hash2(col, 5, 3) * 256; const n = 3 + Math.floor(hash2(col, 6, 3) * 5);
    for (let k = 0; k < n; k++) { const len = 4 + Math.floor(hash2(col, k, 7) * 22); for (let j = 0; j < len; j += 2) { const a = (1 - j / len) * 0.55; x.fillStyle = `rgba(${t.rgb},${a})`; x.fillRect(cx, (y + j) % 256, 2, 1); } y += len + 14 + hash2(col, k, 9) * 50; }
  }
  rainCache.set(theme, cv); return cv;
}

export interface Ring { x: number; y: number; age: number; max: number; col: string; delay: number }

export class Fx {
  rings: Ring[] = [];
  private debris: { x: number; y: number; s: number; ph: number }[] = [];
  private debrisAmt = 0; private blinkT = 0; private tmp: [HTMLCanvasElement, Ctx] | null = null;

  /** Falling glyph columns behind the tiles. */
  drawRain(ctx: Ctx, cx: number, cy: number, t: number, theme: string, stage: number) {
    const rain = rainFor(theme); ctx.globalAlpha = 0.42 + stage * 0.1;
    const off = Math.floor((t * (stage >= 2 ? 52 : 26)) % 256), px = -Math.floor((cx * 0.35) % 160);
    for (let x = px - 160; x < VIEW_W + 160; x += 160) for (let y = -256; y < VIEW_H + 256; y += 256) ctx.drawImage(rain, x, y + off - Math.floor((cy * 0.2) % 256));
    ctx.globalAlpha = 1;
  }

  /** The huge eye of ADMIN in the far background: tracks the player, dilates when code is compiled. */
  drawAdminEye(ctx: Ctx, t: number, targetX: number, targetY: number, stage: number, dilate: number, theme: string) {
    const ex = VIEW_W * 0.74, ey = 70; const col = tintOf(theme === 'boot' ? 'exception' : theme).accent;
    const blink = Math.max(0, Math.sin(t * 0.5 + 1.3) - 0.985) * 66; const open = Math.max(0.06, 1 - blink);
    const lx = Math.max(-1, Math.min(1, (targetX - ex) / 240)), ly = Math.max(-1, Math.min(1, (targetY - ey) / 160));
    const a = 0.24 + stage * 0.16 + dilate * 0.3; ctx.save(); ctx.globalAlpha = Math.min(0.75, a);
    ctx.fillStyle = '#080204'; ctx.beginPath(); ctx.ellipse(ex, ey, 62, 24 * open, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex, ey, 62, 24 * open, 0, 0, Math.PI * 2); ctx.clip();
    const ix = ex + lx * 16, iy = ey + ly * 6; for (let r = 19; r > 4; r -= 3) { ctx.fillStyle = r % 6 === 1 ? '#ff263d' : '#7a1020'; ctx.beginPath(); ctx.ellipse(ix, iy, r, r * open * 1.05, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#000'; const pr = 3.5 + dilate * 6 + stage; ctx.beginPath(); ctx.ellipse(ix, iy, pr, pr * open * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(Math.round(ix - pr * 0.6), Math.round(iy - pr * 0.6), 2, 2);
    ctx.restore();
  }

  /** Slanted beams of light from the ceiling. */
  drawShafts(ctx: Ctx, cx: number, t: number, theme: string) {
    const tn = tintOf(theme); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const base = ((i * 197 + 40 - cx * 0.55) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100; const sway = Math.sin(t * 0.3 + i * 1.7) * 14; const w = 26 + (i % 2) * 14;
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H * 0.9); g.addColorStop(0, `rgba(${tn.rgb},0.16)`); g.addColorStop(1, `rgba(${tn.rgb},0)`); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(base + sway, 0); ctx.lineTo(base + sway + w, 0); ctx.lineTo(base + sway + w + 90, VIEW_H * 0.9); ctx.lineTo(base + sway + 40, VIEW_H * 0.9); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawFog(ctx: Ctx, cx: number, t: number, theme: string) {
    const f = fogFor(theme);
    for (const [y, sp, par, al] of [[VIEW_H - 92, 7, 0.45, 0.8], [VIEW_H - 62, -11, 0.7, 0.65]] as const) {
      const off = ((t * sp + cx * par) % 512 + 512) % 512; ctx.globalAlpha = al; for (let x = -off; x < VIEW_W; x += 512) ctx.drawImage(f, Math.round(x), Math.round(y + Math.sin(t * 0.4 + sp) * 3));
    }
    ctx.globalAlpha = 1;
  }

  /** Debris that floats up in low gravity and rains down in high gravity. */
  drawDebris(ctx: Ctx, gravity: number, t: number, dt: number) {
    const dev = gravity - 0.8; const want = Math.min(1, Math.abs(dev) / 0.35);
    this.debrisAmt += (want - this.debrisAmt) * 0.04; if (this.debrisAmt < 0.02) return;
    while (this.debris.length < 70) this.debris.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 2 + Math.floor(Math.random() * 3), ph: Math.random() * 6 });
    const vy = dev < 0 ? dev * 1.6 : dev * 2.4 + 0.2; ctx.fillStyle = '#e5e5e5';
    for (const d of this.debris) {
      d.y += vy * dt * 60 * (0.6 + d.s * 0.3); d.x += Math.sin(t * 1.3 + d.ph) * 0.25; if (d.y < -6) d.y = VIEW_H + 4; if (d.y > VIEW_H + 6) d.y = -4; if (d.x < -4) d.x = VIEW_W; if (d.x > VIEW_W + 4) d.x = -4;
      ctx.globalAlpha = 0.85 * this.debrisAmt; ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  ring(x: number, y: number, col = '#53ff9a', delay = 0, max = 34) { this.rings.push({ x, y, age: -delay, max, col, delay }); }
  drawRings(ctx: Ctx, cx: number, cy: number) {
    for (const r of this.rings) {
      r.age++; if (r.age <= 0) continue; const k = r.age / r.max; if (k >= 1) continue; const rad = 6 + k * k * 0 + k * 190;
      ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = r.col; ctx.lineWidth = 2 - k; ctx.beginPath(); ctx.arc(Math.round(r.x - cx), Math.round(r.y - cy), rad, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.25; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.globalAlpha = 1; this.rings = this.rings.filter(r => r.age < r.max);
  }

  /** "Reality rewrite": mosaic bands + displaced slices + coloured scanline bars. k runs 1 → 0. */
  drawRewrite(ctx: Ctx, k: number, t: number) {
    if (k <= 0 || settings.reducedMotion) return;
    if (!this.tmp) this.tmp = mk(VIEW_W / 8, VIEW_H / 8); const [tc, tx] = this.tmp;
    tx.imageSmoothingEnabled = true; tx.drawImage(ctx.canvas, 0, 0, tc.width, tc.height);
    const f = Math.floor(t * 20);
    for (let y = 0; y < VIEW_H; y += 12) {
      const h = hash2(y, f, 5); if (h > 0.35 + (1 - k) * 0.5) continue;
      ctx.imageSmoothingEnabled = false; ctx.globalAlpha = Math.min(1, k * 1.2); ctx.drawImage(tc, 0, y / 8, tc.width, 1.5, Math.round((hash2(y, f, 6) - 0.5) * 30 * k), y, VIEW_W, 12);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { const y = Math.floor(hash2(f, i, 8) * VIEW_H); ctx.fillStyle = i % 2 ? `rgba(83,255,154,${0.5 * k})` : `rgba(255,38,61,${0.45 * k})`; ctx.fillRect(0, y, VIEW_W, 1 + (i % 3)); }
    ctx.imageSmoothingEnabled = false;
  }
}
