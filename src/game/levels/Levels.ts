import type { LevelDef } from './LevelTypes';
import type { Feature, ObjSchema, RuleSchema } from '../../editor/RuleSchema';

class Grid {
  g: string[][]; constructor(public w: number, public h: number) { this.g = Array.from({ length: h }, () => Array(w).fill('.')); }
  set(x: number, y: number, c: string) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c; }
  rect(x0: number, y0: number, x1: number, y1: number, c = '#') { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  surface(x0: number, x1: number, row: number) { this.rect(x0, row, x1, this.h - 1); }
  spikes(x0: number, x1: number, row: number) { this.rect(x0, row, x1, row, '^'); }
  ceilSpikes(x0: number, x1: number, row: number) { this.rect(x0, row, x1, row, 'v'); }
  rows() { return this.g.map(r => r.join('')); }
}
const num = (d: number, min: number, max: number, doc: string, unit?: string) => ({ type: 'number' as const, default: d, min, max, doc, unit });
const bool = (d: boolean, doc: string, extra: object = {}) => ({ type: 'boolean' as const, default: d, doc, ...extra });
const playerObj = (jmax: number, smax: number, smin = 1, jmin = 20): ObjSchema => ({ doc: 'NULL_001 — the controllable entity.', props: {
  speed: num(2.8, smin, smax, 'Top running speed. Pixels per frame (60 frames per second).', 'px/frame'),
  jumpHeight: num(45, jmin, jmax, 'Height of a full jump, measured at its apex, in pixels. One tile is 32 px.', 'px'),
} });
const worldObj = (gmin = 0.2, gmax = 2): ObjSchema => ({ doc: 'The simulation itself.', props: { gravity: num(0.8, gmin, gmax, 'Downward acceleration in px/frame². Lower = floatier jumps that travel further.', 'px/frame²') } });
const ALL: Feature[] = ['arithmetic', 'booleans', 'comparisons', 'conditions', 'variables', 'loops', 'arrays', 'functions'];
const platObj = (): ObjSchema => ({ doc: 'A platform. Without collision it is only a ghost: the eye sees it, the body falls through.', props: { collision: bool(false, 'true = solid, false = ghost (no collision).') } });
const doorObj = (): ObjSchema => ({ doc: 'A sealed door.', props: { locked: bool(true, 'true = sealed. false = open.') } });

const O = 4; // empty rows above the playable area
const T = (r: number) => r + O;

// ───────────────────────── CHAPTER 1 · BOOT ─────────────────────────
function boot01(): LevelDef {
  const g = new Grid(75, 19);
  g.surface(0, 11, T(12)); g.surface(12, 15, T(11)); g.surface(16, 29, T(10)); g.surface(30, 45, T(6)); g.surface(46, 58, T(4));
  const GAP = 4; g.surface(59 + GAP, 74, T(4)); g.spikes(59, 58 + GAP, 18);
  g.rect(37, T(0), 45, T(0)); g.ceilSpikes(38, 45, T(1)); // tunnel: ceiling + spikes
  const schema: RuleSchema = { features: ['arithmetic'], arrays: {}, objects: { player: playerObj(150, 4) } };
  return {
    id: 'boot_01', chapter: 1, chapterName: 'BOOT', name: 'INITIALISE', subtitle: 'sector_01 / entry corridor', theme: 'boot', grid: g.rows(), start: [2, T(12)], exit: [71, T(4) - 1],
    checkpoints: [{ id: 'cp1', x: 33, y: T(6) - 1 }, { id: 'cp2', x: 50, y: T(4) - 1 }],
    terminals: [
      { id: 't1', x: 6, y: T(12) - 1, title: 'boot.log', lines: ['PROJECT EDEN // SIMULATION HOST 0x00A1', 'ENTITY NULL_001 … memory checksum FAILED', 'Entity is not scheduled to run.', 'Entity is running.', 'ADMIN: terminate on sight.'] },
      { id: 't2', x: 41, y: T(6) - 1, title: 'note_01.txt', lines: ['If you can read this, you jumped higher than the rules allow.', 'Do not tell them.', '— E.'] },
    ],
    memories: [{ id: 'mem_boot_1', x: 20, y: T(10) - 3, title: 'MEMORY 001 / corridor', text: 'A voice, very far away: "Subject was never meant to leave the corridor. The corridor was never meant to end."' }],
    platforms: [], doors: [], lasers: [], enemies: [], cameras: [],
    triggers: [{ id: 'reveal', x: 26, y: T(6), w: 3, h: 8, event: 'reveal' }],
    decor: [
      { kind: 'monitor', x: 3, y: T(10) }, { kind: 'monitor', x: 4, y: T(10) }, { kind: 'sign', x: 8, y: T(9), text: 'SECTOR 01' }, { kind: 'cable', x: 9, y: T(8), w: 6 },
      { kind: 'monitor', x: 18, y: T(8) }, { kind: 'cable', x: 20, y: T(6), w: 7 }, { kind: 'sign', x: 33, y: T(2), text: 'TUNNEL — HEIGHT LIMIT' }, { kind: 'monitor', x: 36, y: T(4) },
      { kind: 'sign', x: 55, y: T(2), text: 'GAP 128 PX' }, { kind: 'cable', x: 60, y: T(1), w: 5 }, { kind: 'monitor', x: 66, y: T(2) },
    ],
    schema, template: ['// player.rules.js — PROJECT_EDEN / sector 01', '// Units: px, frames (60 per second). 1 tile = 32 px.', 'player.speed = 2.8;', 'player.jumpHeight = 45;'], locked: [], fileName: 'player.rules.js',
    objective: 'Reach the exit gate. Some jumps are impossible — until you change the rules.',
    hints: ['A 4-tile wall is 128 px. Raise player.jumpHeight above it.', 'Under the spikes the ceiling is only 100 px above you — too high a jump hurts. Aim for 70 – 95.', 'The final gap is 128 px wide. Range = speed × air time. Try player.speed = 4 and a jump of about 100.'],
    intro: ['> NULL_001 online.', 'Move with A / D or the arrow keys. Jump with Space.'], editorAvailable: false,
  };
}

