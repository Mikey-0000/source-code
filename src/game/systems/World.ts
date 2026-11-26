// Pure gameplay simulation (no DOM, no canvas) so physics and puzzles can be tested headlessly.
import { TILE, jumpVelocity, PHYS } from '../physics/Physics';
import type { LevelDef } from '../levels/LevelTypes';
import type { RuleState } from '../../editor/RuleSchema';
import { defaultState } from '../../editor/RuleSchema';

export interface Rect { x: number; y: number; w: number; h: number }
export interface InputState { left: boolean; right: boolean; jumpHeld: boolean; jumpPressed: boolean }
export type WorldEvent =
  | { type: 'jump' | 'land' | 'step' | 'hit' | 'death' | 'respawn' | 'exit' | 'door' | 'laser' }
  | { type: 'checkpoint'; id: string } | { type: 'memory'; id: string } | { type: 'trigger'; id: string; event: string }
  | { type: 'camera'; id: string } | { type: 'boss'; what: 'detected' | 'blind' | 'visible' | 'defeated' | 'fuse'; n?: number } | { type: 'hunter' };

export interface PlatformState { def: LevelDef['platforms'][number]; x: number; y: number; px: number; py: number; w: number; h: number }
export interface EnemyState { def: LevelDef['enemies'][number]; x: number; y: number; dir: number; hostile: boolean }

export class World {
  level: LevelDef; rule: RuleState; tick = 0;
  // player
  x = 0; y = 0; vx = 0; vy = 0; onGround = false; facing = 1; coyote = 0; buffer = 0; jumping = false; hurt = 0; integrity = 100; dead = 0; landTimer = 0; riding: PlatformState | null = null; wasGround = false;
  checkpoint: { x: number; y: number }; activeCheckpoint = ''; collected = new Set<string>(); fuses = new Set<number>();
  platforms: PlatformState[]; enemies: EnemyState[]; hazards: Rect[] = []; events: WorldEvent[] = [];
  corruption = 0; hunter: { x: number; y: number } | null = null; cameraAlertCd = 0; cameraBeams: { id: string; x: number; y: number; a: number }[] = [];
  boss: { x: number; y: number; angle: number; detection: number; blind: number; integrity: number; defeated: boolean; phase: number } | null = null;
  stats = { deaths: 0 }; exited = false; w: number; h: number; frozen = false;

