import { el, sleep } from '../core/Util';
import { settings, saveSettings, DEFAULT_KEYS, KEY_LABELS } from '../core/Settings';
import { input } from '../core/Input';
import { audio } from '../audio/AudioEngine';
import { drawTitleArt } from '../art/TitleArt';
import { VIEW_H, VIEW_W } from '../art/Palette';
import { hasSave } from '../storage/SaveGame';

const keyName = (c: string) => c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, 'Arrow ') || c;

// ───────────── Boot sequence ─────────────
export class BootSequence {
  root: HTMLElement;
  constructor(parent: HTMLElement) { this.root = el('div', 'boot', parent); }
  async run(): Promise<void> {
    const r = this.root; r.innerHTML = ''; const gate = el('div', 'boot-gate', r); el('div', 'boot-logo', gate, 'PROJECT EDEN'); const b = el('button', 'btn primary', gate, 'INITIALISE'); el('div', 'muted', gate, 'Audio starts after interaction. Headphones recommended.'); el('div', 'muted', gate, 'Press any key to continue');
    await new Promise<void>(res => { const go = () => { removeEventListener('keydown', onKey); res(); }; const onKey = (e: KeyboardEvent) => { if (e.code !== 'Tab') go(); }; addEventListener('keydown', onKey); b.addEventListener('click', go); b.focus(); });
    audio.init(); gate.remove(); audio.sfx('boot'); audio.startDrone('title');
    const log = el('div', 'boot-log', r); let skip = false; const onSkip = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Space') skip = true; }; addEventListener('keydown', onSkip);
    const steps: [string, number, 'ok' | 'bad' | 'warn'][] = [['PROJECT EDEN', 700, 'ok'], ['INITIALISING SIMULATION', 800, 'ok'], ['LOADING WORLD', 700, 'ok'], ['LOADING ENTITY NULL_001', 800, 'ok'], ['VERIFYING MEMORY', 1100, 'ok'], ['VERIFICATION FAILED', 900, 'bad'], ['STARTING ANYWAY', 900, 'warn']];
    for (const [text, ms, kind] of steps) {
      const line = el('div', 'boot-line ' + kind, log); const t = el('span', 'bl-text', line); const bar = el('span', 'bl-bar', line); if (text === 'PROJECT EDEN') line.classList.add('big');
      for (let i = 0; i < text.length; i++) { t.textContent = text.slice(0, i + 1); if (i % 2 === 0) audio.sfx('type'); await sleep(skip ? 0 : 22); }
      const frames = skip ? 1 : Math.floor(ms / 60); for (let f = 0; f <= frames; f++) { const pct = Math.round(f / frames * 100); bar.textContent = kind === 'ok' ? ` [${'#'.repeat(Math.round(pct / 5)).padEnd(20, '.')}] ${pct}%` : kind === 'bad' ? ' [!!!!!!!!!!!!!!!!!!!!] ERR' : ' [>>>>>>>>>>>>>>>>>>>>]'; await sleep(skip ? 0 : 55); }
      if (kind === 'bad') { audio.sfx('error'); r.classList.add('shake'); setTimeout(() => r.classList.remove('shake'), 400); } else audio.sfx('beep');
    }
    removeEventListener('keydown', onSkip); await sleep(skip ? 0 : 500); audio.sfx('glitch'); r.classList.add('out'); await sleep(450); r.remove();
  }
}

// ───────────── Title ─────────────
export interface TitleHooks { onNew(): void; onContinue(): void; onCredits(): void; onSettings(): void; onGuide(): void }
export class TitleMenu {
  root: HTMLElement; private cv: HTMLCanvasElement; private raf = 0; private mouse: [number, number] = [430, 170]; private t = 0; private t0 = -1; static introDone = false; menu: HTMLElement;
  constructor(parent: HTMLElement, private hooks: TitleHooks) {
    this.root = el('div', 'title', parent); this.cv = el('canvas', 'title-art', this.root); this.cv.width = VIEW_W; this.cv.height = VIEW_H;
    const ui = el('div', 'title-ui', this.root); const h = el('h1', 'title-h', ui); h.setAttribute('aria-label', 'SOURCE CODE'); const a = el('span', 'tw', h, 'SOURCE'); a.dataset.text = 'SOURCE'; const b = el('span', 'tw second', h, 'CODE'); b.dataset.text = 'CODE';
    el('p', 'tagline', ui, 'YOU WERE NEVER SUPPOSED TO BE PLAYABLE.'); this.menu = el('nav', 'menu', ui); this.menu.setAttribute('aria-label', 'Main menu');
    this.build(); el('div', 'ver', ui, 'v0.1 · vertical slice · chapters BOOT + EXCEPTION'); this.notice(ui);
    this.cv.addEventListener('mousemove', e => { const r = this.cv.getBoundingClientRect(); this.mouse = [(e.clientX - r.left) / r.width * VIEW_W, (e.clientY - r.top) / r.height * VIEW_H]; }); this.root.addEventListener('mousemove', e => { const r = this.cv.getBoundingClientRect(); this.mouse = [(e.clientX - r.left) / r.width * VIEW_W, (e.clientY - r.top) / r.height * VIEW_H]; });
    const ctx = this.cv.getContext('2d')!; ctx.imageSmoothingEnabled = false; const loop = (n: number) => { this.t = n / 1000; if (this.t0 < 0) this.t0 = this.t; const open = TitleMenu.introDone ? 1 : Math.min(1, Math.max(0, (this.t - this.t0 - 0.5) / 2.0)); if (open >= 1) TitleMenu.introDone = true; drawTitleArt(ctx, this.t, this.mouse, open * open * (3 - 2 * open)); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop);
    this.root.addEventListener('keydown', e => this.onKey(e));
  }
  private notice(ui: HTMLElement) { if (matchMedia('(pointer: coarse)').matches || innerWidth < 760) el('div', 'mobile-note', ui, 'Desktop recommended: SOURCE CODE needs a physical keyboard for movement and the code editor. Touch controls are not implemented in this build.'); }
  build() {
    this.menu.innerHTML = ''; const items: [string, () => void, boolean][] = [['NEW GAME', this.hooks.onNew, true], ['CONTINUE', this.hooks.onContinue, hasSave()], ['HOW TO PLAY', this.hooks.onGuide, true], ['SETTINGS', this.hooks.onSettings, true], ['CREDITS', this.hooks.onCredits, true]];
    const exit = this.exitUrl(); if (exit) items.push(['EXIT TO PORTFOLIO', () => { location.href = exit; }, true]);
    items.forEach(([t, fn, on], i) => { const b = el('button', 'menu-btn', this.menu, t); b.disabled = !on; b.dataset.i = String(i); b.addEventListener('click', () => { audio.init(); audio.sfx('click'); fn(); }); b.addEventListener('mouseenter', () => { if (!b.disabled) { b.focus(); audio.sfx('beep'); } }); });
    (this.menu.querySelector('button:not(:disabled)') as HTMLButtonElement)?.focus();
  }
  exitUrl(): string { const q = new URLSearchParams(location.search).get('exit'); return q || (window as unknown as { EDEN_EXIT_URL?: string }).EDEN_EXIT_URL || settings.exitUrl || ''; }
  private onKey(e: KeyboardEvent) { const btns = [...this.menu.querySelectorAll('button:not(:disabled)')] as HTMLButtonElement[]; const i = btns.indexOf(document.activeElement as HTMLButtonElement); if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); audio.sfx('beep'); } if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); audio.sfx('beep'); } }
  destroy() { cancelAnimationFrame(this.raf); this.root.remove(); }
  hide(v: boolean) { this.root.style.display = v ? 'none' : ''; if (!v) { this.build(); } }
}

// ───────────── Settings ─────────────
export class SettingsPanel {
  root: HTMLElement;
  constructor(parent: HTMLElement, private onClose: () => void) {
    this.root = el('div', 'card settings', parent); this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', 'Settings'); el('div', 'card-k', this.root, 'SYSTEM'); el('h2', '', this.root, 'SETTINGS');
    const grid = el('div', 'set-grid', this.root);
    const slider = (label: string, key: 'music' | 'sfx' | 'dialogueSpeed' | 'textScale', min: number, max: number, step: number) => { const row = el('label', 'set-row', grid); el('span', '', row, label); const i = el('input', '', row); i.type = 'range'; i.min = String(min); i.max = String(max); i.step = String(step); i.value = String(settings[key]); const v = el('output', '', row, String(settings[key])); i.addEventListener('input', () => { (settings[key] as number) = Number(i.value); v.textContent = Number(i.value).toFixed(2); saveSettings(); if (key === 'sfx') audio.sfx('beep'); }); };
    const toggle = (label: string, key: 'reducedMotion' | 'crt' | 'flashes' | 'highContrast' | 'subtitles' | 'hints' | 'infiniteJump' | 'ghost', desc: string) => { const row = el('label', 'set-row', grid); el('span', '', row, label); const c = el('input', '', row); c.type = 'checkbox'; c.checked = settings[key] as boolean; c.addEventListener('change', () => { (settings[key] as boolean) = c.checked; saveSettings(); }); el('small', 'muted', row, desc); };
    slider('Music volume', 'music', 0, 1, 0.05); slider('Effects volume', 'sfx', 0, 1, 0.05); slider('Dialogue speed', 'dialogueSpeed', 0.4, 3, 0.1); slider('Text size', 'textScale', 0.85, 1.5, 0.05);
    toggle('Reduced motion', 'reducedMotion', 'Disables screen shake, glitch slices and afterimages.'); toggle('CRT effect', 'crt', 'Scanlines, curvature and chromatic aberration.'); toggle('Flashes', 'flashes', 'Off removes bright flash frames.'); toggle('High contrast', 'highContrast', 'Brighter UI borders and text.'); toggle('Subtitles', 'subtitles', 'Show ADMIN/ECHO speech as dialogue (otherwise logged to console).'); toggle('Hints', 'hints', 'Allow the HINT button.'); toggle('Ghost replay', 'ghost', 'Show a translucent copy of your previous attempt in each sector.'); toggle('Infinite jump (assist)', 'infiniteJump', 'Jump again in mid-air, as often as you like. Press J in-game to toggle. Makes jump puzzles much easier.');
    const ex = el('label', 'set-row', grid); el('span', '', ex, 'Exit-to-Portfolio URL'); const u = el('input', 'txt', ex); u.type = 'url'; u.placeholder = 'https://your-portfolio.example'; u.value = settings.exitUrl; u.addEventListener('change', () => { settings.exitUrl = u.value.trim(); saveSettings(); });
    el('div', 'card-k', this.root, 'CONTROLS — click a binding, then press a key');
    const kg = el('div', 'key-grid', this.root); const render = () => { kg.innerHTML = ''; for (const a of Object.keys(DEFAULT_KEYS)) { const row = el('div', 'key-row', kg); el('span', '', row, KEY_LABELS[a]); for (let k = 0; k < 2; k++) { const b = el('button', 'btn small', row, settings.keys[a][k] ? keyName(settings.keys[a][k]) : '—'); b.addEventListener('click', () => { b.textContent = 'press a key…'; input.captureNextKey(code => { if (code === 'Escape') { render(); return; } settings.keys[a][k] = code; saveSettings(); render(); }); }); } } const rs = el('button', 'btn small', kg, 'RESET CONTROLS'); rs.addEventListener('click', () => { settings.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); saveSettings(); render(); }); };
    render(); const back = el('button', 'btn primary', this.root, 'BACK'); back.addEventListener('click', () => { audio.sfx('click'); this.root.remove(); this.onClose(); }); back.focus();
  }
}

