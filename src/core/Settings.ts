export interface Settings {
  music: number; sfx: number; reducedMotion: boolean; crt: boolean; flashes: boolean; dialogueSpeed: number; textScale: number;
  highContrast: boolean; subtitles: boolean; hints: boolean; exitUrl: string;
  keys: Record<string, string[]>;
}
export const DEFAULT_KEYS: Record<string, string[]> = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], jump: ['Space', 'ArrowUp', 'KeyW'], interact: ['KeyE', 'Enter'], edit: ['Tab', 'KeyQ'], debug: ['F3', 'KeyB'], pause: ['Escape', 'KeyP'], restart: ['KeyR'],
};
export const KEY_LABELS: Record<string, string> = { left: 'Move left', right: 'Move right', jump: 'Jump', interact: 'Interact / read', edit: 'Open source editor', debug: 'Debug overlay', pause: 'Pause', restart: 'Respawn' };
const KEY = 'source-code.settings.v1';
const defaults = (): Settings => ({ music: 0.6, sfx: 0.8, reducedMotion: matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, crt: true, flashes: true, dialogueSpeed: 1, textScale: 1, highContrast: false, subtitles: true, hints: true, exitUrl: '', keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)) });
export const settings: Settings = (() => {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = { ...defaults(), ...JSON.parse(raw) }; s.keys = { ...DEFAULT_KEYS, ...s.keys }; return s; } } catch { /* ignore */ }
  return defaults();
})();
const listeners = new Set<() => void>();
export function onSettings(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ } listeners.forEach(f => f()); applyBodyClasses(); }
export function applyBodyClasses() {
  const b = document.body;
  b.classList.toggle('reduced-motion', settings.reducedMotion); b.classList.toggle('no-crt', !settings.crt); b.classList.toggle('high-contrast', settings.highContrast);
  b.style.setProperty('--text-scale', String(settings.textScale));
}
