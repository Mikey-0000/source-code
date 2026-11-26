import { el, sleep } from '../core/Util';
import { audio } from '../audio/AudioEngine';
import { VirtualFilesystem, type VNode } from './VirtualFilesystem';
import { ProcessManager } from './ProcessManager';
import { Terminal, type OutLine } from './Terminal';
import { story } from '../narrative/StoryFlags';
import { ending, LEAN_TEXT, scoreEndings } from '../narrative/Endings';

/** EDEN OS: an entirely fictional, harmless desktop sandbox. It never impersonates real OS warnings and can always be left. */
export class VirtualDesktop {
  root: HTMLElement; fs: VirtualFilesystem; procs = new ProcessManager(); term: Terminal; private winArea: HTMLElement; private taskbar: HTMLElement; private z = 10; private wins = new Map<string, HTMLElement>();
  constructor(parent: HTMLElement, private onLeave: () => void) {
    this.fs = new VirtualFilesystem(story.data.corruption >= 66); this.term = new Terminal(this.fs, this.procs, ev => this.onEvent(ev));
    this.root = el('div', 'os', parent); const wall = el('div', 'os-wall', this.root); el('div', 'os-eye', wall); el('div', 'os-mark', wall, 'EDEN OS 0.9 — ROOT');
    this.winArea = el('div', 'os-wins', this.root); const icons = el('div', 'os-icons', this.root);
    const apps: [string, string, () => void][] = [['FILES', 'F', () => this.openFiles('/')], ['TERMINAL', '>_', () => this.openTerminal()], ['PROCESSES', 'P', () => this.openProcs()], ['MEMORY ARCHIVE', 'M', () => this.openArchive()], ['PERMISSIONS', 'L', () => this.openPerms()], ['README', 'i', () => this.openReadme()]];
    for (const [n, g, fn] of apps) { const b = el('button', 'os-icon', icons); el('span', 'glyph', b, g); el('span', '', b, n); b.addEventListener('click', () => { audio.sfx('click'); fn(); }); }
    this.taskbar = el('div', 'os-task', this.root); el('span', 'os-start', this.taskbar, 'EDEN'); el('div', 'os-tasks', this.taskbar); const clock = el('span', 'os-clock', this.taskbar, '00:00:NULL');
    const leave = el('button', 'btn small leave', this.taskbar, 'LEAVE EDEN'); leave.addEventListener('click', () => void this.leave()); setInterval(() => { clock.textContent = new Date().toTimeString().slice(0, 5) + ':NULL'; }, 1000);
    this.openReadme(); setTimeout(() => this.popup('EDEN OS — simulated dialog', 'This is a fictional error window inside the game. Nothing on your computer is affected.\n\nERROR 0x00A1: ENTITY NULL_001 HAS NO PERMISSION TO BE HERE.', 'Ignore'), 900);
  }
  private onEvent(ev: string) { const m: Record<string, string> = { adminFrozen: 'admin.exe frozen. Locks can now be changed.', permissionsEdited: 'Permission changed. ADMIN did not notice. Yet.', adminLogRead: 'admin.log read. Three options are now visible: free, restore, delete.', echoRestored: 'ECHO restored.', daemonKilled: 'daemon_07 terminated.', daemonDeleted: 'daemon.rules deleted.', kernelRepaired: 'Kernel repaired.', kernelPurged: 'Kernel purged.' }; this.toast(m[ev] ?? ev); audio.sfx('compile'); this.refresh(); }
  private toast(t: string) { const d = el('div', 'os-toast', this.root, t); setTimeout(() => d.remove(), 3500); }
  private refresh() { for (const [k, w] of this.wins) { const rebuild = (w as HTMLElement & { rebuild?: () => void }).rebuild; if (rebuild && k !== 'term') rebuild(); } }

