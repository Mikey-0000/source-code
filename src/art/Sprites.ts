// Original pixel-art, generated procedurally at start-up from deterministic pose data.
// Every sprite is authored here (no external assets). See ASSET_MANIFEST.md.
import { C } from './Palette';
import { canvas, disc, flipH, line, outline, px, rect, type Ctx } from './Painter';
import { hash2, rng } from '../core/Util';

export const NULL_W = 32, NULL_H = 40;
export type NullAnim = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'damage' | 'death';
export const NULL_FRAMES: Record<NullAnim, number> = { idle: 4, run: 6, jump: 2, fall: 2, land: 2, damage: 2, death: 6 };
export const NULL_FPS: Record<NullAnim, number> = { idle: 4, run: 12, jump: 6, fall: 6, land: 12, damage: 8, death: 8 };

interface Pose { hip: [number, number]; sh: [number, number]; head: [number, number]; armF: [number, number, number, number]; armB: [number, number, number, number]; legF: [number, number, number, number]; legB: [number, number, number, number]; glitch?: number; fade?: number; tilt?: number }

function poseFor(anim: NullAnim, i: number): Pose {
  const fx = 16, fy = 38;
  if (anim === 'idle') {
    const b = [0, 0, 1, 1][i];
    return { hip: [fx, fy - 15], sh: [fx, fy - 27 + b], head: [fx + 1, fy - 32 + b], armF: [fx + 3, fy - 20, fx + 3, fy - 13 + b], armB: [fx - 3, fy - 20, fx - 4, fy - 13 + b], legF: [fx + 2, fy - 8, fx + 3, fy], legB: [fx - 2, fy - 8, fx - 3, fy], glitch: i === 3 ? 1 : 0 };
  }
  if (anim === 'run') {
    const ph = (i / 6) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph), bob = Math.abs(Math.sin(ph)) * 2;
    return { hip: [fx - 1, fy - 15 - bob], sh: [fx + 2, fy - 27 - bob], head: [fx + 4, fy - 32 - bob], armF: [fx + 4 - s * 5, fy - 21 - bob, fx + 5 - s * 8, fy - 15 - bob + Math.abs(c) * 2], armB: [fx + 1 + s * 5, fy - 21 - bob, fx + s * 8, fy - 15 - bob + Math.abs(c) * 2], legF: [fx + s * 6, fy - 8 - bob * .3, fx - 1 + s * 9, fy - Math.max(0, -c) * 4], legB: [fx - s * 6, fy - 8 - bob * .3, fx - 1 - s * 9, fy - Math.max(0, c) * 4], glitch: i % 3 === 2 ? 1 : 0 };
  }
  if (anim === 'jump') return { hip: [fx, fy - 17], sh: [fx + 1, fy - 29], head: [fx + 2, fy - 34], armF: [fx + 4, fy - 27, fx + 7, fy - 33 + i * 2], armB: [fx - 3, fy - 27, fx - 6, fy - 32 + i * 2], legF: [fx + 4, fy - 11, fx + 2, fy - 4], legB: [fx - 3, fy - 10, fx - 6, fy - 5 + i], glitch: i };
  if (anim === 'fall') return { hip: [fx, fy - 17], sh: [fx, fy - 29], head: [fx, fy - 34 - i], armF: [fx + 5, fy - 26, fx + 9, fy - 30 - i * 2], armB: [fx - 5, fy - 26, fx - 9, fy - 30 - i * 2], legF: [fx + 3, fy - 9, fx + 4, fy - 1 - i], legB: [fx - 3, fy - 9, fx - 4, fy - 2 + i], glitch: 1 };
  if (anim === 'land') { const q = i === 0 ? 5 : 2; return { hip: [fx, fy - 11 + 0], sh: [fx + 2, fy - 20 + (q - 2) / 2], head: [fx + 4, fy - 25 + (q - 2) / 2], armF: [fx + 5, fy - 15, fx + 8, fy - 9], armB: [fx - 3, fy - 15, fx - 7, fy - 9], legF: [fx + 6, fy - 5, fx + 5, fy], legB: [fx - 6, fy - 5, fx - 5, fy], glitch: i === 0 ? 1 : 0 }; }
  if (anim === 'damage') return { hip: [fx - 1, fy - 15], sh: [fx - 4, fy - 26], head: [fx - 6, fy - 31], armF: [fx + 1, fy - 22, fx + 7, fy - 28 + i * 3], armB: [fx - 7, fy - 22, fx - 11, fy - 26 - i * 2], legF: [fx + 3, fy - 8, fx + 6, fy - 1], legB: [fx - 2, fy - 8, fx - 6, fy], glitch: 2 };
  // death: collapse and dissolve
  const k = i / 5;
  return { hip: [fx, fy - 15 + k * 11], sh: [fx - 3 - k * 6, fy - 26 + k * 18], head: [fx - 6 - k * 9, fy - 31 + k * 25], armF: [fx - 2, fy - 22 + k * 15, fx + 5 - k * 3, fy - 15 + k * 21], armB: [fx - 6 - k * 4, fy - 22 + k * 15, fx - 10 - k * 8, fy - 14 + k * 22], legF: [fx + 3 + k * 4, fy - 8 + k * 4, fx + 6 + k * 9, fy - k * 2], legB: [fx - 2 + k * 3, fy - 8 + k * 4, fx - 5 + k * 6, fy], glitch: 2, fade: k, tilt: k };
}

