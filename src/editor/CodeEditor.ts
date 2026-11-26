// Custom code editor: syntax highlighting, line numbers, error markers, protected lines, autocomplete,
// hover tooltips and undo/redo — built on a transparent <textarea> over a highlighted <pre> (CodeMirror 6 could not be installed offline).
import { FUNCTIONS, type RuleSchema } from './RuleSchema';
import type { RuleError } from './RuleValidator';
import { audio } from '../audio/AudioEngine';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KW = new Set(['let', 'if', 'else', 'for', 'true', 'false']);

export class CodeEditor {
  root: HTMLElement; ta: HTMLTextAreaElement; pre: HTMLElement; gutter: HTMLElement; popup: HTMLElement; tip: HTMLElement; notice: HTMLElement;
  private schema!: RuleSchema; private locked = new Set<string>(); private errors: RuleError[] = []; private changed = new Set<number>();
  private hist: string[] = []; private histIdx = -1; private histTimer = 0; private acItems: { label: string; detail: string }[] = []; private acSel = 0; private acStart = 0;
  onChange: (src: string) => void = () => {}; onCompile: () => void = () => {}; onFocusChange: (focused: boolean) => void = () => {};
  readonly lh = 18; readonly cw = 7.8;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div'); this.root.className = 'ce'; parent.appendChild(this.root);
    this.gutter = div('ce-gutter', this.root); const body = div('ce-body', this.root);
    this.pre = div('ce-pre', body); this.pre.setAttribute('aria-hidden', 'true');
    this.ta = document.createElement('textarea'); this.ta.className = 'ce-ta'; this.ta.spellcheck = false; this.ta.autocapitalize = 'off'; this.ta.setAttribute('aria-label', 'Rule source code editor'); this.ta.wrap = 'off';
    body.appendChild(this.ta);
    this.popup = div('ce-popup', body); this.popup.hidden = true; this.tip = div('ce-tip', body); this.tip.hidden = true; this.notice = div('ce-notice', body); this.notice.hidden = true;
    this.ta.addEventListener('input', () => { this.afterEdit(); this.autocomplete(); });
    this.ta.addEventListener('scroll', () => this.syncScroll());
    this.ta.addEventListener('keydown', e => this.onKey(e));
    this.ta.addEventListener('beforeinput', e => this.guard(e));
    this.ta.addEventListener('click', () => this.closePopup());
    this.ta.addEventListener('focus', () => this.onFocusChange(true)); this.ta.addEventListener('blur', () => { this.onFocusChange(false); setTimeout(() => this.closePopup(), 120); });
    this.ta.addEventListener('mousemove', e => this.hover(e)); this.ta.addEventListener('mouseleave', () => (this.tip.hidden = true));
  }
  configure(schema: RuleSchema, lockedLines: string[]) { this.schema = schema; this.locked = new Set(lockedLines.map(norm)); this.render(); }
  get source() { return this.ta.value; }
  setSource(src: string, pushHistory = true) { if (pushHistory && this.ta.value !== src) this.commit(); this.ta.value = src; this.errors = []; this.commit(); this.render(); }
  setErrors(errs: RuleError[]) { this.errors = errs; this.render(); }
  setChanged(lines: number[]) { this.changed = new Set(lines); this.render(); setTimeout(() => { this.changed.clear(); this.render(); }, 2600); }
  focus() { this.ta.focus(); }

  // ---------- history ----------
  private commit() { const v = this.ta.value; if (this.hist[this.histIdx] === v) return; this.hist = this.hist.slice(0, this.histIdx + 1); this.hist.push(v); if (this.hist.length > 100) this.hist.shift(); this.histIdx = this.hist.length - 1; }
  undo() { this.commit(); if (this.histIdx > 0) { this.histIdx--; this.ta.value = this.hist[this.histIdx]; this.afterEdit(false); } }
  redo() { if (this.histIdx < this.hist.length - 1) { this.histIdx++; this.ta.value = this.hist[this.histIdx]; this.afterEdit(false); } }
  private afterEdit(commitSoon = true) { this.render(); this.onChange(this.ta.value); if (commitSoon) { clearTimeout(this.histTimer); this.histTimer = window.setTimeout(() => this.commit(), 450); } }

  // ---------- protected lines ----------
  private lineOf(pos: number) { return this.ta.value.slice(0, pos).split('\n').length - 1; }
  private isLockedLine(i: number) { const l = this.ta.value.split('\n')[i]; return l !== undefined && this.locked.has(norm(l)); }
  private warn(msg: string) { this.notice.textContent = msg; this.notice.hidden = false; audio.sfx('error'); clearTimeout(this.noticeT); this.noticeT = window.setTimeout(() => (this.notice.hidden = true), 1800); }
  private noticeT = 0;
  private guard(e: InputEvent) {
    if (!this.locked.size) return; const s = this.ta.selectionStart, en = this.ta.selectionEnd; const a = this.lineOf(s), b = this.lineOf(en);
    const v = this.ta.value; const lineStart = v.lastIndexOf('\n', s - 1) + 1; let lineEnd = v.indexOf('\n', en); if (lineEnd < 0) lineEnd = v.length;
    let touches = false; for (let i = a; i <= b; i++) if (this.isLockedLine(i)) touches = true;
    if (!touches && e.inputType === 'deleteContentBackward' && s === en && s === lineStart && a > 0 && this.isLockedLine(a - 1)) touches = true; // joining into previous protected line
    if (!touches && e.inputType === 'deleteContentForward' && s === en && s === lineEnd && this.isLockedLine(a + 1)) touches = true;
    if (!touches) return;
    if (e.inputType === 'insertLineBreak' && s === en && (s === lineStart || s === lineEnd)) return; // adding a new line next to a protected line is fine
    e.preventDefault(); this.warn('PROTECTED LINE — owned by ADMIN. Edit the values it reads instead.');
  }

  // ---------- keys ----------
  private onKey(e: KeyboardEvent) {
    if (!this.popup.hidden) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.acSel = (this.acSel + 1) % this.acItems.length; this.renderPopup(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.acSel = (this.acSel - 1 + this.acItems.length) % this.acItems.length; this.renderPopup(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.acceptAc(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closePopup(); return; }
    }
    if (e.key === 'Escape') { e.stopPropagation(); this.ta.blur(); this.root.dispatchEvent(new CustomEvent('ce-leave')); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.onCompile(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); this.ta.blur(); this.root.dispatchEvent(new CustomEvent('ce-leave')); return; }
    if (e.key === 'Enter' && !e.ctrlKey) { // auto-indent
      const v = this.ta.value, s = this.ta.selectionStart; const ls = v.lastIndexOf('\n', s - 1) + 1; const indent = /^\s*/.exec(v.slice(ls, s))![0]; const extra = v.slice(ls, s).trimEnd().endsWith('{') ? '  ' : '';
      if (indent || extra) { e.preventDefault(); document.execCommand?.('insertText', false, '\n' + indent + extra) || this.insert('\n' + indent + extra); this.afterEdit(); }
    }
  }
  private insert(t: string) { const s = this.ta.selectionStart, en = this.ta.selectionEnd; this.ta.setRangeText(t, s, en, 'end'); }

  // ---------- autocomplete ----------
  private autocomplete() {
    const v = this.ta.value, pos = this.ta.selectionStart; const before = v.slice(0, pos); const m = /([A-Za-z_]\w*)?(\.)?([A-Za-z_]\w*)?$/.exec(before);
    const lineText = before.slice(before.lastIndexOf('\n') + 1); if (/\/\/.*$/.test(lineText)) return this.closePopup();
    const dm = /([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/.exec(lineText); let items: { label: string; detail: string }[] = []; let prefix = '';
    if (dm) { const obj = dm[1]; prefix = dm[2] ?? ''; const o = this.schema.objects[obj]; if (o) items = Object.entries(o.props).filter(([k]) => k.toLowerCase().startsWith(prefix.toLowerCase())).map(([k, d]) => ({ label: k, detail: `${d.type}${d.min !== undefined ? ` ${d.min}…${d.max}` : ''}` })); }
    else { const wm = /([A-Za-z_]\w*)$/.exec(lineText); if (!wm) return this.closePopup(); prefix = wm[1]; if (prefix.length < 1) return this.closePopup();
      const names = [...Object.keys(this.schema.objects).map(n => ({ label: n, detail: 'object' })), ...Object.keys(this.schema.arrays).map(n => ({ label: n, detail: 'array' })),
        ...this.schema.features.includes('conditions') ? [{ label: 'if', detail: 'keyword' }, { label: 'else', detail: 'keyword' }] : [], ...this.schema.features.includes('variables') ? [{ label: 'let', detail: 'keyword' }] : [], ...this.schema.features.includes('loops') ? [{ label: 'for', detail: 'keyword' }] : [],
        ...this.schema.features.includes('booleans') ? [{ label: 'true', detail: 'boolean' }, { label: 'false', detail: 'boolean' }] : [], ...this.schema.features.includes('functions') ? Object.keys(FUNCTIONS).map(n => ({ label: n, detail: 'function' })) : []];
      items = names.filter(n => n.label.toLowerCase().startsWith(prefix.toLowerCase()) && n.label !== prefix); }
    void m; if (!items.length || (items.length === 1 && items[0].label === prefix)) return this.closePopup();
    this.acItems = items.slice(0, 8); this.acSel = 0; this.acStart = pos - prefix.length; this.renderPopup();
  }
  private renderPopup() {
    const pos = this.ta.selectionStart; const before = this.ta.value.slice(0, pos); const line = before.split('\n').length - 1; const col = before.length - before.lastIndexOf('\n') - 1;
    this.popup.hidden = false; this.popup.style.top = `${(line + 1) * this.lh - this.ta.scrollTop + 6}px`; this.popup.style.left = `${Math.max(0, col * this.cw - this.ta.scrollLeft + 10)}px`;
    this.popup.innerHTML = this.acItems.map((it, i) => `<div class="ce-ac${i === this.acSel ? ' sel' : ''}" data-i="${i}"><span>${esc(it.label)}</span><em>${esc(it.detail)}</em></div>`).join('');
    this.popup.querySelectorAll<HTMLElement>('.ce-ac').forEach(n => n.addEventListener('mousedown', ev => { ev.preventDefault(); this.acSel = Number(n.dataset.i); this.acceptAc(); }));
  }
  private acceptAc() { const it = this.acItems[this.acSel]; if (!it) return; const pos = this.ta.selectionStart; this.ta.setRangeText(it.label, this.acStart, pos, 'end'); this.closePopup(); this.afterEdit(); }
  private closePopup() { this.popup.hidden = true; }

  // ---------- hover tooltips ----------
  private hover(e: MouseEvent) {
    const r = this.ta.getBoundingClientRect(); const x = e.clientX - r.left + this.ta.scrollLeft - 10, y = e.clientY - r.top + this.ta.scrollTop - 6;
    const line = Math.floor(y / this.lh), col = Math.floor(x / this.cw); const text = this.ta.value.split('\n')[line]; if (text === undefined || col < 0 || col > text.length) { this.tip.hidden = true; return; }
    const re = /[A-Za-z_]\w*(\.[A-Za-z_]\w*)?/g; let m: RegExpExecArray | null; let html = '';
    const err = this.errors.find(er => er.line - 1 === line);
    while ((m = re.exec(text))) { if (col >= m.index && col <= m.index + m[0].length) { const [o, p] = m[0].split('.'); const od = this.schema.objects[o];
      if (od && p && od.props[p]) { const d = od.props[p]; html = `<b>${o}.${p}</b> <i>${d.type}</i><br>${esc(d.doc)}<br>default ${d.default}${d.unit ? ' ' + d.unit : ''}${d.min !== undefined ? ` · limits ${d.min} … ${d.max}` : ''}${d.adminOnly ? '<br><u>controlled by ADMIN</u>' : ''}`; }
      else if (od && !p) html = `<b>${o}</b> <i>object</i><br>${esc(od.doc)}<br>${Object.keys(od.props).join(', ')}`;
      else if (FUNCTIONS[m[0]]) html = `<b>${m[0]}()</b><br>${esc(FUNCTIONS[m[0]].doc)}`; else if (this.schema.arrays[m[0]]) html = `<b>${m[0]}</b> <i>array</i><br>[${this.schema.arrays[m[0]].join(', ')}]`; break; } }
    if (err && !html) html = `<b class="bad">${esc(err.msg)}</b>${err.hint ? '<br>' + esc(err.hint) : ''}`;
    if (!html) { this.tip.hidden = true; return; }
    this.tip.innerHTML = html; this.tip.hidden = false; this.tip.style.left = `${Math.min(e.clientX - r.left + 12, r.width - 230)}px`; this.tip.style.top = `${e.clientY - r.top + 18}px`;
  }

  // ---------- rendering ----------
  private syncScroll() { this.pre.scrollTop = this.ta.scrollTop; this.pre.scrollLeft = this.ta.scrollLeft; this.gutter.scrollTop = this.ta.scrollTop; this.popup.hidden = true; }
  render() {
    const lines = this.ta.value.split('\n'); const objs = new Set(Object.keys(this.schema?.objects ?? {})); const arrs = new Set(Object.keys(this.schema?.arrays ?? {}));
    const errLines = new Map<number, RuleError>(); for (const e of this.errors) if (!errLines.has(e.line)) errLines.set(e.line, e);
    this.pre.innerHTML = lines.map((ln, i) => {
      const isLocked = this.locked.has(norm(ln)); const cls = ['ce-line', isLocked ? 'locked' : '', this.changed.has(i + 1) ? 'changed' : '', errLines.has(i + 1) ? 'err' : ''].join(' ');
      const ci = ln.indexOf('//'); const code = ci >= 0 ? ln.slice(0, ci) : ln; const com = ci >= 0 ? ln.slice(ci) : '';
      const h = code.replace(/(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([^\sA-Za-z_\d]+)|(\s+)/g, (_m, n, id, op, ws) => {
        if (n) return `<i class="n">${n}</i>`; if (ws) return ws.replace(/ /g, ' ');
        if (id) { if (KW.has(id)) return `<i class="k">${id}</i>`; if (objs.has(id)) return `<i class="o">${id}</i>`; if (arrs.has(id)) return `<i class="a">${id}</i>`; if (FUNCTIONS[id]) return `<i class="f">${id}</i>`; return `<i class="p">${id}</i>`; }
        return `<i class="op">${esc(op)}</i>`; });
      return `<div class="${cls}">${h}${com ? `<i class="c">${esc(com)}</i>` : ''}${isLocked ? '<i class="lk">  PROTECTED</i>' : ''}&#8203;</div>`;
    }).join('');
    this.gutter.innerHTML = lines.map((_l, i) => `<div class="${errLines.has(i + 1) ? 'err' : ''}${this.changed.has(i + 1) ? ' changed' : ''}">${i + 1}</div>`).join('');
    this.syncScroll();
  }
}
function div(cls: string, parent: HTMLElement) { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }
