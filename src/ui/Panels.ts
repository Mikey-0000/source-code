import { el, sleep } from '../core/Util';
import { settings } from '../core/Settings';
import { audio } from '../audio/AudioEngine';
import { input } from '../core/Input';
import { CodeEditor } from '../editor/CodeEditor';
import { FEATURE_INFO, type RuleSchema, type RuleState } from '../editor/RuleSchema';
import type { LevelDef } from '../game/levels/LevelTypes';
import type { RuleError } from '../editor/RuleValidator';
import { airTime, heightAt } from '../game/physics/Physics';

// ───────────── HUD ─────────────
export class Hud {
  root: HTMLElement; private integ: HTMLElement; private integTxt: HTMLElement; private corrFill: HTMLElement; private corrTxt: HTMLElement; private obj: HTMLElement; private loc: HTMLElement; private promptEl: HTMLElement; private timer: HTMLElement; private timerFill: HTMLElement; private timerTxt: HTMLElement; private hint: HTMLElement; private toastEl: HTMLElement; private card: HTMLElement; private bossBar: HTMLElement; private bossFill: HTMLElement;
  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent);
    const tl = el('div', 'hud-tl', this.root); el('div', 'hud-name', tl, 'NULL_001');
    const ib = el('div', 'bar integ', tl); this.integ = el('div', 'fill', ib); this.integTxt = el('span', 'bar-txt', ib, '100%');
    el('div', 'hud-label', tl, 'INTEGRITY'); const cb = el('div', 'bar corr', tl); this.corrFill = el('div', 'fill', cb); this.corrTxt = el('span', 'bar-txt', cb, 'CORRUPTION 0%');
    const tr = el('div', 'hud-tr', this.root); this.loc = el('div', 'hud-loc', tr); this.obj = el('div', 'hud-obj', tr);
    this.promptEl = el('div', 'hud-prompt', this.root); this.promptEl.hidden = true;
    this.timer = el('div', 'hud-timer', this.root); this.timer.hidden = true; el('div', 'hud-label', this.timer, 'TIMED CHALLENGE — EYE CLOSED'); const tb = el('div', 'bar timer', this.timer); this.timerFill = el('div', 'fill', tb); this.timerTxt = el('span', 'bar-txt', tb, '');
    this.bossBar = el('div', 'hud-boss', this.root); this.bossBar.hidden = true; el('div', 'hud-label', this.bossBar, 'THE WATCHER — INTEGRITY'); const bb = el('div', 'bar boss', this.bossBar); this.bossFill = el('div', 'fill', bb);
    this.hint = el('div', 'hud-hint', this.root); this.hint.hidden = true;
    this.toastEl = el('div', 'hud-toast', this.root); this.card = el('div', 'hud-card', this.root); this.card.hidden = true;
  }
  setIntegrity(n: number) { const v = Math.max(0, Math.round(n)); this.integ.style.width = v + '%'; this.integTxt.textContent = v + '%'; this.integ.classList.toggle('low', v <= 34); }
  setCorruption(n: number, stage: string) { this.corrFill.style.width = Math.min(100, n) + '%'; this.corrTxt.textContent = `CORRUPTION ${Math.round(n)}% · ${stage}`; this.corrFill.dataset.stage = stage; }
  private objText = ''; private locText = '';
  setObjective(t: string) { this.objText = t; this.obj.textContent = t; }
  setLocation(t: string) { this.locText = t; this.loc.textContent = t; }
  /** Briefly corrupt HUD text (swap some letters for glitch glyphs), then restore it. */
  glitchText(amount: number) {
    const G = '█▓▒░#%&@01<>/\\'; const bad = (t: string) => t.replace(/[A-Za-z0-9]/g, ch => Math.random() < amount ? G[Math.floor(Math.random() * G.length)] : ch);
    this.obj.textContent = bad(this.objText); this.loc.textContent = bad(this.locText); setTimeout(() => { this.obj.textContent = this.objText; this.loc.textContent = this.locText; }, 190);
  }
  prompt(t: string | null) { this.promptEl.hidden = !t; if (t) this.promptEl.textContent = t; }
  setTimer(frac: number | null, txt = '') { this.timer.hidden = frac === null; if (frac !== null) { this.timerFill.style.width = frac * 100 + '%'; this.timerTxt.textContent = txt; } }
  setBoss(frac: number | null) { this.bossBar.hidden = frac === null; if (frac !== null) this.bossFill.style.width = frac * 100 + '%'; }
  showHint(t: string | null) { this.hint.hidden = !t; if (t) this.hint.textContent = 'HINT — ' + t; }
  toast(t: string) { this.toastEl.textContent = t; this.toastEl.classList.remove('show'); void this.toastEl.offsetWidth; this.toastEl.classList.add('show'); }
  async titleCard(chapter: string, name: string, sub: string) {
    this.card.hidden = false; this.card.innerHTML = ''; el('div', 'tc-chap', this.card, chapter); el('div', 'tc-name glitch-text', this.card, name).dataset.text = name; el('div', 'tc-sub', this.card, sub);
    this.card.classList.remove('out'); this.card.classList.add('in'); await sleep(settings.reducedMotion ? 1400 : 2300); this.card.classList.replace('in', 'out'); await sleep(600); this.card.hidden = true;
  }
  show(v: boolean) { this.root.style.display = v ? '' : 'none'; }
}