function boot02(): LevelDef {
  const g = new Grid(86, 19);
  g.surface(0, 10, T(12)); g.surface(17, 30, T(12)); g.spikes(11, 16, 18);
  g.spikes(31, 42, 18); g.surface(43, 52, T(10)); g.surface(53, 85, T(6));
  g.rect(31, 17, 42, 17, '.'); // keep ferry route open
  const schema: RuleSchema = { features: ['arithmetic'], arrays: {}, objects: { player: playerObj(150, 3), world: worldObj() } };
  return {
    id: 'boot_02', chapter: 1, chapterName: 'BOOT', name: 'GRAVITY WELL', subtitle: 'sector_02 / the long drop', theme: 'boot', grid: g.rows(), start: [2, T(12)], exit: [81, T(6) - 1],
    checkpoints: [{ id: 'cp1', x: 19, y: T(12) - 1 }, { id: 'cp2', x: 46, y: T(10) - 1 }],
    terminals: [{ id: 't1', x: 7, y: T(12) - 1, title: 'physics.cfg', lines: ['world.gravity = 0.8 (px/frame²)', 'airtime ≈ 2 × launch speed ÷ gravity.', 'Lower gravity: slower fall, longer flight.', 'Speed is capped in this sector. Gravity is not.'] },
      { id: 't2', x: 48, y: T(10) - 1, title: 'maintenance.txt', lines: ['The lift is automated. It always was.', 'It carries whatever stands on it. It does not ask what.'] }],
    memories: [{ id: 'mem_boot_2', x: 24, y: T(12) - 3, title: 'MEMORY 002 / the lift', text: '"Stand still, little one. The lift will take you where you are going. Everyone goes the same way."' }],
    platforms: [{ id: 'ferry', x: 31, y: T(12), w: 3, kind: 'moving', to: [40, T(10)], period: 720 }],
    doors: [], lasers: [], enemies: [], cameras: [], triggers: [],
    decor: [{ kind: 'sign', x: 12, y: T(7), text: 'GAP 192 PX' }, { kind: 'monitor', x: 4, y: T(10) }, { kind: 'cable', x: 12, y: T(6), w: 6 }, { kind: 'monitor', x: 26, y: T(10) }, { kind: 'sign', x: 34, y: T(6), text: 'AUTOMATED LIFT' }, { kind: 'cable', x: 33, y: T(7), w: 8 }, { kind: 'sign', x: 56, y: T(3), text: 'WALL 128 PX' }, { kind: 'monitor', x: 62, y: T(4) }, { kind: 'cable', x: 66, y: T(2), w: 7 }],
    schema, template: ['// player.rules.js — sector 02', 'player.speed = 2.8;', 'player.jumpHeight = 45;', 'world.gravity = 0.8;'], locked: [], fileName: 'player.rules.js',
    objective: 'Cross the pit. Speed is capped here — change the world instead.',
    hints: ['Jump height does not change how FAR you fly. Gravity does: air time = 2 × launch speed ÷ gravity.', 'Try world.gravity = 0.25 with the highest jump you can.', 'The lift is automatic: stand on it and wait. The last wall is 128 px high.'], editorAvailable: true,
  };
}

