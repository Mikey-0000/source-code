import { assets, type AssetSet } from '../../art/Assets';
import { buildBackground, renderTileLayer, type BgLayer } from '../../art/Environment';
import { drawEye, NULL_FRAMES, NULL_H, NULL_W, type NullAnim } from '../../art/Sprites';
import { C, TILE, VIEW_H, VIEW_W } from '../../art/Palette';
import { canvas, disc, px, rect, type Ctx } from '../../art/Painter';
import { hash2 } from '../../core/Util';
import { settings } from '../../core/Settings';
import { PHYS } from '../physics/Physics';
import { Particles } from '../../effects/Particles';
import { Fx, tinted, TINTS } from '../../effects/Fx';
import type { LevelDef } from '../levels/LevelTypes';
import type { World } from './World';

export interface DrawOpts { debug: boolean; editing: boolean; stage: number; arc: [number, number][] | null; selected: string | null; time: number; paused: boolean; dilate?: number; ghost?: { x: number; y: number; f: number; vx: number; air: boolean } | null }
export interface Cam { x: number; y: number }

export class Renderer {
  A: AssetSet = assets(); tiles!: HTMLCanvasElement; bg: BgLayer[] = []; level!: LevelDef; light: HTMLCanvasElement; lctx: Ctx; particles = new Particles(); fx = new Fx(); rewriteT = 0; private sq = 0; private prevVy = 0; private trail: { x: number; y: number; w: number; h: number; spr: HTMLCanvasElement }[] = [];
  private animT = 0; private animKey = ''; private doorAmt = new Map<string, number>(); private lastTick = -1; ghostT = 0;
  constructor() { const [c, x] = canvas(VIEW_W, VIEW_H); this.light = c; this.lctx = x; }
  setLevel(level: LevelDef) { this.level = level; this.tiles = renderTileLayer(level.grid, level.theme); this.bg = buildBackground(level.theme); this.doorAmt.clear(); this.particles.list = []; }