function drawNullFrame(ctx: Ctx, anim: NullAnim, i: number) {
  const p = poseFor(anim, i);
  const body = C.void, shade = C.ink;
  // limbs behind body first
  line(ctx, p.legB[0], p.legB[1], p.legB[2], p.legB[3], 4, shade);
  line(ctx, p.hip[0], p.hip[1], p.legB[0], p.legB[1], 4, shade);
  line(ctx, p.sh[0], p.sh[1] + 1, p.armB[0], p.armB[1], 3, shade);
  line(ctx, p.armB[0], p.armB[1], p.armB[2], p.armB[3], 3, shade);
  // torso (tapered): wide shoulders, narrow waist
  line(ctx, p.hip[0], p.hip[1], p.sh[0], p.sh[1], 8, body);
  line(ctx, p.sh[0], p.sh[1], p.sh[0], p.sh[1] + 1, 10, body);
  line(ctx, p.hip[0], p.hip[1] + 1, p.hip[0], p.hip[1] + 2, 6, body);
  // head: oval, faceless
  disc(ctx, p.head[0], p.head[1], 5, 6, body);
  line(ctx, p.head[0], p.head[1] + 5, p.sh[0], p.sh[1] - 1, 3, body);
  // front limbs
  line(ctx, p.hip[0], p.hip[1], p.legF[0], p.legF[1], 4, body);
  line(ctx, p.legF[0], p.legF[1], p.legF[2], p.legF[3], 4, body);
  line(ctx, p.sh[0], p.sh[1] + 1, p.armF[0], p.armF[1], 3, body);
  line(ctx, p.armF[0], p.armF[1], p.armF[2], p.armF[3], 3, body);
  // inner shading (broken ink stripe along torso)
  for (let y = 0; y < 12; y++) if (hash2(y, i, 3) > 0.35) px(ctx, p.sh[0] - 1 + (y % 2), p.sh[1] + 3 + y, shade);
  outline(ctx, NULL_W, NULL_H, [229, 229, 229], 6, i + 1);
  // fractured outline: extra interior cracks
  const r = rng(i * 17 + anim.length);
  for (let k = 0; k < 6; k++) { const x = p.sh[0] - 4 + Math.floor(r() * 8), y = p.sh[1] + Math.floor(r() * 16); px(ctx, x, y, r() > 0.5 ? C.steel : C.steel2); }
  // single crimson eye (the only face)
  const ex = p.head[0] + 2, ey = p.head[1] - 1;
  rect(ctx, ex - 1, ey, 4, 2, C.red); px(ctx, ex, ey - 1, C.dimRed); px(ctx, ex + 3, ey - 1, C.dimRed); px(ctx, ex + 1, ey, '#ffd0d6');
  // glitch fragments + row displacement
  const g = p.glitch ?? 0;
  if (g) {
    const img = ctx.getImageData(0, 0, NULL_W, NULL_H); const off = ctx.createImageData(NULL_W, NULL_H); off.data.set(img.data);
    const rr = rng(i * 31 + 7 + anim.charCodeAt(0));
    for (let n = 0; n < g * 2; n++) { const y0 = Math.floor(rr() * (NULL_H - 6)), hgt = 1 + Math.floor(rr() * 2), dx = (rr() > .5 ? 2 : -2);
      for (let y = y0; y < y0 + hgt; y++) for (let x = 0; x < NULL_W; x++) { const sx = x - dx; const di = (y * NULL_W + x) * 4; if (sx >= 0 && sx < NULL_W) { const si = (y * NULL_W + sx) * 4; off.data[di] = img.data[si]; off.data[di + 1] = img.data[si + 1]; off.data[di + 2] = img.data[si + 2]; off.data[di + 3] = img.data[si + 3]; } else off.data[di + 3] = 0; } }
    ctx.putImageData(off, 0, 0);
    for (let n = 0; n < g * 3; n++) px(ctx, p.sh[0] - 9 + rr() * 18, p.sh[1] - 8 + rr() * 30, rr() > .6 ? C.red : C.bone);
  }
  if (p.fade) { const img = ctx.getImageData(0, 0, NULL_W, NULL_H); for (let y = 0; y < NULL_H; y++) for (let x = 0; x < NULL_W; x++) if (hash2(x, y, i) < p.fade * .85) img.data[(y * NULL_W + x) * 4 + 3] = 0; ctx.putImageData(img, 0, 0); }
}