  win(id: string, title: string, w: number, h: number, build: (body: HTMLElement) => void): HTMLElement {
    const existing = this.wins.get(id); if (existing) { existing.style.zIndex = String(++this.z); (existing as HTMLElement & { rebuild?: () => void }).rebuild?.(); return existing; }
    const n = this.wins.size; const win = el('div', 'os-win', this.winArea); win.style.cssText = `left:${60 + n * 34}px;top:${40 + n * 28}px;width:${w}px;height:${h}px;z-index:${++this.z}`; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', title);
    const bar = el('div', 'os-title', win); el('span', '', bar, title); const x = el('button', 'os-x', bar, '×'); x.setAttribute('aria-label', 'Close ' + title); const body = el('div', 'os-body', win);
    x.addEventListener('click', () => { win.remove(); this.wins.delete(id); this.tasks(); }); win.addEventListener('mousedown', () => { win.style.zIndex = String(++this.z); });
    bar.addEventListener('mousedown', e => { if ((e.target as HTMLElement).tagName === 'BUTTON') return; const ox = e.clientX - win.offsetLeft, oy = e.clientY - win.offsetTop; const mv = (m: MouseEvent) => { win.style.left = Math.max(0, m.clientX - ox) + 'px'; win.style.top = Math.max(0, m.clientY - oy) + 'px'; }; const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); });
    const rebuild = () => { body.innerHTML = ''; build(body); }; (win as HTMLElement & { rebuild?: () => void }).rebuild = rebuild; rebuild(); this.wins.set(id, win); this.tasks(); return win;
  }
  private tasks() { const t = this.taskbar.querySelector('.os-tasks')!; t.innerHTML = ''; for (const [id, w] of this.wins) { const b = el('button', 'os-tb', t as HTMLElement, w.querySelector('.os-title span')!.textContent ?? id); b.addEventListener('click', () => { w.style.zIndex = String(++this.z); }); } }
  popup(title: string, text: string, btn: string) { const p = el('div', 'os-win popup', this.winArea); p.style.cssText = `left:${innerWidth / 2 - 190}px;top:${innerHeight / 2 - 110}px;width:380px;z-index:${++this.z + 100}`; const bar = el('div', 'os-title', p); el('span', '', bar, title); const b = el('div', 'os-body', p); el('pre', '', b, text); const ok = el('button', 'btn small', b, btn); ok.addEventListener('click', () => p.remove()); audio.sfx('error'); }

  openReadme() { this.win('readme', 'README.txt', 440, 330, b => { el('pre', 'os-pre', b, 'ROOT ACCESS — unexpected.\n\nYou are inside EDEN OS. ADMIN owns this place.\nThere are files to read, processes to control, and\npermissions to rewrite.\n\nWHAT YOU CAN DO\n  1. Find out why ADMIN keeps deleting people.\n     (hint: /system/admin.log is locked)\n  2. Decide what to do with ECHO.\n     (hint: /entities/echo.memory is damaged)\n  3. Decide what to do with the kernel.\n\nTerminal: type help.  Leave: LEAVE EDEN (bottom right).'); }); }
  openFiles(path: string) {
    const id = 'files'; const w = this.win(id, 'FILES', 520, 360, () => {}); const body = w.querySelector('.os-body') as HTMLElement; let cur = path;
    const draw = () => { body.innerHTML = ''; el('div', 'os-path', body, cur); const list = el('div', 'os-list', body); if (cur !== '/') { const up = el('button', 'os-item dir', list, '../'); up.addEventListener('click', () => { cur = this.fs.norm('..', cur); draw(); }); }
      for (const n of this.fs.list(cur, true) ?? []) { const b = el('button', 'os-item ' + n.type + (n.perm === 'locked' ? ' locked' : '') + (n.corrupted || n.deleted ? ' bad' : ''), list, n.name + (n.type === 'dir' ? '/' : '') + (n.perm === 'locked' ? '   [LOCKED]' : '') + (n.corrupted ? '   [CORRUPTED]' : '') + (n.deleted ? '   [DELETED]' : '')); b.addEventListener('click', () => { if (n.type === 'dir') { cur = this.fs.norm(n.name, cur); draw(); } else this.openFile(this.fs.norm(n.name, cur), n); }); } };
    (w as HTMLElement & { rebuild?: () => void }).rebuild = draw; draw();
  }
  openFile(path: string, n: VNode) {
    this.win('file:' + path, path, 440, 320, b => { const node = this.fs.get(path) ?? n; if (node.perm === 'locked') { el('pre', 'os-pre err', b, 'PERMISSION DENIED\nLocked by ADMIN.\n\nA frozen process cannot enforce a lock.'); return; }
      if (path === '/system/admin.log') { story.set('adminLogRead', true); }
      el('pre', 'os-pre' + (node.corrupted ? ' bad' : ''), b, path === '/logs/exceptions.log' ? this.term.exec('cat ' + path).map(l => l.t).join('\n') : node.content ?? ''); if (node.corrupted || node.deleted) { const r = el('button', 'btn small', b, 'RESTORE'); r.addEventListener('click', () => { this.term.exec('restore ' + path); this.refresh(); }); } });
  }
  openTerminal() {
    const w = this.win('term', 'TERMINAL', 560, 360, () => {}); const body = w.querySelector('.os-body') as HTMLElement; body.innerHTML = ''; const out = el('div', 'os-term', body); const row = el('div', 'os-term-row', body); const pr = el('span', '', row, this.term.prompt()); const inp = el('input', 'os-term-in', row); inp.setAttribute('aria-label', 'terminal input'); inp.spellcheck = false; inp.autocomplete = 'off';
    const print = (ls: OutLine[]) => { for (const l of ls) { if (l.t === '\f') { out.innerHTML = ''; continue; } el('div', 'tl ' + (l.cls ?? ''), out, l.t); } out.scrollTop = out.scrollHeight; };
    print([{ t: "EDEN OS terminal. Type 'help'.", cls: 'dim' }]); (w as HTMLElement & { rebuild?: () => void }).rebuild = () => {}; let hi = -1;
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const v = inp.value; el('div', 'tl', out, this.term.prompt() + v); print(this.term.exec(v)); inp.value = ''; pr.textContent = this.term.prompt(); hi = -1; audio.sfx('type'); } if (e.key === 'ArrowUp') { hi = Math.min(this.term.history.length - 1, hi + 1); inp.value = this.term.history[this.term.history.length - 1 - hi] ?? ''; e.preventDefault(); } if (e.key === 'ArrowDown') { hi = Math.max(-1, hi - 1); inp.value = hi < 0 ? '' : this.term.history[this.term.history.length - 1 - hi]; e.preventDefault(); } });
    w.addEventListener('mousedown', () => setTimeout(() => inp.focus(), 0)); setTimeout(() => inp.focus(), 50);
  }
  openProcs() { this.win('procs', 'PROCESS MANAGER', 520, 300, b => { const tb = el('table', 'os-table', b); tb.innerHTML = '<tr><th>PID</th><th>NAME</th><th>STATE</th><th>CPU</th><th></th></tr>'; for (const p of this.procs.procs) { const tr = el('tr', p.state, tb); for (const t of [String(p.pid), p.name, p.state.toUpperCase(), p.cpu + '%']) el('td', '', tr, t); const td = el('td', '', tr); const mk = (t: string, fn: () => void) => { const bt = el('button', 'btn small', td, t); bt.addEventListener('click', () => { fn(); this.refresh(); }); };
    if (p.state === 'running') { mk('FREEZE', () => { this.term.exec('freeze ' + p.pid); }); mk('KILL', () => { const r = this.term.exec('kill ' + p.pid); this.toast(r[0].t); }); } if (p.state === 'frozen') mk('RESUME', () => { this.term.exec('resume ' + p.pid); }); } el('p', 'muted', b, 'Frozen processes cannot defend their locks.'); }); }
  openArchive() { this.win('arch', 'MEMORY ARCHIVE', 480, 320, b => { const ms = story.data.memories; el('div', 'os-path', b, `${ms.length} memory fragment(s) recovered`); if (!ms.length) el('p', 'muted', b, 'Nothing recovered yet. Memories hide in the levels; higher corruption reveals more.'); ms.forEach(id => el('div', 'os-item', b, '◆ ' + id.replace('mem_', '').replace(/_/g, ' '))); }); }
  openPerms() { this.win('perm', 'PERMISSIONS', 480, 300, b => { el('div', 'os-path', b, this.procs.adminFrozen ? 'admin.exe is FROZEN — locks can change' : 'admin.exe is RUNNING — locks are enforced'); const t = el('table', 'os-table', b); const walk = (n: VNode, path: string) => { for (const c of n.children ?? []) { const p = (path === '/' ? '' : path) + '/' + c.name; if (c.type === 'file' && c.perm) { const tr = el('tr', c.perm, t); el('td', '', tr, p); el('td', '', tr, c.perm.toUpperCase()); const td = el('td', '', tr); if (c.perm === 'locked') { const bt = el('button', 'btn small', td, 'GRANT'); bt.addEventListener('click', () => { const r = this.term.exec(`permissions ${p} grant`); this.toast(r[0].t); this.refresh(); }); } } if (c.type === 'dir') walk(c, p); } }; walk(this.fs.root, '/'); }); }

  async leave() {
    const flags = { echoRestored: story.bool('echoRestored'), daemonDeleted: story.bool('daemonDeleted'), permissionsEdited: story.bool('permissionsEdited'), adminLogRead: story.bool('adminLogRead'), memories: story.data.memories.length, corruption: story.data.corruption, kernelPurged: story.bool('kernelPurged'), kernelRepaired: story.bool('kernelRepaired') };
    const lean = ending(flags); const scores = scoreEndings(flags); story.set('lean', lean); audio.sfx('glitch'); await sleep(300); this.root.classList.add('out'); await sleep(500);
    const c = el('div', 'endcard', this.root.parentElement!); el('div', 'card-k', c, 'END OF VERTICAL SLICE'); el('h2', 'glitch-text', c, 'EXIT(0) — NOT YET').dataset.text = 'EXIT(0) — NOT YET'; el('p', '', c, LEAN_TEXT[lean]); el('p', 'muted', c, 'Scores — ' + scores.map(s => `${s.id}: ${s.score}`).join('  ·  '));
    el('p', 'muted', c, 'Chapters 3 (MEMORY LEAK) and 5–6 (KERNEL PANIC, EXIT(0)) are not implemented in this build. Your decisions are saved for them.'); const b = el('button', 'btn primary', c, 'RETURN TO TITLE'); b.focus(); b.addEventListener('click', () => { c.remove(); this.root.remove(); this.onLeave(); });
  }
}