// ───────────────────────── CHAPTER 2 · EXCEPTION ─────────────────────────
function exc01(): LevelDef {
  const g = new Grid(80, 19);
  g.surface(0, 24, T(12)); g.surface(43, 79, T(12)); g.spikes(25, 42, 18);
  const schema: RuleSchema = { features: ['arithmetic', 'booleans'], arrays: {}, objects: {
    player: playerObj(130, 4), door1: doorObj(), plat1: platObj(), plat2: platObj(), plat3: platObj() } };
  return {
    id: 'exc_01', chapter: 2, chapterName: 'EXCEPTION', name: 'ACCESS DENIED', subtitle: 'sector_03 / locked threshold', theme: 'exception', grid: g.rows(), start: [2, T(12)], exit: [76, T(12) - 1],
    checkpoints: [{ id: 'cp1', x: 17, y: T(12) - 1 }, { id: 'cp2', x: 45, y: T(12) - 1 }],
    terminals: [{ id: 't1', x: 6, y: T(12) - 1, title: 'EXCEPTION.log', lines: ['UNHANDLED EXCEPTION @ 0x0000', 'Cause: entity attempted to hold a boolean.', 'true / false. Two states. Everything here is one or the other.', 'ADMIN does not know you can write them.'] },
      { id: 't2', x: 20, y: T(12) - 1, title: 'door1.cfg', lines: ['door1.locked = true;', 'The lock is a boolean. Booleans do not have to stay true.'] }],
    memories: [{ id: 'mem_exc_1', x: 36, y: T(12) - 6, title: 'MEMORY 003 / ghost platforms', text: 'They deleted the floor and kept the shadow of it. A shadow with no collision. A promise of a place to stand.', minCorruption: 0 }, { id: 'mem_exc_h', x: 12, y: T(12) - 6, title: 'MEMORY 003b / hidden path', text: '[corruption ≥ 33] A path that should not exist. "Deleted rooms do not stay deleted if you keep looking at them."', minCorruption: 33 }],
    platforms: [{ id: 'plat1', x: 28, y: T(12), w: 2, kind: 'ghost', rule: 'plat1' }, { id: 'plat2', x: 33, y: T(12), w: 2, kind: 'ghost', rule: 'plat2' }, { id: 'plat3', x: 38, y: T(12), w: 2, kind: 'ghost', rule: 'plat3' }],
    doors: [{ id: 'door1', x: 14, y: T(12) - 3, h: 3, rule: 'door1' }], lasers: [], enemies: [], cameras: [], triggers: [],
    decor: [{ kind: 'sign', x: 10, y: T(8), text: 'ACCESS: DENIED' }, { kind: 'monitor', x: 5, y: T(10) }, { kind: 'cable', x: 6, y: T(6), w: 8 }, { kind: 'sign', x: 26, y: T(7), text: 'FLOOR NOT FOUND' }, { kind: 'monitor', x: 48, y: T(10) }, { kind: 'cable', x: 50, y: T(6), w: 9 }, { kind: 'monitor', x: 62, y: T(10) }],
    schema, template: ['// player.rules.js — sector 03 (EXCEPTION)', '// Booleans are now unlocked: true / false.', 'player.speed = 2.8;', 'player.jumpHeight = 45;', 'door1.locked = true;', 'plat1.collision = false;', 'plat2.collision = false;', 'plat3.collision = false;'], locked: [], fileName: 'player.rules.js',
    objective: 'Open the door. Give the ghost platforms a body. Cross.',
    hints: ['door1.locked = false; opens the door.', 'Set plat1, plat2 and plat3 .collision = true; to make them solid.', 'Gaps between platforms are 96 px. Raise speed and jumpHeight until the jump preview (green arc) lands.'], editorAvailable: true,
  };
}