export interface Sheet { frames: HTMLCanvasElement[]; fps: number }
export type NullSheets = Record<NullAnim, Sheet>;
export function buildNullSheets(): { right: NullSheets; left: NullSheets } {
  const right = {} as NullSheets, left = {} as NullSheets;
  (Object.keys(NULL_FRAMES) as NullAnim[]).forEach(a => {
    right[a] = { frames: [], fps: NULL_FPS[a] }; left[a] = { frames: [], fps: NULL_FPS[a] };
    for (let i = 0; i < NULL_FRAMES[a]; i++) { const [c, x] = canvas(NULL_W, NULL_H); drawNullFrame(x, a, i); right[a].frames.push(c); left[a].frames.push(flipH(c)); }
  });
  return { right, left };
}

// ---------- ECHO ----------
export function buildEcho(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) {
    const [c, x] = canvas(32, 40); const r = rng(40 + f);
    const bob = [0, 1, 1, 0][f];
    // hair: long fragmented strands behind head
    for (let s = 0; s < 7; s++) { let hx = 12 + s, hy = 9 + bob; for (let k = 0; k < 20; k++) { hx += Math.sin((k + f * 2 + s) * .5) * .8 - (s - 3) * .06; hy += 1.05; if (hash2(s, k, 5) > 0.22) px(x, hx, hy, k < 8 ? C.bone : C.mid); } }
    disc(x, 16, 11 + bob, 5, 6, '#c9c9d0'); disc(x, 16, 11 + bob, 4, 5, C.bone);
    // gown torso fading into pixels
    for (let y = 0; y < 22; y++) { const w = 4 + y * .45; for (let xx = -w; xx <= w; xx++) { const keep = hash2(xx + 20, y + f * 3, 9) > (y / 22) * 0.9; if (keep) px(x, 16 + xx + Math.sin(y * .3 + f) * 1.2, 17 + bob + y, y > 14 ? C.mid : (y % 5 === 0 ? '#c9c9d0' : C.bone)); } }
    // arms hanging
    line(x, 12, 19 + bob, 10, 28 + bob, 2, C.mid); line(x, 20, 19 + bob, 22, 28 + bob, 2, C.mid);
    // missing pixels / tear
    for (let k = 0; k < 14; k++) { const i = x.getImageData(0, 0, 32, 40); const xx = Math.floor(r() * 32), yy = Math.floor(r() * 40); i.data[(yy * 32 + xx) * 4 + 3] = 0; x.putImageData(i, 0, 0); }
    rect(x, 17, 11 + bob, 2, 1, C.red); px(x, 18, 12 + bob, C.dimRed); px(x, 18, 13 + bob, C.dimRed);
    outline(x, 32, 40, [140, 140, 150], 3, f);
    out.push(c);
  }
  return out;
}

