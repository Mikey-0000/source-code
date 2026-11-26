export type PState = 'running' | 'frozen' | 'dead' | 'corrupted';
export interface Proc { pid: number; name: string; state: PState; protectedBy?: string; note: string; cpu: number }
export class ProcessManager {
  procs: Proc[] = [
    { pid: 1, name: 'admin.exe', state: 'running', note: 'the caretaker. owns every lock.', cpu: 71 },
    { pid: 7, name: 'daemon_07', state: 'running', note: 'security sentinel.', cpu: 12 },
    { pid: 13, name: 'watcher.exe', state: 'dead', note: 'overwritten by NULL_001.', cpu: 0 },
    { pid: 42, name: 'echo.exe', state: 'corrupted', note: 'deleted character. memory file is damaged.', cpu: 0 },
    { pid: 101, name: 'null.exe', state: 'running', note: 'you.', cpu: 5 },
  ];
  find(q: string | number): Proc | undefined { return this.procs.find(p => String(p.pid) === String(q) || p.name === q || p.name.replace('.exe', '') === q); }
  freeze(q: string | number): { ok: boolean; msg: string } {
    const p = this.find(q); if (!p) return { ok: false, msg: `no such process: ${q}` };
    if (p.name === 'null.exe') return { ok: false, msg: 'cannot freeze yourself. that would end the story.' };
    if (p.state === 'dead') return { ok: false, msg: `${p.name} is already dead.` }; if (p.state === 'frozen') return { ok: false, msg: `${p.name} is already frozen.` };
    p.state = 'frozen'; return { ok: true, msg: `${p.name} frozen. It cannot enforce anything while frozen.` };
  }
  resume(q: string | number) { const p = this.find(q); if (!p) return { ok: false, msg: `no such process: ${q}` }; if (p.state !== 'frozen') return { ok: false, msg: `${p.name} is not frozen.` }; p.state = 'running'; return { ok: true, msg: `${p.name} resumed.` }; }
  kill(q: string | number) { const p = this.find(q); if (!p) return { ok: false, msg: `no such process: ${q}` }; if (p.name === 'admin.exe') return { ok: false, msg: 'ADMIN cannot be killed. It can be frozen.' }; if (p.name === 'null.exe') return { ok: false, msg: 'you cannot kill yourself here.' }; p.state = 'dead'; p.cpu = 0; return { ok: true, msg: `${p.name} terminated.` }; }
  get adminFrozen() { return this.find('admin.exe')?.state === 'frozen'; }
}