// ───────────── Dialogue ─────────────
export class DialogueBox {
  root: HTMLElement; private who: HTMLElement; private txt: HTMLElement; private hintEl: HTMLElement; open = false; private skip = false; private resolveFn: (() => void) | null = null;
  constructor(parent: HTMLElement) {
    this.root = el('div', 'dialogue', parent); this.root.hidden = true; this.root.setAttribute('role', 'log'); this.root.setAttribute('aria-live', 'polite');
    this.who = el('div', 'dlg-who', this.root); this.txt = el('div', 'dlg-txt', this.root); this.hintEl = el('div', 'dlg-hint', this.root, '[E] continue');
    this.root.addEventListener('click', () => (this.skip = true));
  }
  async show(speaker: string, lines: string[], mod: 'sys' | 'admin' | 'echo' | 'null' = 'sys') {
    this.open = true; this.root.hidden = false; this.root.dataset.mod = mod; this.who.textContent = speaker; input.enabled = false;
    for (const line of lines) {
      this.txt.textContent = ''; this.skip = false; const delay = 24 / Math.max(0.3, settings.dialogueSpeed);
      for (let i = 0; i < line.length && !this.skip; i++) { this.txt.textContent = line.slice(0, i + 1); if (i % 2 === 0) audio.voice(mod); await sleep(delay); if (this.keyAdvance()) this.skip = true; }
      this.txt.textContent = line; await sleep(80);
      await new Promise<void>(res => { this.resolveFn = res; const onKey = (e: KeyboardEvent) => { if (['KeyE', 'Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); done(); } }; const done = () => { removeEventListener('keydown', onKey); this.root.removeEventListener('click', done); res(); }; addEventListener('keydown', onKey); this.root.addEventListener('click', done); });
      audio.sfx('click');
    }
    this.root.hidden = true; this.open = false; input.enabled = true; input.endFrame();
  }
  private keyAdvance() { return false; }
}

// ───────────── Console ─────────────
export type LogKind = 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO' | 'ADMIN';
export class ConsolePanel {
  root: HTMLElement; private body: HTMLElement;
  constructor(parent: HTMLElement) { this.root = el('div', 'console', parent); el('div', 'console-head', this.root, 'SYSTEM CONSOLE'); this.body = el('div', 'console-body', this.root); this.body.setAttribute('role', 'log'); }
  log(kind: LogKind, text: string) { const l = el('div', 'log ' + kind.toLowerCase(), this.body); el('b', '', l, `[${kind}]`); l.append(' ' + text); this.body.scrollTop = this.body.scrollHeight; while (this.body.childElementCount > 80) this.body.firstElementChild!.remove(); }
  clear() { this.body.innerHTML = ''; }
}

// ───────────── Editor panel (editor + docs / inspector / variables) ─────────────
export class EditorPanel {
  root: HTMLElement; editor: CodeEditor; private tabs: HTMLElement; private pane: HTMLElement; private previewEl: HTMLElement; private status: HTMLElement; private fileTab: HTMLElement; private docsEl: HTMLElement; private inspEl: HTMLElement; private varsEl: HTMLElement; private graph!: HTMLCanvasElement;
  onCompile: () => void = () => {}; onRestore: () => void = () => {}; onHint: () => void = () => {}; onDebug: () => void = () => {};
  level!: LevelDef; private active: 'docs' | 'inspector' | 'variables' = 'docs'; private applied: RuleState = {};
  constructor(parent: HTMLElement) {
    this.root = el('aside', 'editor-panel', parent); this.root.setAttribute('aria-label', 'Rule editor');
    const head = el('div', 'ep-head', this.root); this.fileTab = el('div', 'ep-file', head, 'player.rules.js'); this.status = el('div', 'ep-status', head, 'UNAUTHORISED');
    this.editor = new CodeEditor(this.root);
    this.previewEl = el('div', 'ep-preview', this.root); this.graph = el('canvas', 'ep-graph', this.root); this.graph.width = 400; this.graph.height = 96; this.graph.setAttribute('aria-label', 'Jump arc graph: green is your pending rules, grey is the default');
    const bar = el('div', 'ep-buttons', this.root);
    const mk = (t: string, cls: string, fn: () => void, title?: string) => { const b = el('button', 'btn ' + cls, bar, t); b.addEventListener('click', () => { audio.sfx('click'); fn(); }); if (title) b.title = title; return b; };
    mk('COMPILE & APPLY', 'primary', () => this.onCompile(), 'Ctrl+Enter'); mk('RESTORE DEFAULTS', '', () => this.onRestore());
    mk('UNDO', 'small', () => this.editor.undo()); mk('REDO', 'small', () => this.editor.redo()); mk('HINT', 'small', () => this.onHint()); mk('DEBUG', 'small', () => this.onDebug(), 'F3 — collision overlays');
    this.tabs = el('div', 'ep-tabs', this.root); this.pane = el('div', 'ep-pane', this.root);
    (['docs', 'inspector', 'variables'] as const).forEach(t => { const b = el('button', 'tab', this.tabs, t.toUpperCase()); b.dataset.t = t; b.addEventListener('click', () => this.setTab(t)); });
    this.docsEl = el('div', 'pane-docs', this.pane); this.inspEl = el('div', 'pane-insp', this.pane); this.varsEl = el('div', 'pane-vars', this.pane); this.setTab('docs');
    this.editor.onCompile = () => this.onCompile();
  }
  setTab(t: 'docs' | 'inspector' | 'variables') { this.active = t; this.docsEl.hidden = t !== 'docs'; this.inspEl.hidden = t !== 'inspector'; this.varsEl.hidden = t !== 'variables'; this.tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.t === t)); }
  setLevel(level: LevelDef, src: string, applied: RuleState) {
    this.level = level; this.fileTab.textContent = level.fileName; this.editor.configure(level.schema, level.locked); this.editor.setSource(src, false); this.applied = applied; this.buildDocs(level.schema); this.refreshVars(applied);
    this.inspEl.innerHTML = '<p class="muted">Debug mode (F3): click any entity in the game view to inspect it here.</p>';
  }
  setStatus(t: string, bad = false) { this.status.textContent = t; this.status.classList.toggle('bad', bad); }
  setPreview(html: string) { this.previewEl.innerHTML = html; }
  /** Live graph of the jump arc (height vs distance): pending rules in green over the defaults in grey, with 32 px tile gridlines. */
  setGraph(cur: { j: number; sp: number; g: number }, def: { j: number; sp: number; g: number }) {
    const c = this.graph, x = c.getContext('2d')!; const W = c.width, H = c.height, padL = 8, base = H - 14; x.clearRect(0, 0, W, H); x.fillStyle = '#08080a'; x.fillRect(0, 0, W, H);
    const arc = (r: { j: number; sp: number; g: number }) => { const n = airTime(r.j, r.g); const pts: [number, number][] = []; for (let i = 0; i <= n; i++) pts.push([r.sp * i, heightAt(i, r.j, r.g)]); return pts; };
    const A = arc(cur), B = arc(def); const maxX = Math.max(160, ...A.map(p => p[0]), ...B.map(p => p[0])) * 1.06, maxY = Math.max(64, cur.j, def.j) * 1.18; const sx = (W - padL - 6) / maxX, sy = (base - 6) / maxY;
    x.strokeStyle = '#17171c'; x.lineWidth = 1; for (let gx = 0; gx <= maxX; gx += 32) { x.beginPath(); x.moveTo(padL + gx * sx + .5, 4); x.lineTo(padL + gx * sx + .5, base); x.stroke(); } for (let gy = 0; gy <= maxY; gy += 32) { x.beginPath(); x.moveTo(padL, base - gy * sy + .5); x.lineTo(W - 4, base - gy * sy + .5); x.stroke(); }
    x.strokeStyle = '#35353b'; x.beginPath(); x.moveTo(padL, base + .5); x.lineTo(W - 4, base + .5); x.stroke();
    const line = (pts: [number, number][], col: string, dash: number[], w: number) => { x.setLineDash(dash); x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], i) => { const X = padL + px * sx, Y = base - py * sy; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.stroke(); x.setLineDash([]); };
    line(B, '#6b6b75', [4, 3], 1); line(A, '#53ff9a', [], 2);
    const apex = A.reduce((m, p) => p[1] > m[1] ? p : m, A[0]); const end = A[A.length - 1]; x.fillStyle = '#53ff9a'; x.font = '10px monospace';
    x.fillRect(padL + apex[0] * sx - 2, base - apex[1] * sy - 2, 4, 4); x.fillText(`apex ${Math.round(apex[1])}px`, Math.min(W - 70, padL + apex[0] * sx + 6), Math.max(10, base - apex[1] * sy - 4)); x.fillText(`range ${Math.round(end[0])}px`, Math.min(W - 80, padL + end[0] * sx - 30), base + 11);
    x.fillStyle = '#6b6b75'; x.fillText('default', padL + 4, 11);
  }
  private buildDocs(schema: RuleSchema) {
    const d = this.docsEl; d.innerHTML = '';
    const sec = (title: string) => { const s = el('details', 'doc', d); s.open = title === 'OBJECTS'; el('summary', '', s, title); return s; };
    const o = sec('OBJECTS'); for (const [n, od] of Object.entries(schema.objects)) { const b = el('div', 'doc-obj', o); el('b', '', b, n); el('span', 'muted', b, ' — ' + od.doc); for (const [p, pd] of Object.entries(od.props)) el('div', 'doc-prop', b, `${n}.${p}  ·  ${pd.type}${pd.min !== undefined ? `  ${pd.min}…${pd.max}` : ''}  ·  default ${pd.default}${pd.unit ? ' ' + pd.unit : ''}${pd.adminOnly ? '  ·  ADMIN' : ''}\n${pd.doc}`); }
    if (Object.keys(schema.arrays).length) { const a = sec('ARRAYS'); for (const [n, items] of Object.entries(schema.arrays)) el('div', 'doc-prop', a, `${n} = [${items.join(', ')}]   len(${n}) = ${items.length}`); }
    const f = sec('LANGUAGE'); for (const ft of schema.features) el('div', 'doc-prop', f, FEATURE_INFO[ft].label); el('div', 'doc-prop muted', f, 'No eval, no network, no host access. Loops: 64 iterations. 4000 steps. 4000 characters.');
    const p = sec('PHYSICS UNITS'); el('div', 'doc-prop', p, 'Units are pixels and frames (60/s). One tile = 32 px.\nA jump reaches jumpHeight px at its apex.\nRange ≈ speed × (2 × launch velocity ÷ gravity).\nThe green arc in the game view previews your pending values.');
  }
  refreshVars(state: RuleState) {
    this.applied = state; this.varsEl.innerHTML = '';
    for (const [o, props] of Object.entries(state)) { const row = el('div', 'var-obj', this.varsEl); el('b', '', row, o); for (const [k, v] of Object.entries(props)) { const def = this.level.schema.objects[o].props[k]; const ch = def.default !== v; el('div', 'var-prop' + (ch ? ' changed' : ''), row, `${k} = ${v}`); } }
  }
  setInspector(html: string) { this.inspEl.innerHTML = html; if (this.active !== 'inspector') this.setTab('inspector'); }
  showErrors(errors: RuleError[]) { this.editor.setErrors(errors); }
}