// ---------- DAEMON ----------
export function buildDaemon(): { calm: HTMLCanvasElement[]; hostile: HTMLCanvasElement[] } {
  const mk = (hostile: boolean) => {
    const frames: HTMLCanvasElement[] = [];
    for (let f = 0; f < 4; f++) {
      const [c, x] = canvas(32, 32);
      const hov = [0, 1, 1, 0][f];
      // hover jets
      rect(x, 8, 28 - hov, 16, 2, hostile ? C.dimRed : C.steel2);
      for (let i = 0; i < 3; i++) px(x, 10 + i * 6, 30 - hov + (f + i) % 2, hostile ? C.red : C.dimGreen);
      // chassis
      rect(x, 6, 10 - hov, 20, 16, C.ink); rect(x, 5, 12 - hov, 22, 12, C.void); rect(x, 7, 8 - hov, 18, 3, C.steel);
      rect(x, 4, 14 - hov, 2, 8, C.steel2); rect(x, 26, 14 - hov, 2, 8, C.steel2);
      // vents
      for (let i = 0; i < 4; i++) rect(x, 8 + i * 4, 22 - hov, 2, 2, C.steel);
      // visor eye (scans)
      const sx = [0, 2, 4, 2][f];
      rect(x, 8, 14 - hov, 16, 5, '#000'); rect(x, 8 + sx, 15 - hov, 5, 3, hostile ? C.red : C.dimGreen); px(x, 10 + sx, 15 - hov, hostile ? '#ffd0d6' : C.green);
      // antenna
      line(x, 16, 7 - hov, 16, 2 - hov, 1, C.steel2); px(x, 16, 1 - hov, f % 2 ? (hostile ? C.red : C.green) : C.steel);
      if (hostile) { rect(x, 6, 8 - hov, 3, 2, C.red); rect(x, 23, 8 - hov, 3, 2, C.red); }
      outline(x, 32, 32, hostile ? [255, 38, 61] : [229, 229, 229], hostile ? 0 : 4, f);
      frames.push(c);
    }
    return frames;
  };
  return { calm: mk(false), hostile: mk(true) };
}