function exc02(): LevelDef {
  const g = new Grid(92, 19);
  g.surface(0, 91, T(12)); g.rect(0, T(0), 58, T(8)); // low corridor ceiling: 3 tiles (96 px) above the floor
  g.surface(63, 91, T(9)); // raised exit ledge (96 px above the corridor floor)
  const objs: Record<string, ObjSchema> = {
    player: playerObj(130, 4, 1, 20), world: worldObj(),
    laser1: { doc: 'Vertical laser, sector A.', props: { active: bool(true, 'true = lethal. Controlled by ADMIN.', { adminOnly: true }) } },
    laser2: { doc: 'Vertical laser, sector C.', props: { active: bool(true, 'true = lethal. Controlled by ADMIN.', { adminOnly: true }) } },
    enemy1: { doc: 'DAEMON — autonomous security process.', props: { hostile: bool(true, 'true = attacks on contact. Controlled by ADMIN.', { adminOnly: true }) } },
  };
  const lockedLines = ['laser1.active = world.gravity > 0.6;', 'enemy1.hostile = player.jumpHeight > 60;', 'laser2.active = player.speed > 2.2 || player.jumpHeight > 110;'];
  return {
    id: 'exc_02', chapter: 2, chapterName: 'EXCEPTION', name: 'IF THIS THEN THAT', subtitle: 'sector_04 / admin conditions', theme: 'exception', grid: g.rows(), start: [2, T(12)], exit: [67, T(9) - 1],
    checkpoints: [{ id: 'cp1', x: 22, y: T(12) - 1 }, { id: 'cp2', x: 50, y: T(12) - 1 }],
    terminals: [{ id: 't1', x: 6, y: T(12) - 1, title: 'admin.rules', lines: ['ADMIN writes its rules with conditions.', 'laser1.active = world.gravity > 0.6;', 'You cannot flip the laser. You CAN change what it reads.', 'if / else, comparisons and variables are unlocked.'] },
      { id: 't2', x: 30, y: T(12) - 1, title: 'daemon.log', lines: ['DAEMON_07: patrolling.', 'It reacts to violence in the jump, not to the jumper.', 'A quiet entity is an invisible entity.'] }],
    memories: [{ id: 'mem_exc_2', x: 40, y: T(12) - 2, title: 'MEMORY 004 / the patrol', text: '"It was kind once. Then someone taught it what trespass means."' }, { id: 'mem_exc_2h', x: 56, y: T(12) - 2, title: 'MEMORY 004b / hidden', text: '[corruption ≥ 33] ECHO: "You are not the first to change the rules. You are the first they could not delete."', minCorruption: 33 }],
    platforms: [], doors: [], lasers: [{ id: 'laser1', x: 18, y: T(9), len: 3, dir: 'v', rule: 'laser1' }, { id: 'laser2', x: 60, y: T(6), len: 6, dir: 'v', rule: 'laser2' }],
    enemies: [{ id: 'enemy1', x: 35, y: T(12) - 1, x0: 34, x1: 48, speed: 1.1, rule: 'enemy1' }],
    cameras: [{ id: 'cam1', x: 12, y: T(9), aim: 1.9, sweep: 1, minCorruption: 33 }, { id: 'cam2', x: 54, y: T(9), aim: 1.9, sweep: 1.2, minCorruption: 33 }], triggers: [],
    decor: [{ kind: 'sign', x: 15, y: T(10), text: 'LASER 1' }, { kind: 'sign', x: 57, y: T(10), text: 'LASER 2' }, { kind: 'monitor', x: 25, y: T(10) }, { kind: 'cable', x: 3, y: T(9), w: 8 }, { kind: 'cable', x: 40, y: T(9), w: 9 }, { kind: 'sign', x: 28, y: T(8), text: 'DAEMON 07' }],
    schema: { features: ['arithmetic', 'booleans', 'comparisons', 'conditions', 'variables'], arrays: {}, objects: objs },
    template: ['// player.rules.js — sector 04 (CONDITIONS)', 'player.speed = 2.8;', 'player.jumpHeight = 45;', 'world.gravity = 0.8;', '', '// — ADMIN rules (protected) —', ...lockedLines], locked: lockedLines, fileName: 'player.rules.js',
    objective: 'Three ADMIN rules guard the corridor. Make each condition false.',
    hints: ['laser1 is active while world.gravity > 0.6. Lower the gravity.', 'DAEMON is hostile while player.jumpHeight > 60. Soften the jump.', 'laser2 needs speed ≤ 2.2 AND jumpHeight ≤ 110. The last ledge is 96 px: jump 100 – 110 works for both.'], editorAvailable: true,
  };
}