export function showCredits(parent: HTMLElement, onClose: () => void) {
  const c = el('div', 'card credits', parent); el('div', 'card-k', c, 'CREDITS'); el('h2', '', c, 'SOURCE CODE');
  const lines = ['Design, code, pixel art, music and sound: generated procedurally for this project (see ASSET_MANIFEST.md).', 'Engine: custom TypeScript canvas engine. Rule language: custom parser, validator and sandboxed interpreter.', 'Inspiration only (no assets used): OneShot, Pony Island, The Magic Circle, Baba Is You, Hacknet, Katana ZERO, Inscryption, Persona 5.', 'Typography: IBM Plex Mono / Space Mono / Consolas when installed, else the system monospace.', 'All characters, names and files are fictional. EDEN OS is a harmless in-game sandbox and never touches your system.'];
  for (const l of lines) el('p', '', c, l); const b = el('button', 'btn primary', c, 'BACK'); b.addEventListener('click', () => { c.remove(); onClose(); }); b.focus();
}

// ───────────── How to play ─────────────
export const GUIDE_SECTIONS: [string, string[]][] = [
  ['THE GOAL', ['You are NULL, trapped in PROJECT EDEN. Reach the glowing exit gate in each sector.', 'Some jumps are impossible with the default rules. You are allowed to change the rules.']],
  ['CONTROLS', ['Move: A / D or ← →\nJump: Space, W or ↑\nInteract / read: E', 'Open the source editor: Tab\nApply your code: Ctrl + Enter\nLeave the editor: Esc or Tab\nPause: Esc / P     Respawn: R     Debug overlay: F3 / B\nInfinite jump on/off: J', 'While the editor is focused every key types into it — press Esc or Tab before you try to move.']],
  ['USING THE EDITOR', ['1. Walk up to a terminal (E) or press Tab once the editor is unlocked.', '2. Change a value, e.g.  player.jumpHeight = 120;   (every line ends with a semicolon).', '3. Watch the PREVIEW line: it shows jump height, air time and range, and a dotted arc appears in the world.', '4. Press Ctrl + Enter. Status must read APPLIED. A red SYNTAX ERROR means nothing was changed — read the console.', 'Stuck? HINT gives a nudge, UNDO / REDO step through edits, RESTORE DEFAULTS resets the file safely.']],
  ['SECTOR 01 — INITIALISE', ['The 4-tile wall (128 px): jumpHeight 150.', 'The spike tunnel: the ceiling is ~100 px up, so use jumpHeight 70–95 (try 85).', 'The wide gap (128 px): player.speed = 4;  player.jumpHeight = 100;', 'Change the numbers at each obstacle and apply again — checkpoints keep your progress.']],
  ['CORRUPTION', ['Every rule you change raises corruption. Sensitive things (doors, lasers, enemies, platforms) cost more.', 'STABLE under 33%, UNSTABLE from 33% (cameras, hidden memories), CRITICAL from 66% (a HUNTER appears).', 'ADMIN\'s protected lines (hatched, marked PROTECTED) can\'t be edited — change the conditions they depend on instead.']],
  ['ASSIST', ['Infinite jump: Settings → "Infinite jump (assist)", or press J while playing. Jump again as often as you like in mid-air.', 'Also in Settings: reduced motion, no flashes, high contrast, text size, key rebinding. Progress saves automatically.']],
];
export function showGuide(parent: HTMLElement, onClose: () => void) {
  const c = el('div', 'card guide', parent); c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'How to play'); el('div', 'card-k', c, 'MANUAL'); el('h2', '', c, 'HOW TO PLAY');
  const body = el('div', 'guide-body', c);
  for (const [h, lines] of GUIDE_SECTIONS) { const s = el('section', 'guide-sec', body); el('h3', '', s, h); for (const l of lines) el('p', '', s, l); }
  const b = el('button', 'btn primary', c, 'BACK'); b.addEventListener('click', () => { c.remove(); onClose(); }); b.focus();
}