// ---------- props (static frames) ----------
export function buildTerminal(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) {
    const [c, x] = canvas(32, 32);
    rect(x, 4, 8, 24, 22, C.steel); rect(x, 5, 9, 22, 20, C.ink); rect(x, 7, 11, 18, 13, '#021a0d');
    for (let l = 0; l < 4; l++) { const w = 4 + Math.floor(hash2(l, f, 2) * 11); rect(x, 8, 13 + l * 3, w, 1, l === 3 && f % 2 ? C.green : C.dimGreen); }
    if (f % 2) rect(x, 8 + 10, 22, 2, 1, C.green);
    rect(x, 10, 26, 12, 2, C.steel3); rect(x, 6, 30, 20, 2, C.steel); rect(x, 14, 24, 4, 3, C.steel2);
    px(x, 24, 9, f === 1 ? C.green : C.dimGreen); px(x, 5, 9, f === 3 ? C.red : C.darkRed);
    outline(x, 32, 32, [229, 229, 229], 5, f); out.push(c);
  }
  return out;
}
export function buildCheckpoint(): HTMLCanvasElement[] {
  const mk = (on: boolean, f: number) => {
    const [c, x] = canvas(32, 48);
    rect(x, 12, 14, 8, 32, C.steel); rect(x, 13, 14, 6, 32, C.ink); rect(x, 8, 44, 16, 4, C.steel2); rect(x, 10, 42, 12, 2, C.steel);
    rect(x, 11, 6, 10, 10, C.void); rect(x, 12, 7, 8, 8, on ? (f % 2 ? C.green : '#3ddf80') : C.darkRed);
    if (on) { for (let i = 0; i < 5; i++) px(x, 10 + hash2(i, f, 4) * 12, 3 - hash2(i, f, 5) * 3, C.green); rect(x, 15, 22, 2, 8, C.dimGreen); }
    outline(x, 32, 48, [229, 229, 229], 4, 1); return c;
  };
  return [mk(false, 0), mk(true, 0), mk(true, 1)];
}
export function buildSpike(): HTMLCanvasElement {
  const [c, x] = canvas(32, 32);
  for (let i = 0; i < 4; i++) { for (let y = 0; y < 14; y++) { const w = Math.floor((14 - y) / 14 * 4) + (y > 12 ? 0 : 0); rect(x, i * 8 + 4 - w, 18 + y, w * 2, 1, y < 3 ? C.bone : (y < 9 ? C.steel2 : C.steel)); } px(x, i * 8 + 4, 17, C.red); px(x, i * 8 + 4, 18, C.red); }
  rect(x, 0, 30, 32, 2, C.steel3); outline(x, 32, 32, [180, 20, 40], 3, 3); return c;
}
export function buildPlatform(w: number, kind: 'solid' | 'broken' | 'moving' | 'ghost'): HTMLCanvasElement {
  const W = w * 32, [c, x] = canvas(W, 12);
  if (kind === 'ghost') {
    for (let i = 0; i < W; i += 4) { rect(x, i, 0, 2, 1, C.red); rect(x, i + 2, 11, 2, 1, C.red); }
    for (let i = 0; i < 12; i += 4) { rect(x, 0, i, 1, 2, C.red); rect(x, W - 1, i, 1, 2, C.red); }
    for (let i = 4; i < W - 4; i += 8) rect(x, i, 5, 4, 1, C.darkRed);
    return c;
  }
  rect(x, 0, 0, W, 12, kind === 'moving' ? C.steel2 : C.steel); rect(x, 0, 0, W, 2, C.bone); rect(x, 0, 2, W, 1, C.steel2); rect(x, 0, 9, W, 3, C.ink);
  for (let i = 3; i < W - 3; i += 8) { rect(x, i, 4, 4, 4, C.void); if (kind === 'moving') rect(x, i + 1, 5, 2, 2, (i / 8) % 2 ? C.green : C.dimGreen); }
  if (kind === 'broken') { const r = rng(W); for (let i = 0; i < W / 4; i++) { const cx = Math.floor(r() * W), cy = Math.floor(r() * 12); px(x, cx, cy, '#00000000'); x.clearRect(cx, cy, 2, 1 + Math.floor(r() * 3)); } rect(x, 0, 0, W, 1, C.red); }
  outline(x, W, 12, [229, 229, 229], 9, 5); return c;
}
export function buildCamera(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 3; f++) { const [c, x] = canvas(24, 16); rect(x, 0, 0, 6, 4, C.steel); rect(x, 6, 4, 14, 8, C.ink); rect(x, 5, 5, 16, 6, C.void); rect(x, 17, 6, 4, 4, f === 1 ? '#ffd0d6' : C.red); rect(x, 8, 6, 6, 1, C.steel2); outline(x, 24, 16, [229, 229, 229], 4, f); out.push(c); }
  return out;
}
export function buildMonitor(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) { const [c, x] = canvas(32, 28); rect(x, 1, 1, 30, 22, C.steel); rect(x, 3, 3, 26, 17, '#0b0b0d');
    const r = rng(f + 100); for (let i = 0; i < 70; i++) px(x, 3 + Math.floor(r() * 26), 3 + Math.floor(r() * 17), r() > .7 ? C.bone : (r() > .85 ? C.red : C.steel2));
    rect(x, 12, 23, 8, 3, C.steel3); rect(x, 8, 26, 16, 2, C.steel); outline(x, 32, 28, [160, 160, 170], 4, f); out.push(c); }
  return out;
}
export function buildExit(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) { const [c, x] = canvas(32, 64);
    rect(x, 2, 2, 28, 4, C.steel); rect(x, 2, 2, 4, 60, C.steel); rect(x, 26, 2, 4, 60, C.steel); rect(x, 4, 4, 2, 58, C.bone);
    for (let y = 8; y < 62; y += 2) { const w = 6 + Math.sin((y + f * 6) * .35) * 4; rect(x, 16 - w, y, w * 2, 2, (y / 2 + f) % 3 ? C.dimGreen : C.green); }
    rect(x, 6, 60, 20, 2, C.green); outline(x, 32, 64, [83, 255, 154], 5, f); out.push(c); }
  return out;
}
export function buildBackdropScanline(): HTMLCanvasElement { const [c, x] = canvas(4, 4); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 2, 4, 1); return c; }

/** Giant animated ADMIN / WATCHER eye. t = seconds; look = pupil offset in [-1,1]; open 0..1. */
export function drawEye(ctx: Ctx, cx: number, cy: number, R: number, t: number, look: [number, number], open = 1, glitch = 0) {
  const ry = Math.max(1, Math.round(R * 0.62 * open));
  // outer fractured geometry
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + t * .1; const d = R * (1.25 + 0.25 * hash2(i, 1)); const w = R * 0.25, h = R * (0.1 + 0.2 * hash2(i, 2));
    ctx.save(); ctx.translate(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * .7)); ctx.rotate(Math.round(a * 4) / 4); ctx.fillStyle = i % 3 ? C.ink : C.steel; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = C.void; ctx.fillRect(-w / 2, -h / 2, w, 2); ctx.restore(); }
  disc(ctx, cx, cy, R + 3, ry + 3, C.bone); disc(ctx, cx, cy, R + 1, ry + 1, C.void); disc(ctx, cx, cy, R - 1, Math.max(1, ry - 1), '#1a0508');
  // sclera glow rings
  for (let k = 3; k >= 0; k--) disc(ctx, cx, cy, Math.round((R - 4) * (0.45 + k * .14)), Math.max(1, Math.round(ry * (0.45 + k * .14))), k % 2 ? C.dimRed : C.darkRed);
  const px_ = Math.round(cx + look[0] * R * 0.38), py_ = Math.round(cy + look[1] * ry * 0.35);
  disc(ctx, px_, py_, Math.round(R * .36), Math.max(1, Math.round(R * .36 * Math.min(1, open * 1.4))), C.red);
  disc(ctx, px_, py_, Math.round(R * .22), Math.max(1, Math.round(R * .22 * Math.min(1, open * 1.4))), C.void);
  const p2 = 0.6 + 0.4 * Math.sin(t * 3); disc(ctx, px_ - Math.round(R * .1), py_ - Math.round(R * .1), Math.max(1, Math.round(R * .06 * p2)), Math.max(1, Math.round(R * .06 * p2)), '#ffd0d6');
  // iris veins
  ctx.fillStyle = C.red; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + Math.sin(t + i) * .05; const r0 = R * .4, r1 = R * (.7 + .1 * Math.sin(t * 2 + i)); ctx.fillRect(Math.round(px_ + Math.cos(a) * r0), Math.round(py_ + Math.sin(a) * r0 * .7), 1, Math.max(1, Math.round((r1 - r0) / 6))); }
  if (glitch > 0) { const r = rng(Math.floor(t * 12)); for (let i = 0; i < glitch * 5; i++) { const y = Math.round(cy - ry + r() * ry * 2), dx = Math.round((r() - .5) * 18); ctx.drawImage(ctx.canvas, cx - R, y, R * 2, 2, cx - R + dx, y, R * 2, 2); } }
}