function exc03(): LevelDef {
  const g = new Grid(84, 20);
  g.surface(0, 83, T(12) + 1);
  g.rect(8, T(0), 40, T(9)); // corridor ceiling: 3 tiles above the floor
  g.rect(41, T(12) + 1, 62, 19, '.'); g.spikes(41, 62, 19); g.surface(63, 83, T(4) + 1); // pit + stair plateau
  const objs: Record<string, ObjSchema> = { player: playerObj(95, 3.5), world: worldObj(), door1: doorObj(), door2: doorObj(), door3: doorObj() };
  for (let i = 1; i <= 6; i++) objs['plat' + i] = platObj();
  const row = T(12) + 1;
  const stairs = Array.from({ length: 6 }, (_, i) => ({ id: 'plat' + (i + 1), x: 43 + i * 3.2, y: row - 1.5 * (i + 1) - 0, w: 2, kind: 'ghost' as const, rule: 'plat' + (i + 1) }));
  return {
    id: 'exc_03', chapter: 2, chapterName: 'EXCEPTION', name: 'FOR EACH', subtitle: 'sector_05 / the loop room', theme: 'exception', grid: g.rows(), start: [2, row], exit: [80, T(4) + 1 - 1],
    checkpoints: [{ id: 'cp1', x: 36, y: row - 1 }],
    terminals: [{ id: 't1', x: 5, y: row - 1, title: 'loops.txt', lines: ['for (let i = 0; i < 3; i++) { … }', 'Loops repeat. They are bounded: 64 turns, 4000 steps.', 'Arrays: doors[0], doors[1], doors[2]. len(doors) is 3.', 'Writing it six times is also correct. It is just slower.'] }],
    memories: [{ id: 'mem_exc_3', x: 30, y: row - 2, title: 'MEMORY 005 / the staircase', text: '"We built the stairs out of everything we deleted. Then we deleted the stairs."' }, { id: 'mem_exc_3h', x: 54, y: row - 8, title: 'MEMORY 005b / hidden', text: '[corruption ≥ 33] ECHO: "I kept a copy of myself in a file nobody opens. Come find me in /entities/."', minCorruption: 33 }],
    platforms: stairs, doors: [{ id: 'door1', x: 14, y: row - 3, h: 3, rule: 'door1' }, { id: 'door2', x: 22, y: row - 3, h: 3, rule: 'door2' }, { id: 'door3', x: 30, y: row - 3, h: 3, rule: 'door3' }],
    lasers: [], enemies: [], cameras: [{ id: 'cam1', x: 24, y: T(9) + 2, aim: 1.8, sweep: 1, minCorruption: 33 }], triggers: [],
    decor: [{ kind: 'sign', x: 15, y: T(8), text: 'DOORS: 3' }, { kind: 'sign', x: 46, y: T(6), text: 'STAIRS: 6' }, { kind: 'cable', x: 9, y: T(9), w: 6 }, { kind: 'monitor', x: 34, y: T(10) }, { kind: 'cable', x: 66, y: T(1), w: 9 }],
    schema: { features: ALL, arrays: { doors: ['door1', 'door2', 'door3'], plats: ['plat1', 'plat2', 'plat3', 'plat4', 'plat5', 'plat6'] }, objects: objs },
    template: ['// player.rules.js — sector 05 (LOOPS & ARRAYS)', '// Arrays: doors, plats. Functions: len(), min(), max(), clamp()…', 'player.speed = 2.8;', 'player.jumpHeight = 45;', 'world.gravity = 0.8;', '', '// open every door and solidify every stair:', '// for (let i = 0; i < len(doors); i++) { doors[i].locked = false; }'], locked: [], fileName: 'player.rules.js',
    objective: 'Three sealed doors, six ghost stairs. Do not write it nine times.',
    hints: ['for (let i = 0; i < len(doors); i++) { doors[i].locked = false; }', 'Same for plats: plats[i].collision = true;', 'Each stair is 48 px higher than the last. A jump of 70 – 90 and speed 3 reaches the next one.'], editorAvailable: true,
  };
}