  draw(ctx: Ctx, w: World, cam: Cam, o: DrawOpts) {
    const cx = Math.round(cam.x), cy = Math.round(cam.y); const t = o.time; const theme = this.level.theme;
    ctx.imageSmoothingEnabled = false;
    // background
    ctx.fillStyle = theme === 'exception' ? '#0b0405' : theme === 'root' ? '#050806' : '#060607'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const l of this.bg) { const off = -Math.round((cx * l.factor) % 1024); const yy = Math.round(-cy * l.factor * 0.35 - 20 * (1 - l.factor)); for (let k = -1; k <= 1; k++) ctx.drawImage(l.canvas, off + k * 1024, yy); }
    this.fx.drawAdminEye(ctx, t, w.x - cx, w.y - cy, o.stage, o.dilate ?? 0, theme);
    this.fx.drawRain(ctx, cx, cy, t, theme, o.stage);
    // tiles
    ctx.drawImage(this.tiles, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    this.drawTileGlitch(ctx, w, cx, cy, t, o.stage);
    this.drawSpikes(ctx, w, cx, cy);
    this.drawDecor(ctx, w, cx, cy, t);
    this.drawProps(ctx, w, cx, cy, t, o);
    this.drawPlatforms(ctx, w, cx, cy, t);
    this.drawDoors(ctx, w, cx, cy, t);
    this.drawLasers(ctx, w, cx, cy, t, o);
    this.drawEnemies(ctx, w, cx, cy, t);
    this.drawBoss(ctx, w, cx, cy, t, o);
    this.drawPlayer(ctx, w, cx, cy, t, o);
    this.particles.draw(ctx, cx, cy);
    this.fx.drawRings(ctx, cx, cy); this.fx.drawDebris(ctx, Number(w.rule.world?.gravity ?? 0.8), t, 1 / 60);
    this.fx.drawShafts(ctx, cx, t, theme); this.fx.drawFog(ctx, cx, t, theme);
    if (o.arc) this.drawArc(ctx, o.arc, cx, cy, t);
    if (o.editing || o.debug) this.drawExitMarker(ctx, w, cx, cy, t);
    this.drawLighting(ctx, w, cx, cy, t);
    if (o.debug) this.drawDebug(ctx, w, cx, cy, o);
    // corruption tint & slices
    if (o.stage >= 1) { ctx.fillStyle = `rgba(255,38,61,${o.stage === 1 ? 0.03 : 0.07})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (o.stage >= 2 && !settings.reducedMotion && !o.paused) { const f = Math.floor(t * 8); for (let i = 0; i < 3; i++) { const y = Math.floor(hash2(f, i, 3) * VIEW_H), h = 2 + Math.floor(hash2(f, i, 4) * 6), dx = Math.floor((hash2(f, i, 5) - 0.5) * 24); if (hash2(f, i, 6) > 0.55) ctx.drawImage(ctx.canvas, 0, y, VIEW_W, h, dx, y, VIEW_W, h); } }
    if (this.rewriteT > 0) {
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${this.rewriteT})`; const box = (r: { x: number; y: number; w: number; h: number }) => ctx.strokeRect(Math.round(r.x - cx) - 1.5, Math.round(r.y - cy) - 1.5, r.w + 3, r.h + 3);
      for (const r of w.dynamicSolids()) box(r); for (const l of this.level.lasers) box(w.laserRect(l)); for (const e of w.enemies) box(w.enemyRect(e));
      this.fx.drawRewrite(ctx, this.rewriteT, t); this.rewriteT = Math.max(0, this.rewriteT - 1 / 36);
    }
  }
  /** Call when new rules are applied: shockwave from NULL, glitch mosaic, snap-flash of everything the rules can change. */
  rewrite(x: number, y: number) { this.rewriteT = 1; this.fx.ring(x, y, '#53ff9a', 0); this.fx.ring(x, y, '#ff263d', 6, 40); this.fx.ring(x, y, '#e5e5e5', 12, 46); this.particles.emit(x, y, 50, { col: ['#53ff9a', '#e5e5e5', '#ff263d'], speed: 3, life: 34, g: 0 }); }
  private drawTileGlitch(ctx: Ctx, w: World, cx: number, cy: number, t: number, stage: number) {
    if (stage < 1 || settings.reducedMotion) return; const f = Math.floor(t * (stage >= 2 ? 9 : 5)); const thr = stage >= 2 ? 0.965 : 0.988;
    const x0 = Math.max(0, Math.floor(cx / TILE)), x1 = Math.min(w.w - 1, Math.floor((cx + VIEW_W) / TILE)), y0 = Math.max(0, Math.floor(cy / TILE)), y1 = Math.min(w.h - 1, Math.floor((cy + VIEW_H) / TILE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!w.solidTile(x, y)) continue; const h = hash2(x * 31 + y, f, 9); if (h < thr) continue;
      const dx = Math.round((hash2(x, f, 1) - 0.5) * 10), dy = Math.round((hash2(y, f, 2) - 0.5) * 6);
      ctx.drawImage(this.tiles, x * TILE, y * TILE, TILE, TILE, x * TILE - cx + dx, y * TILE - cy + dy, TILE, TILE); ctx.fillStyle = h > 0.995 ? 'rgba(255,38,61,.35)' : 'rgba(83,255,154,.14)'; ctx.fillRect(x * TILE - cx + dx, y * TILE - cy + dy, TILE, TILE);
    }
  }
  private drawGhost(ctx: Ctx, g: NonNullable<DrawOpts['ghost']>, cx: number, cy: number, t: number) {
    const sheets = g.f >= 0 ? this.A.nullR : this.A.nullL; const anim: NullAnim = g.air ? 'jump' : Math.abs(g.vx) > 0.3 ? 'run' : 'idle'; const n = NULL_FRAMES[anim]; const fr = anim === 'jump' ? 0 : Math.floor(t * (anim === 'run' ? 9 : 4)) % n;
    ctx.globalAlpha = 0.34; ctx.drawImage(tinted(sheets[anim].frames[fr], TINTS.boot.accent), Math.round(g.x + PHYS.hitW / 2 - NULL_W / 2 - cx), Math.round(g.y + PHYS.hitH - NULL_H + 2 - cy)); ctx.globalAlpha = 1;
  }

