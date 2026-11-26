import type { LevelDef } from '../levels/LevelTypes';
import { defaultState, type RuleState } from '../../editor/RuleSchema';
/** Deterministic corruption: a pure function of which rule values differ from defaults (no randomness, no time, no retries). */
const SENSITIVE = /^(door|laser|enemy|plat|watcher|cam)/;
export function contribution(level: LevelDef, state: RuleState): number {
  const base = defaultState(level.schema); let c = 0;
  for (const [o, props] of Object.entries(state)) for (const [p, v] of Object.entries(props)) if (base[o][p] !== v) c += SENSITIVE.test(o) ? 4 : 2;
  return c;
}
export const stageOf = (c: number) => (c >= 66 ? 2 : c >= 33 ? 1 : 0);
export const STAGE_NAMES = ['STABLE', 'UNSTABLE', 'CRITICAL'];
export const STAGE_TEXT = [
  'Stable: the simulation tolerates you.',
  'Unstable: glitches appear, ADMIN security cameras wake, and hidden memory fragments surface along alternate paths.',
  'Critical: the world distorts, ADMIN dispatches a HUNTER process to every sector, and deleted memories become reachable.',
];