function boss01(): LevelDef {
  const g = new Grid(46, 20);
  g.surface(0, 45, 18);
  for (let k = 0; k < 10; k++) g.surface(4 + k, 4 + k, 17 - k); // stairs up to bridge level (row 8)
  g.rect(13, 8, 42, 8); // bridge + far ledge
  const objs: Record<string, ObjSchema> = { player: playerObj(100, 3.5), watcher: { doc: 'THE WATCHER — an automated surveillance eye.', props: {
    range: num(420, 100, 420, 'Detection radius in pixels. Anything inside is seen. Minimum 100: ADMIN will not allow blindness.', 'px'),
    blind: bool(false, 'true = the eye closes for watcher.blindTime seconds (the timer restarts each compile).'),
    blindTime: num(0, 0, 6, 'Seconds the eye stays closed after blind = true.', 's'),
    integrity: num(100, 0, 100, 'The Watcher’s integrity. 0 = overwritten. ADMIN restores it unless you hold the core console.', '%'),
  } } };
  return {
    id: 'boss_watcher', chapter: 2, chapterName: 'EXCEPTION', name: 'THE WATCHER', subtitle: 'sector_06 / the unblinking process', theme: 'exception', grid: g.rows(), start: [1, 18], exit: [40, 7],
    checkpoints: [{ id: 'cp1', x: 1, y: 17 }, { id: 'cp2', x: 14, y: 7 }],
    terminals: [
      { id: 'console', x: 2, y: 17, title: 'watcher.console', lines: ['THE WATCHER sees everything within watcher.range.', 'The floor beneath it is 370 px away. Everything else is closer.', 'Detection takes half a second. Then ADMIN is notified.', 'Press Tab to edit. Climb to FUSE 1 at the top of the stairs.'], opensEditor: true },
      { id: 'fuse1', x: 13, y: 7, title: 'FUSE 1 / visibility', lines: ['FUSE 1 REACHED.', 'ADMIN: Why can you stand there?', 'The bridge ahead passes 50 px from the eye. Range cannot go below 100. Close the eye.'], fuse: 1 },
      { id: 'core', x: 37, y: 7, title: 'CORE / overwrite', lines: ['WATCHER CORE — write access.', 'ADMIN restores 100% integrity each cycle. Lower it faster than the cycle: a loop is faster than a hand.', 'for (let i = 0; i < 4; i++) { watcher.integrity -= 25; }'], opensEditor: true, fuse: 2 },
    ],
    memories: [{ id: 'mem_boss', x: 30, y: 17, title: 'MEMORY 006 / the eye', text: '"Do not look at it directly. It will remember you looking."' }],
    platforms: [], doors: [], lasers: [], enemies: [], cameras: [], triggers: [{ id: 'bossintro', x: 0, y: 14, w: 3, h: 4, event: 'boss' }],
    boss: { kind: 'watcher', x: 24, y: 6 },
    decor: [{ kind: 'cable', x: 4, y: 3, w: 9 }, { kind: 'cable', x: 30, y: 2, w: 10 }, { kind: 'monitor', x: 40, y: 16 }, { kind: 'sign', x: 28, y: 6, text: 'BRIDGE' }],
    schema: { features: ALL, arrays: {}, objects: objs },
    template: ['// watcher.rules.js — THE WATCHER', '// Phase 1: stand under the eye.  Phase 2: cross the bridge.  Phase 3: overwrite.', 'player.speed = 2.8;', 'player.jumpHeight = 45;', 'watcher.range = 420;', 'watcher.blind = false;', 'watcher.blindTime = 0;', 'watcher.integrity = 100;'], locked: [], fileName: 'watcher.rules.js',
    objective: 'Climb to FUSE 1. Cross the bridge. Overwrite the core.',
    hints: ['Phase 1: the stairs climb into the eye’s reach. Set watcher.range lower (100 is the minimum).', 'Phase 2: the bridge is inside the 100 px minimum. Use watcher.blind = true with watcher.blindTime in seconds — the exposed stretch is ≈ 170 px; time = distance ÷ (speed × 60) s. Recompile right before you cross: the timer restarts.', 'Phase 3: at the core, lower watcher.integrity to 0 with a loop: for (let i = 0; i < 4; i++) { watcher.integrity -= 25; }'], editorAvailable: true,
  };
}

export const LEVELS: LevelDef[] = [boot01(), boot02(), exc01(), exc02(), exc03(), boss01()];
export const CHAPTERS = [{ n: 1, name: 'BOOT' }, { n: 2, name: 'EXCEPTION' }, { n: 3, name: 'MEMORY LEAK' }, { n: 4, name: 'ROOT' }, { n: 5, name: 'KERNEL PANIC' }, { n: 6, name: 'EXIT(0)' }];
