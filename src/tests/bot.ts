import { World, type InputState } from '../game/systems/World';
import type { LevelDef } from '../game/levels/LevelTypes';
import { compileRules } from '../editor/RuleInterpreter';
import { defaultState } from '../editor/RuleSchema';

export function stateFor(level: LevelDef, src: string | null) {
  if (src === null) return defaultState(level.schema);
  const source = level.locked.length ? src + '\n' + level.locked.join('\n') : src;
  const r = compileRules({ source, schema: level.schema, lockedLines: level.locked });
  if (!r.ok) throw new Error('compile failed: ' + JSON.stringify(r.errors));
  return r.state;
}
/** Greedy runner: runs right, jumps at walls and gaps. Waits on moving platforms until they reach the far side. */
export function runBot(level: LevelDef, src: string | null, maxFrames = 4000, opts: { probe?: number; corruption?: number; schedule?: { x: number; src: string }[] } = {}) {
  const w = new World(level, stateFor(level, src), undefined, opts.corruption ?? 0); const sched = [...(opts.schedule ?? [])].sort((a, b) => a.x - b.x);
  let jumpPrev = false; let maxX = w.x; let frames = 0; const probe = opts.probe ?? 7;
  const solidAt = (x: number, y: number) => w.solidTile(Math.floor(x / 32), Math.floor(y / 32)) || w.dynamicSolids().some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (; frames < maxFrames && !w.exited; frames++) {
    while (sched.length && w.x > sched[0].x * 32) w.applyRules(stateFor(level, sched.shift()!.src));
    let right = true, jump = false;
    if (w.dead === 0) {
      const frontX = w.x + 14 + 3;
      const wallAhead = solidAt(frontX, w.y + 12) || solidAt(frontX, w.y + 24);
      const groundAhead = solidAt(w.x + probe, w.y + 28 + 3);
      if (w.onGround && (wallAhead || !groundAhead)) jump = true;
      if (w.riding && w.riding.def.kind === 'moving' && w.riding.def.to) {
        const p = w.riding; const dest = p.def.to![0] * 32; right = Math.abs(p.x - dest) < 20 && Math.abs(p.y - p.def.to![1] * 32) < 24 ? true : false;
        if (!right) jump = false;
      }
    }
    const inp: InputState = { left: false, right, jumpHeld: jump || !w.onGround, jumpPressed: jump && !jumpPrev };
    jumpPrev = jump; w.update(inp); maxX = Math.max(maxX, w.x);
  }
  return { world: w, exited: w.exited, frames, maxX, deaths: w.stats.deaths };
}