  constructor(level: LevelDef, rule?: RuleState, checkpoint?: { x: number; y: number }, corruption = 0) {
    this.level = level; this.rule = rule ?? defaultState(level.schema); this.corruption = corruption;
    this.w = level.grid[0].length; this.h = level.grid.length;
    this.platforms = level.platforms.map(p => ({ def: p, x: p.x * TILE, y: p.y * TILE, px: p.x * TILE, py: p.y * TILE, w: p.w * TILE, h: 12 }));
    this.enemies = level.enemies.map(e => ({ def: e, x: e.x * TILE, y: e.y * TILE, dir: 1, hostile: true }));
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = level.grid[y][x];
      if (c === '^') this.hazards.push({ x: x * TILE + 3, y: y * TILE + 14, w: TILE - 6, h: TILE - 14 });
      if (c === 'v') this.hazards.push({ x: x * TILE + 3, y: y * TILE + 10, w: TILE - 6, h: 22 });
    }
    this.checkpoint = checkpoint ?? { x: level.start[0] * TILE + 16, y: level.start[1] * TILE };
    if (level.boss) this.boss = { x: level.boss.x * TILE, y: level.boss.y * TILE, angle: Math.PI / 2, detection: 0, blind: 0, integrity: 100, defeated: false, phase: 1 };
    this.respawn(true);
    this.applyRules(this.rule, true);
  }

  // ---------- rule access ----------
  r(o: string, p: string): number | boolean | undefined { return this.rule[o]?.[p]; }
  get speed() { return (this.r('player', 'speed') as number) ?? 2.8; }
  get jumpHeight() { return (this.r('player', 'jumpHeight') as number) ?? 45; }
  get gravity() { return (this.r('world', 'gravity') as number) ?? 0.8; }
  doorLocked(rule: string) { return this.r(rule, 'locked') !== false; }
  laserActive(rule: string) { return this.r(rule, 'active') === true; }

  applyRules(next: RuleState, initial = false) {
    const prev = this.rule; this.rule = next;
    if (this.boss && !initial) {
      if (next.watcher?.blind === true) { this.boss.blind = Math.round(((next.watcher.blindTime as number) ?? 0) * 60); this.events.push({ type: 'boss', what: 'blind' }); }
      if (next.watcher?.blind !== true) this.boss.blind = 0;
    }
    if (this.boss) { const ig = (next.watcher?.integrity as number) ?? 100; this.boss.integrity = Math.min(this.boss.integrity, ig); if (ig > this.boss.integrity && !initial) this.boss.integrity = ig; if (this.boss.integrity <= 0 && !this.boss.defeated) { this.boss.defeated = true; this.events.push({ type: 'boss', what: 'defeated' }); } }
    for (const e of this.enemies) e.hostile = this.r(e.def.rule, 'hostile') !== false;
  }

  // ---------- geometry ----------
  get hit(): Rect { return { x: this.x, y: this.y, w: PHYS.hitW, h: PHYS.hitH }; }
  get feet() { return { x: this.x + PHYS.hitW / 2, y: this.y + PHYS.hitH }; }
  solidTile(tx: number, ty: number) { if (tx < 0 || tx >= this.w) return true; if (ty < 0) return true; if (ty >= this.h) return false; return this.level.grid[ty][tx] === '#'; }
  dynamicSolids(): Rect[] {
    const out: Rect[] = [];
    for (const p of this.platforms) { if (p.def.kind === 'ghost' || p.def.rule) { if (p.def.rule && this.r(p.def.rule, 'collision') !== true) continue; } out.push({ x: p.x, y: p.y, w: p.w, h: p.h }); }
    for (const d of this.level.doors) if (this.doorLocked(d.rule)) out.push({ x: d.x * TILE + 8, y: d.y * TILE, w: 16, h: d.h * TILE });
    return out;
  }
  private collides(x: number, y: number, dyn: Rect[]): boolean {
    const w = PHYS.hitW, h = PHYS.hitH; const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE), y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
    for (const r of dyn) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
    return false;
  }

  respawn(initial = false) {
    this.x = this.checkpoint.x - PHYS.hitW / 2; this.y = this.checkpoint.y - PHYS.hitH; this.vx = 0; this.vy = 0; this.integrity = 100; this.hurt = initial ? 0 : 60; this.dead = 0; this.onGround = false; this.coyote = 0; this.riding = null;
    if (this.boss) this.boss.detection = 0;
    if (this.hunter) this.hunter = { x: this.level.start[0] * TILE - 6 * TILE, y: this.level.start[1] * TILE - 60 };
    if (!initial) this.events.push({ type: 'respawn' });
  }
  damage(n: number, kx = 0) {
    if (this.hurt > 0 || this.dead > 0) return;
    this.integrity -= n; this.hurt = 70; this.vy = -4; this.vx = kx * 3; this.events.push({ type: 'hit' });
    if (this.integrity <= 0) this.die();
  }
  die() { if (this.dead > 0) return; this.dead = 55; this.stats.deaths++; this.events.push({ type: 'death' }); }

  // ---------- update ----------
  update(inp: InputState) {
    this.tick++; this.events = [];
    this.updatePlatforms();
    if (this.dead > 0) { this.dead--; if (this.dead === 0) this.respawn(); return; }
    if (this.frozen) return;
    const dyn = this.dynamicSolids();
    // carry
    if (this.riding) { const p = this.riding; const dx = p.x - p.px, dy = p.y - p.py; if (dx || dy) { this.x += dx; if (!this.collides(this.x, this.y, dyn)) { /* ok */ } this.y += dy; } }
    // horizontal control
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); const sp = this.speed; const g = this.gravity;
    if (dir) { this.facing = dir; const a = (this.onGround ? PHYS.accelGround : PHYS.accelAir) * Math.max(1, sp); this.vx += dir * a; if (Math.abs(this.vx) > sp) this.vx = Math.sign(this.vx) * Math.max(sp, Math.abs(this.vx) - 0.5); }
    else { const f = this.onGround ? PHYS.frictionGround * Math.max(1, sp) : PHYS.frictionAir; this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f; }
    if (Math.abs(this.vx) > sp + 0.01 && dir && Math.sign(this.vx) === dir) this.vx = dir * sp;
    // jump
    if (inp.jumpPressed) this.buffer = PHYS.buffer; else if (this.buffer > 0) this.buffer--;
    if (this.onGround) this.coyote = PHYS.coyote; else if (this.coyote > 0) this.coyote--;
    if (this.buffer > 0 && this.coyote > 0 && this.hurt < 55) { this.vy = -jumpVelocity(this.jumpHeight, g); this.buffer = 0; this.coyote = 0; this.jumping = true; this.onGround = false; this.riding = null; this.events.push({ type: 'jump' }); }
    if (this.jumping && !inp.jumpHeld && this.vy < -2) { this.vy *= PHYS.jumpCut; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;
    this.vy = Math.min(PHYS.maxFall + Math.max(0, g - 0.8) * 8, this.vy + g);
    // move X
    let rem = this.vx; const sx = Math.sign(rem); rem = Math.abs(rem);
    while (rem > 0) { const s = Math.min(1, rem); const nx = this.x + sx * s; if (this.collides(nx, this.y, dyn)) { this.vx = 0; break; } this.x = nx; rem -= s; }
    // move Y
    let remy = Math.abs(this.vy); const sy = Math.sign(this.vy); const wasAir = !this.onGround; const fallV = this.vy; this.onGround = false; this.riding = null;
    while (remy > 0) { const s = Math.min(1, remy); const ny = this.y + sy * s; if (this.collides(this.x, ny, dyn)) { if (sy > 0) this.onGround = true; this.vy = 0; break; } this.y = ny; remy -= s; }
    if (!this.onGround && this.collides(this.x, this.y + 1, dyn)) this.onGround = true;
    if (this.onGround) {
      for (const p of this.platforms) { if (!dyn.some(d => d.x === p.x && d.y === p.y)) continue; if (Math.abs(this.y + PHYS.hitH - p.y) < 2.5 && this.x + PHYS.hitW > p.x && this.x < p.x + p.w) this.riding = p; }
      if (wasAir) { this.events.push({ type: 'land' }); this.landTimer = fallV > 6 ? 8 : 0; }
      if (Math.abs(this.vx) > 1 && this.tick % 14 === 0) this.events.push({ type: 'step' });
    }
    if (this.landTimer > 0) this.landTimer--;
    if (this.hurt > 0) this.hurt--;
    // pits
    if (this.y > this.h * TILE + 80) { this.integrity = 0; this.die(); }
    this.wasGround = this.onGround;
    this.updateHazards();
    this.updateEnemies();
    this.updateCameras();
    this.updateBoss();
    this.updateObjects();
  }

  private updatePlatforms() {
    for (const p of this.platforms) {
      p.px = p.x; p.py = p.y;
      if (p.def.kind === 'moving' && p.def.to) {
        const period = p.def.period ?? 240; const k = 0.5 - 0.5 * Math.cos((this.tick / period) * Math.PI * 2);
        p.x = (p.def.x + (p.def.to[0] - p.def.x) * k) * TILE; p.y = (p.def.y + (p.def.to[1] - p.def.y) * k) * TILE;
      }
    }
  }
  private rectHit(r: Rect) { const h = this.hit; return h.x < r.x + r.w && h.x + h.w > r.x && h.y < r.y + r.h && h.y + h.h > r.y; }
  laserRect(l: LevelDef['lasers'][number]): Rect { return l.dir === 'v' ? { x: l.x * TILE + 12, y: l.y * TILE, w: 8, h: l.len * TILE } : { x: l.x * TILE, y: l.y * TILE + 12, w: l.len * TILE, h: 8 }; }
  private updateHazards() {
    for (const hz of this.hazards) if (this.rectHit(hz)) { this.damage(100, -this.facing); break; }
    for (const l of this.level.lasers) if (this.laserActive(l.rule) && this.rectHit(this.laserRect(l))) { this.damage(100, -this.facing); this.events.push({ type: 'laser' }); break; }
  }
  enemyRect(e: EnemyState): Rect { return { x: e.x + 6, y: e.y + 6, w: 20, h: 22 }; }
  private updateEnemies() {
    for (const e of this.enemies) {
      const sp = (this.r(e.def.rule, 'speed') as number | undefined) ?? e.def.speed; e.x += e.dir * sp;
      if (e.x < e.def.x0 * TILE) { e.x = e.def.x0 * TILE; e.dir = 1; } if (e.x > e.def.x1 * TILE) { e.x = e.def.x1 * TILE; e.dir = -1; }
      if (e.hostile && this.rectHit(this.enemyRect(e))) this.damage(100, e.dir);
    }
    if (this.corruption >= 66 && !this.hunter && !this.level.boss) { this.hunter = { x: this.level.start[0] * TILE - 6 * TILE, y: this.level.start[1] * TILE - 60 }; this.events.push({ type: 'hunter' }); }
    if (this.hunter && this.dead === 0) {
      const dx = this.x - this.hunter.x, dy = this.y - 8 - this.hunter.y, d = Math.hypot(dx, dy);
      if (d < 420 && d > 1) { this.hunter.x += dx / d * 0.85; this.hunter.y += dy / d * 0.85; }
      if (d < 18) this.damage(20, Math.sign(dx));
    }
  }
  private updateCameras() {
    this.cameraBeams = []; if (this.cameraAlertCd > 0) this.cameraAlertCd--;
    for (const c of this.level.cameras) {
      if (this.corruption < c.minCorruption) continue;
      const a = c.aim + Math.sin(this.tick / 90 * c.sweep) * 0.55; const cx = c.x * TILE + 12, cy = c.y * TILE + 8; this.cameraBeams.push({ id: c.id, x: cx, y: cy, a });
      const px = this.x + 7 - cx, py = this.y + 14 - cy; const d = Math.hypot(px, py); let da = Math.atan2(py, px) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d < 220 && Math.abs(da) < 0.22 && this.cameraAlertCd === 0) { this.cameraAlertCd = 240; this.events.push({ type: 'camera', id: c.id }); this.damage(10, 0); }
    }
  }
  private updateBoss() {
    const b = this.boss; if (!b || b.defeated) return;
    if (b.blind > 0) { b.blind--; if (b.blind === 0) this.events.push({ type: 'boss', what: 'visible' }); }
    const range = (this.r('watcher', 'range') as number) ?? 420;
    const px = this.x + 7 - b.x, py = this.y + 14 - b.y; const d = Math.hypot(px, py);
    const seen = b.blind <= 0 && d <= range && this.dead === 0;
    b.detection = Math.max(0, Math.min(1, b.detection + (seen ? 1 / 30 : -1 / 60)));
    const target = seen || b.detection > 0.02 ? Math.atan2(py, px) : Math.PI / 2 + Math.sin(this.tick / 70) * 0.95;
    b.angle += Math.atan2(Math.sin(target - b.angle), Math.cos(target - b.angle)) * 0.2;
    if (b.detection >= 1) { b.detection = 0.35; this.events.push({ type: 'boss', what: 'detected' }); this.damage(34, 0); }
  }
  isBeamSeen(): boolean { return !!this.boss && this.boss.detection > 0.01; }

  private updateObjects() {
    const feet = this.hit;
    for (const c of this.level.checkpoints) { if (this.activeCheckpoint !== c.id && Math.abs(this.x + 7 - (c.x * TILE + 16)) < 22 && Math.abs(this.y + 28 - (c.y * TILE + 32)) < 40) { this.activeCheckpoint = c.id; this.checkpoint = { x: c.x * TILE + 16, y: c.y * TILE + 32 }; this.events.push({ type: 'checkpoint', id: c.id }); } }
    for (const m of this.level.memories) { if (this.collected.has(m.id)) continue; if ((m.minCorruption ?? 0) > this.corruption) continue; if (Math.abs(this.x + 7 - (m.x * TILE + 16)) < 20 && Math.abs(this.y + 14 - (m.y * TILE + 16)) < 26) { this.collected.add(m.id); this.events.push({ type: 'memory', id: m.id }); } }
    for (const t of this.level.triggers) { const r = { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE }; const key = 'trg:' + t.id; if (!this.collected.has(key) && feet.x < r.x + r.w && feet.x + feet.w > r.x && feet.y < r.y + r.h && feet.y + feet.h > r.y) { this.collected.add(key); this.events.push({ type: 'trigger', id: t.id, event: t.event }); } }
    const ex = this.level.exit; if (this.exitOpen && !this.exited && Math.abs(this.x + 7 - (ex[0] * TILE + 16)) < 18 && Math.abs(this.y + 28 - (ex[1] * TILE + 32)) < 40) { this.exited = true; this.events.push({ type: 'exit' }); }
  }
  get exitOpen() { return !this.boss || this.boss.defeated; }
  nearestTerminal() { let best: LevelDef['terminals'][number] | null = null, bd = 34; for (const t of this.level.terminals) { const d = Math.hypot(this.x + 7 - (t.x * TILE + 16), this.y + 14 - (t.y * TILE + 16)); if (d < bd) { bd = d; best = t; } } return best; }
  touchFuse(n: number) { if (!this.fuses.has(n)) { this.fuses.add(n); if (this.boss) this.boss.phase = n + 1; this.events.push({ type: 'boss', what: 'fuse', n }); } }
}