  // ---------- helpers ----------
  private vis(x: number, y: number, w: number, h: number, cx: number, cy: number) { return x + w > cx - 8 && x < cx + VIEW_W + 8 && y + h > cy - 8 && y < cy + VIEW_H + 8; }
  private drawSpikes(ctx: Ctx, w: World, cx: number, cy: number) {
    const g = this.level.grid; const x0 = Math.max(0, Math.floor(cx / TILE)), x1 = Math.min(w.w - 1, Math.floor((cx + VIEW_W) / TILE)), y0 = Math.max(0, Math.floor(cy / TILE)), y1 = Math.min(w.h - 1, Math.floor((cy + VIEW_H) / TILE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = g[y][x]; if (c === '^') ctx.drawImage(this.A.spike, x * TILE - cx, y * TILE - cy); else if (c === 'v') ctx.drawImage(this.A.spikeDown, x * TILE - cx, y * TILE - cy); }
  }
  private drawDecor(ctx: Ctx, _w: World, cx: number, cy: number, t: number) {
    for (const d of this.level.decor) {
      const x = d.x * TILE, y = d.y * TILE;
      if (d.kind === 'monitor') { if (!this.vis(x, y, 32, 32, cx, cy)) continue; const f = this.A.monitor[Math.floor(t * 6 + d.x) % 4]; ctx.drawImage(f, x - cx, y + 4 - cy); }
      else if (d.kind === 'sign') { const text = d.text ?? ''; const wpx = text.length * 5 + 10; if (!this.vis(x, y, wpx, 14, cx, cy)) continue; rect(ctx, x - cx, y - cy, wpx, 12, C.void); rect(ctx, x - cx, y - cy, wpx, 1, C.steel2); rect(ctx, x - cx, y + 11 - cy, wpx, 1, C.steel); rect(ctx, x - cx + 2, y + 2 - cy, 2, 2, hash2(d.x, d.y) > .5 ? C.red : C.dimRed);
        ctx.fillStyle = this.level.theme === 'exception' ? '#e8c9cd' : C.bone; ctx.font = 'bold 8px "Space Mono", "IBM Plex Mono", Consolas, "DejaVu Sans Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillText(text, x - cx + 7, y + 2 - cy); }
      else if (d.kind === 'cable') { const wpx = (d.w ?? 6) * TILE; if (!this.vis(x, y - 20, wpx, 60, cx, cy)) continue; for (let k = 0; k <= wpx; k += 2) { const sag = Math.sin(k / wpx * Math.PI) * 26 + Math.sin(t * 1.4 + d.x + k * .02) * 1.5; px(ctx, x + k - cx, y + sag - cy, '#0a0a0c'); px(ctx, x + k - cx, y + sag + 1 - cy, C.steel2); if (k % 24 === 0) px(ctx, x + k - cx, y + sag + 2 - cy, hash2(k, d.x) > .5 ? C.red : C.dimGreen); } }
    }
  }
  private drawProps(ctx: Ctx, w: World, cx: number, cy: number, t: number, o: DrawOpts) {
    const L = this.level;
    for (const c of L.checkpoints) { const x = c.x * TILE, y = c.y * TILE - 16; if (!this.vis(x, y, 32, 48, cx, cy)) continue; const on = w.activeCheckpoint === c.id; ctx.drawImage(this.A.checkpoint[on ? 1 + (Math.floor(t * 4) % 2) : 0], x - cx, y - cy); }
    for (const tm of L.terminals) { const x = tm.x * TILE, y = tm.y * TILE; if (!this.vis(x, y, 32, 32, cx, cy)) continue; ctx.drawImage(this.A.terminal[Math.floor(t * 3 + tm.x) % 4], x - cx, y - cy);
      if (w.nearestTerminal() === tm && !o.paused) { const b = Math.sin(t * 6) * 2; rect(ctx, x + 12 - cx, y - 10 + b - cy, 8, 7, C.void); rect(ctx, x + 13 - cx, y - 9 + b - cy, 6, 5, C.green); px(ctx, x + 15 - cx, y - 3 + b - cy, C.green); } }
    for (const m of L.memories) { if (w.collected.has(m.id)) continue; const hidden = (m.minCorruption ?? 0) > w.corruption; if (hidden) continue; const x = m.x * TILE + 16, y = m.y * TILE + 16 + Math.sin(t * 2 + m.x) * 3; if (!this.vis(x - 16, y - 16, 32, 32, cx, cy)) continue;
      const jx = hash2(Math.floor(t * 10), m.x) > .85 ? 2 : 0; const sx = x - cx + jx, sy = Math.round(y - cy);
      rect(ctx, sx - 1, sy - 8, 3, 16, C.bone); rect(ctx, sx - 5, sy - 3, 11, 6, C.bone); rect(ctx, sx - 3, sy - 6, 7, 12, C.bone); rect(ctx, sx - 1, sy - 4, 3, 8, C.void); px(ctx, sx, sy, C.red);
      for (let i = 0; i < 4; i++) px(ctx, sx + Math.cos(t * 2 + i * 1.6) * 11, sy + Math.sin(t * 2 + i * 1.6) * 9, i % 2 ? C.red : C.bone); }
    // exit
    const ex = L.exit[0] * TILE, ey = L.exit[1] * TILE - 32; if (this.vis(ex, ey, 32, 64, cx, cy)) { ctx.drawImage(this.A.exit[Math.floor(t * 8) % 4], ex - cx, ey - cy);
      if (!w.exitOpen) { for (let i = 0; i < 5; i++) rect(ctx, ex + 6 - cx, ey + 10 + i * 10 - cy, 20, 3, C.red); ctx.fillStyle = 'rgba(8,8,9,.55)'; ctx.fillRect(ex + 4 - cx, ey + 6 - cy, 24, 54); for (let i = 0; i < 5; i++) rect(ctx, ex + 5 - cx, ey + 10 + i * 10 - cy, 22, 3, C.red); } }
    // cameras
    for (const b of w.cameraBeams) { const sx = b.x - cx, sy = b.y - cy; ctx.save(); ctx.fillStyle = 'rgba(255,38,61,0.10)'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(b.a - 0.22) * 220, sy + Math.sin(b.a - 0.22) * 220); ctx.lineTo(sx + Math.cos(b.a + 0.22) * 220, sy + Math.sin(b.a + 0.22) * 220); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,38,61,0.35)'; ctx.stroke(); ctx.restore(); ctx.drawImage(this.A.camera[Math.floor(t * 2) % 3], sx - 12, sy - 8); }
  }
  private drawPlatforms(ctx: Ctx, w: World, cx: number, cy: number, t: number) {
    for (const p of w.platforms) { const ruleOn = p.def.rule ? w.r(p.def.rule, 'collision') === true : true; if (!this.vis(p.x, p.y, p.w, 12, cx, cy)) continue;
      const kind = !ruleOn ? 'ghost' : p.def.kind === 'moving' ? 'moving' : 'solid';
      if (kind === 'ghost') { if (Math.floor(t * 5 + p.x) % 11 !== 0) ctx.drawImage(this.A.platform(Math.round(p.w / 32), 'ghost'), Math.round(p.x - cx), Math.round(p.y - cy)); }
      else { ctx.drawImage(this.A.platform(Math.round(p.w / 32), kind), Math.round(p.x - cx), Math.round(p.y - cy)); if (p.def.kind === 'ghost') { ctx.fillStyle = 'rgba(83,255,154,0.25)'; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.w, 1); } } }
  }
  private drawDoors(ctx: Ctx, w: World, cx: number, cy: number, t: number) {
    for (const d of this.level.doors) { const x = d.x * TILE, y = d.y * TILE, h = d.h * TILE; if (!this.vis(x, y, 32, h, cx, cy)) continue; const locked = w.doorLocked(d.rule); let a = this.doorAmt.get(d.id) ?? (locked ? 0 : 1); a += ((locked ? 0 : 1) - a) * 0.1; this.doorAmt.set(d.id, a);
      const bodyH = Math.round(h * (1 - a * 0.92)); const sx = x - cx, sy = y - cy;
      rect(ctx, sx + 8, sy, 16, bodyH, C.steel); rect(ctx, sx + 9, sy, 14, bodyH, C.ink); for (let i = 6; i < bodyH - 4; i += 10) { rect(ctx, sx + 10, sy + i, 12, 2, C.void); rect(ctx, sx + 10, sy + i + 2, 12, 1, C.steel2); }
      rect(ctx, sx + 6, sy, 20, 4, C.steel2); rect(ctx, sx + 6, sy + h - 4, 20, 4, C.steel2); rect(ctx, sx + 4, sy - 2, 24, 3, C.bone);
      const lamp = locked ? (Math.floor(t * 3) % 2 ? C.red : C.dimRed) : C.green; rect(ctx, sx + 13, sy + Math.min(bodyH - 12, 14), 6, 6, C.void); rect(ctx, sx + 14, sy + Math.min(bodyH - 11, 15), 4, 4, lamp);
      if (locked) { for (let i = 0; i < 3; i++) rect(ctx, sx + 9, sy + 4 + i * (h / 3), 14, 2, C.red); } }
  }
  private drawLasers(ctx: Ctx, w: World, cx: number, cy: number, t: number, o: DrawOpts) {
    for (const l of this.level.lasers) { const r = w.laserRect(l); if (!this.vis(r.x - 8, r.y - 8, r.w + 16, r.h + 16, cx, cy)) continue; const on = w.laserActive(l.rule); const sx = r.x - cx, sy = r.y - cy;
      // emitters
      const e1 = l.dir === 'v' ? [sx - 4, sy - 8, 16, 8] : [sx - 8, sy - 4, 8, 16], e2 = l.dir === 'v' ? [sx - 4, sy + r.h, 16, 8] : [sx + r.w, sy - 4, 8, 16];
      for (const e of [e1, e2]) { rect(ctx, e[0], e[1], e[2], e[3], C.steel); rect(ctx, e[0] + 1, e[1] + 1, e[2] - 2, e[3] - 2, C.ink); px(ctx, e[0] + e[2] / 2, e[1] + e[3] / 2, on ? C.red : C.dimGreen); }
      if (on) { const fl = Math.floor(t * 30) % 3; ctx.fillStyle = C.red; ctx.fillRect(sx, sy, r.w, r.h); ctx.fillStyle = fl ? '#ffd0d6' : '#ffffff'; if (l.dir === 'v') ctx.fillRect(sx + 3, sy, 2, r.h); else ctx.fillRect(sx, sy + 3, r.w, 2);
        ctx.fillStyle = 'rgba(255,38,61,.25)'; if (l.dir === 'v') ctx.fillRect(sx - 4, sy, r.w + 8, r.h); else ctx.fillRect(sx, sy - 4, r.w, r.h + 8);
        if (Math.random() < 0.2 && !o.paused) this.particles.emit(r.x + r.w * Math.random(), r.y + r.h * Math.random(), 1, { col: [C.red, '#ffd0d6'], speed: .7, life: 14, g: 0 }); }
      else { ctx.fillStyle = C.dimGreen; for (let i = 0; i < (l.dir === 'v' ? r.h : r.w); i += 8) { if (l.dir === 'v') ctx.fillRect(sx + 3, sy + i, 2, 2); else ctx.fillRect(sx + i, sy + 3, 2, 2); } } }
  }
  private drawEnemies(ctx: Ctx, w: World, cx: number, cy: number, t: number) {
    for (const e of w.enemies) { if (!this.vis(e.x, e.y, 32, 32, cx, cy)) continue; const f = (e.hostile ? this.A.daemonHostile : this.A.daemonCalm)[Math.floor(t * 6) % 4]; ctx.save(); const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy); if (e.dir < 0) { ctx.translate(sx + 32, sy); ctx.scale(-1, 1); ctx.drawImage(f, 0, 0); } else ctx.drawImage(f, sx, sy); ctx.restore();
      if (!e.hostile) { ctx.fillStyle = C.dimGreen; ctx.font = '8px "Space Mono", Consolas, "DejaVu Sans Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillText('IDLE', sx + 5, sy - 9); } }
    if (w.hunter) { const x = w.hunter.x - cx, y = w.hunter.y - cy + Math.sin(t * 5) * 3; const f = this.A.daemonHostile[Math.floor(t * 8) % 4]; ctx.globalAlpha = 0.75; ctx.drawImage(f, Math.round(x - 16), Math.round(y - 16)); ctx.globalAlpha = 1; ctx.fillStyle = C.red; ctx.font = '8px "Space Mono", Consolas, monospace'; ctx.fillText('HUNTER', Math.round(x - 16), Math.round(y - 26)); }
  }
  private drawBoss(ctx: Ctx, w: World, cx: number, cy: number, t: number, o: DrawOpts) {
    const b = w.boss; if (!b) return; const ex = Math.round(b.x - cx), ey = Math.round(b.y - cy);
    // support struts
    for (let i = -3; i <= 3; i++) { ctx.fillStyle = i % 2 ? C.ink : C.steel; ctx.fillRect(ex + i * 22 - 3, 0, 6, Math.max(0, ey - 38 + Math.abs(i) * 6)); ctx.fillStyle = C.void; ctx.fillRect(ex + i * 22 - 3, 0, 1, Math.max(0, ey - 38)); }
    const range = (w.r('watcher', 'range') as number) ?? 420;
    if (o.editing || o.debug) { ctx.strokeStyle = b.blind > 0 ? 'rgba(83,255,154,.5)' : 'rgba(255,38,61,.55)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey, range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,38,61,0.05)'; ctx.beginPath(); ctx.arc(ex, ey, range, 0, Math.PI * 2); ctx.fill(); }
    const open = b.defeated ? 0.05 : b.blind > 0 ? 0.04 : 1; const look: [number, number] = [Math.cos(b.angle) * 0.9, Math.sin(b.angle) * 0.9];
    if (b.defeated) { ctx.globalAlpha = 0.55; }
    drawEye(ctx, ex, ey, 40, t, look, open, b.detection * 3 + (b.defeated ? 3 : 0)); ctx.globalAlpha = 1;
    if (!b.defeated && b.blind <= 0) { // beam
      const a = b.angle; const px_ = w.x + 7 - cx, py_ = w.y + 14 - cy; const seen = b.detection > 0.02;
      ctx.save(); ctx.globalAlpha = seen ? 0.25 + b.detection * 0.55 : 0.12; ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(ex, ey); if (seen) { ctx.lineTo(px_ - 9, py_); ctx.lineTo(px_ + 9, py_); } else { ctx.lineTo(ex + Math.cos(a - 0.12) * Math.min(range, 500), ey + Math.sin(a - 0.12) * Math.min(range, 500)); ctx.lineTo(ex + Math.cos(a + 0.12) * Math.min(range, 500), ey + Math.sin(a + 0.12) * Math.min(range, 500)); } ctx.closePath(); ctx.fill(); ctx.restore(); }
  }
  private animFrame(key: NullAnim, frames: number, fps: number, t: number) { if (this.animKey !== key) { this.animKey = key; this.animT = t; } return Math.floor((t - this.animT) * fps) % frames; }
  private drawPlayer(ctx: Ctx, w: World, cx: number, cy: number, t: number, o: DrawOpts) {
    const sheets = w.facing >= 0 ? this.A.nullR : this.A.nullL; let anim: NullAnim = 'idle'; let frame = 0;
    if (w.dead > 0) { anim = 'death'; frame = Math.min(NULL_FRAMES.death - 1, Math.floor((55 - w.dead) / 55 * NULL_FRAMES.death)); }
    else if (w.hurt > 52) { anim = 'damage'; frame = Math.floor(t * 8) % 2; }
    else if (!w.onGround) { anim = w.vy < 0 ? 'jump' : 'fall'; frame = this.animFrame(anim, NULL_FRAMES[anim], 8, t) % NULL_FRAMES[anim]; }
    else if (w.landTimer > 0) { anim = 'land'; frame = w.landTimer > 4 ? 0 : 1; }
    else if (Math.abs(w.vx) > 0.3) { anim = 'run'; frame = Math.floor(t * (6 + Math.abs(w.vx) * 3)) % NULL_FRAMES.run; }
    else { anim = 'idle'; frame = Math.floor(t * 4) % NULL_FRAMES.idle; }
    const spr = sheets[anim].frames[frame]; const sx = Math.round(w.x + PHYS.hitW / 2 - NULL_W / 2 - cx), sy = Math.round(w.y + PHYS.hitH - NULL_H + 2 - cy);
    if (o.ghost && w.dead === 0) this.drawGhost(ctx, o.ghost, cx, cy, t);
    // contact shadow
    if (w.onGround && w.dead === 0) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(sx + 8, sy + NULL_H - 3, 16, 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(sx + 5, sy + NULL_H - 2, 22, 1); }
    // speed trail
    if (!settings.reducedMotion) for (let i = 0; i < this.trail.length; i++) { const tr = this.trail[i]; ctx.globalAlpha = 0.07 + 0.05 * i; ctx.drawImage(tr.spr, Math.round(tr.x - cx), Math.round(tr.y - cy), tr.w, tr.h); }
    ctx.globalAlpha = 1;
    if (w.hurt > 0 && w.dead === 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    // corruption afterimages
    if (o.stage >= 2 && !settings.reducedMotion && w.dead === 0) { ctx.globalAlpha = 0.25; ctx.drawImage(spr, sx + Math.round(Math.sin(t * 9) * 3), sy); ctx.globalAlpha = w.hurt > 0 && Math.floor(t * 20) % 2 === 0 ? 0.45 : 1; }
    // squash & stretch anchored at the feet
    const air = !w.onGround && w.dead === 0; const s0 = w.dead > 0 ? 0 : this.sq - (air ? Math.min(0.2, Math.abs(w.vy) * 0.02) : 0);
    const dw = Math.round(NULL_W * (1 + s0 * 0.8)), dh = Math.round(NULL_H * (1 - s0)), dx = sx + Math.round((NULL_W - dw) / 2), dy = sy + NULL_H - dh;
    // crimson rim light, then the body, then a faint additive highlight
    if (w.dead === 0) { const rim = tinted(spr, C.red); const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.6; ctx.drawImage(rim, dx - 1, dy, dw, dh); ctx.drawImage(rim, dx + 1, dy, dw, dh); ctx.drawImage(rim, dx, dy - 1, dw, dh); ctx.globalAlpha = a0; }
    ctx.drawImage(spr, dx, dy, dw, dh);
    if (w.dead === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.16; ctx.drawImage(tinted(spr, '#c9d4ff'), dx, dy, dw, dh); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
    if (this.lastTick !== w.tick) {
      this.lastTick = w.tick; this.sq *= 0.8; const fast = (Math.abs(w.vx) > 2.3 && w.onGround) || (!w.onGround && Math.abs(w.vy) > 3.5);
      if (fast && w.dead === 0 && w.tick % 2 === 0) { this.trail.push({ x: dx + cx, y: dy + cy, w: dw, h: dh, spr: tinted(spr, w.onGround ? TINTS.boot.accent : C.red) }); if (this.trail.length > 5) this.trail.shift(); } else if (this.trail.length && w.tick % 2 === 0) this.trail.shift();
      for (const e of w.events) { const fx = w.x + 7, fy = w.y + 28;
        if (e.type === 'jump') { this.sq = -0.3; this.particles.emit(fx, fy, 8, { col: [C.bone, C.steel2], speed: 1.1, dir: -Math.PI / 2, spread: Math.PI, life: 18, g: 0.02 }); }
        if (e.type === 'land') { const hard = Math.min(1, this.prevVy / 9); this.sq = 0.12 + 0.3 * hard; this.particles.emit(fx, fy, 6 + Math.round(hard * 14), { col: [C.bone, C.steel2, C.steel3], speed: 1.1 + hard, dir: -Math.PI / 2, spread: Math.PI * 0.95, life: 20 + hard * 10, g: 0.02, size: hard > 0.6 ? 2 : 1 }); }
        if (e.type === 'step') this.particles.emit(fx - w.facing * 4, fy, 2, { col: [C.steel2, C.steel3], speed: .5, dir: w.facing > 0 ? Math.PI : 0, spread: 0.9, life: 14, g: -0.005 });
        if (e.type === 'hit' || e.type === 'death') this.particles.emit(fx, w.y + 14, e.type === 'death' ? 40 : 14, { col: [C.red, C.bone, C.void], speed: 2.4, life: 40, g: 0.06 });
        if (e.type === 'checkpoint') this.particles.emit(fx, fy, 24, { col: [C.green, C.bone], speed: 1.6, dir: -Math.PI / 2, spread: Math.PI * 1.2, life: 34, g: -0.01 });
        if (e.type === 'memory') this.particles.emit(fx, w.y, 28, { col: [C.bone, C.red], speed: 1.6, life: 36, g: -0.01 }); }
      this.prevVy = Math.max(0, w.vy);
    }
    this.particles.update();
  }
  private drawArc(ctx: Ctx, arc: [number, number][], cx: number, cy: number, t: number) { ctx.fillStyle = C.green; arc.forEach(([x, y], i) => { if ((i + Math.floor(t * 12)) % 2 === 0) ctx.fillRect(Math.round(x - cx), Math.round(y - cy), 2, 2); }); const last = arc[arc.length - 1]; if (last) { ctx.fillStyle = 'rgba(83,255,154,.8)'; ctx.fillRect(Math.round(last[0] - cx) - 2, Math.round(last[1] - cy) - 1, 6, 3); } }
  private drawExitMarker(ctx: Ctx, w: World, cx: number, cy: number, t: number) { const x = this.level.exit[0] * TILE + 16 - cx, y = this.level.exit[1] * TILE - 40 - cy + Math.sin(t * 4) * 3; ctx.fillStyle = C.green; for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x) - 5 + i, Math.round(y) + i, 11 - i * 2, 1); void w; }

  private drawLighting(ctx: Ctx, w: World, cx: number, cy: number, t: number) {
    const L = this.lctx; L.globalCompositeOperation = 'source-over'; const exc = this.level.theme === 'exception';
    L.fillStyle = exc ? 'rgba(10,3,5,0.44)' : 'rgba(6,6,8,0.38)'; L.fillRect(0, 0, VIEW_W, VIEW_H); L.globalCompositeOperation = 'destination-out';
    const glow = (x: number, y: number, r: number, a: number) => { const sx = x - cx, sy = y - cy; if (sx < -r || sx > VIEW_W + r || sy < -r || sy > VIEW_H + r) return; const g = L.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.45})`); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.fillRect(sx - r, sy - r, r * 2, r * 2); };
    glow(w.x + 7, w.y + 10, 190, 0.95); // NULL carries its own light
    for (const tm of this.level.terminals) glow(tm.x * TILE + 16, tm.y * TILE + 16, 90, 0.9);
    for (const c of this.level.checkpoints) glow(c.x * TILE + 16, c.y * TILE, 70, w.activeCheckpoint === c.id ? 0.9 : 0.4);
    const ex = this.level.exit; glow(ex[0] * TILE + 16, ex[1] * TILE, 110, w.exitOpen ? 0.95 : 0.35);
    for (const l of this.level.lasers) if (w.laserActive(l.rule)) { const r = w.laserRect(l); glow(r.x + r.w / 2, r.y + r.h / 2, 120, 0.8); }
    for (const e of w.enemies) glow(e.x + 16, e.y + 16, 90, 0.75);
    for (const d of this.level.decor) if (d.kind === 'monitor') glow(d.x * TILE + 16, d.y * TILE + 18, 70, 0.7);
    for (const m of this.level.memories) if (!w.collected.has(m.id) && (m.minCorruption ?? 0) <= w.corruption) glow(m.x * TILE + 16, m.y * TILE + 16, 80, 0.9);
    if (w.boss) glow(w.boss.x, w.boss.y, 220, 0.85);
    for (const p of w.platforms) glow(p.x + p.w / 2, p.y, 60, 0.4);
    void t; L.globalCompositeOperation = 'source-over'; ctx.drawImage(this.light, 0, 0);
    // additive coloured glow on top
    ctx.globalCompositeOperation = 'lighter';
    const add = (x: number, y: number, r: number, col: string) => { const sx = x - cx, sy = y - cy; if (sx < -r || sx > VIEW_W + r || sy < -r || sy > VIEW_H + r) return; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2); };
    add(w.x + 11, w.y + 8, 36, 'rgba(255,38,61,0.30)'); add(w.x + 7, w.y + 20, 22, 'rgba(255,200,210,0.07)');
    for (const tm of this.level.terminals) add(tm.x * TILE + 16, tm.y * TILE + 14, 44, 'rgba(83,255,154,0.16)');
    for (const l of this.level.lasers) if (w.laserActive(l.rule)) { const r = w.laserRect(l); add(r.x + r.w / 2, r.y + r.h / 2, 70, 'rgba(255,38,61,0.20)'); }
    for (const e of w.enemies) add(e.x + 16, e.y + 14, 40, e.hostile ? 'rgba(255,38,61,0.17)' : 'rgba(83,255,154,0.10)');
    add(this.level.exit[0] * TILE + 16, this.level.exit[1] * TILE, 60, w.exitOpen ? 'rgba(83,255,154,0.18)' : 'rgba(255,38,61,0.14)');
    if (w.boss) add(w.boss.x, w.boss.y, 120, 'rgba(255,38,61,0.16)');
    ctx.globalCompositeOperation = 'source-over';
  }
  private drawDebug(ctx: Ctx, w: World, cx: number, cy: number, o: DrawOpts) {
    ctx.lineWidth = 1; const box = (r: { x: number; y: number; w: number; h: number }, col: string) => { ctx.strokeStyle = col; ctx.strokeRect(Math.round(r.x - cx) + 0.5, Math.round(r.y - cy) + 0.5, r.w, r.h); };
    ctx.font = '8px monospace'; ctx.textBaseline = 'top';
    box(w.hit, C.green); for (const r of w.dynamicSolids()) box(r, '#ffd24a'); for (const h of w.hazards) box(h, C.red);
    for (const l of this.level.lasers) box(w.laserRect(l), w.laserActive(l.rule) ? C.red : C.dimGreen); for (const e of w.enemies) box(w.enemyRect(e), e.hostile ? C.red : C.dimGreen);
    for (const t of this.level.triggers) box({ x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE }, '#8888ff');
    ctx.fillStyle = C.green; ctx.fillText(`${w.x.toFixed(1)}, ${w.y.toFixed(1)}  v ${w.vx.toFixed(2)}, ${w.vy.toFixed(2)}  ${w.onGround ? 'GROUND' : 'AIR'}`, 6, VIEW_H - 12);
    for (const p of w.platforms) { ctx.fillStyle = '#ffd24a'; ctx.fillText(p.def.id, Math.round(p.x - cx), Math.round(p.y - cy) - 9); }
    for (const d of this.level.doors) { ctx.fillStyle = '#ffd24a'; ctx.fillText(d.id, d.x * TILE - cx, d.y * TILE - cy - 9); }
    for (const l of this.level.lasers) { ctx.fillStyle = C.red; ctx.fillText(l.id, l.x * TILE - cx, l.y * TILE - cy - 9); }
    for (const e of w.enemies) { ctx.fillStyle = C.red; ctx.fillText(e.def.id, e.x - cx, e.y - cy - 9); }
    if (o.selected) { ctx.fillStyle = C.bone; ctx.fillText('SELECTED: ' + o.selected, 6, 6); }
    void disc;
  }
}
