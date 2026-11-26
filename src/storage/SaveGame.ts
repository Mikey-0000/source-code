// Save data with schema versioning, checksum and an automatic backup slot so a corrupted write can never brick progress.
export interface SaveData {
  v: 1; levelIndex: number; checkpoint: Record<string, { x: number; y: number }>; rules: Record<string, string>; corruption: number; flags: Record<string, boolean | number | string>;
  memories: string[]; completed: string[]; stats: { deaths: number; compiles: number; playMs: number }; editorRevealed: boolean; savedAt: number;
}
const KEY = 'source-code.save.v1', BACKUP = 'source-code.save.backup';
export const emptySave = (): SaveData => ({ v: 1, levelIndex: 0, checkpoint: {}, rules: {}, corruption: 0, flags: {}, memories: [], completed: [], stats: { deaths: 0, compiles: 0, playMs: 0 }, editorRevealed: false, savedAt: 0 });
function sum(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
export function validateSave(d: unknown): d is SaveData {
  if (!d || typeof d !== 'object') return false; const s = d as SaveData;
  return s.v === 1 && Number.isInteger(s.levelIndex) && s.levelIndex >= 0 && s.levelIndex < 64 && typeof s.corruption === 'number' && s.corruption >= 0 && s.corruption <= 100 && typeof s.rules === 'object' && Array.isArray(s.memories) && Array.isArray(s.completed) && typeof s.flags === 'object';
}
export function encodeSave(d: SaveData): string { const body = JSON.stringify(d); return sum(body) + ':' + body; }
export function decodeSave(raw: string | null): SaveData | null {
  if (!raw) return null; const i = raw.indexOf(':'); if (i < 0) return null; const body = raw.slice(i + 1);
  if (sum(body) !== raw.slice(0, i)) return null;
  try { const d = JSON.parse(body); return validateSave(d) ? d : null; } catch { return null; }
}
export function writeSave(d: SaveData) {
  try { d.savedAt = Date.now(); const prev = localStorage.getItem(KEY); const enc = encodeSave(d); if (prev && decodeSave(prev)) localStorage.setItem(BACKUP, prev); localStorage.setItem(KEY, enc); } catch { /* quota or disabled */ }
}
export function loadSave(): SaveData | null { try { return decodeSave(localStorage.getItem(KEY)) ?? decodeSave(localStorage.getItem(BACKUP)); } catch { return null; } }
export function hasSave() { return loadSave() !== null; }
export function wipeSave() { try { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); } catch { /* ignore */ } }
