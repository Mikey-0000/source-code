// Pure scoring + rule-diff helpers (unit-tested). Reward: fast, few deaths, few edits, low corruption, memories found.
export interface RunStats { ms: number; deaths: number; edits: number; corruption: number; memories: number }
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';
export interface Score { total: number; rank: Rank; parts: { label: string; value: number }[] }
export const BASE_SCORE = 1000;
export function rankOf(total: number): Rank { return total >= 1000 ? 'S' : total >= 800 ? 'A' : total >= 600 ? 'B' : total >= 400 ? 'C' : 'D'; }
export function scoreRun(s: RunStats): Score {
  const parts = [
    { label: 'Base', value: BASE_SCORE },
    { label: `Time ${Math.round(s.ms / 1000)} s`, value: -Math.round(Math.min(400, Math.max(0, s.ms / 1000 - 30) * 2)) },
    { label: `Deaths ${s.deaths}`, value: -Math.min(300, s.deaths * 40) },
    { label: `Edits ${s.edits}`, value: -Math.min(250, Math.max(0, s.edits - 3) * 15) },
    { label: `Corruption ${Math.round(s.corruption)}%`, value: -Math.round(Math.min(300, s.corruption * 3)) },
    { label: `Memories ${s.memories}`, value: s.memories * 100 },
  ];
  const total = Math.max(0, parts.reduce((a, p) => a + p.value, 0));
  return { total, rank: rankOf(total), parts };
}
/** Changed code lines between the level's default file and what the player applied (comments and blanks ignored). */
export function diffRules(template: string[], applied: string): { kind: '-' | '+'; text: string }[] {
  const A = applied.split('\n'); const out: { kind: '-' | '+'; text: string }[] = []; const code = (l: string | undefined) => l !== undefined && l.trim() !== '' && !l.trim().startsWith('//');
  for (let i = 0; i < Math.max(template.length, A.length); i++) { const a = template[i], b = A[i]; if (a === b) continue; if (code(a)) out.push({ kind: '-', text: a!.trim() }); if (code(b)) out.push({ kind: '+', text: b!.trim() }); }
  return out;
}
