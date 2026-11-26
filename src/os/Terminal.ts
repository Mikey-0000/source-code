import { VirtualFilesystem, ECHO_CLEAN, type VNode } from './VirtualFilesystem';
import { ProcessManager } from './ProcessManager';
import { story } from '../narrative/StoryFlags';

export interface OutLine { t: string; cls?: 'ok' | 'err' | 'warn' | 'dim' | 'head' }
export class Terminal {
  cwd = '/'; history: string[] = [];
  constructor(public fs: VirtualFilesystem, public procs: ProcessManager, private onEvent: (e: string) => void = () => {}) {}
  prompt() { return `null@eden:${this.cwd}$ `; }
  private fmt(n: VNode) { return (n.type === 'dir' ? n.name + '/' : n.name) + (n.perm === 'locked' ? '  [locked]' : '') + (n.corrupted ? '  [corrupted]' : '') + (n.deleted ? '  [deleted]' : ''); }
  exec(line: string): OutLine[] {
    const raw = line.trim(); if (!raw) return []; this.history.push(raw); const [cmd, ...args] = raw.split(/\s+/); const o = (t: string, cls?: OutLine['cls']): OutLine => ({ t, cls });
    switch (cmd) {
      case 'help': return [o('EDEN OS terminal — commands:', 'head'), o('  help                       this list'), o('  ls [-a] [path]             list files (-a shows hidden)'), o('  cd <path>                  change directory'), o('  cat <file>                 read a file'), o('  inspect <file|pid>         metadata and status'), o('  restore <file>             repair a corrupted or deleted file'), o('  processes                  list processes'), o('  freeze|resume|kill <pid>   control a process'), o('  permissions [file] [grant|revoke]   read or change locks'), o('  delete <file>              remove a file'), o('  repair|purge /system/kernel.rules   final decisions'), o('  clear                      clear the screen'), o('Everything here is fictional. Close the window or press Leave EDEN at any time.', 'dim')];
      case 'clear': return [o('\f')];
      case 'whoami': return [o('NULL_001 (faceless). Unauthorised.')];
      case 'pwd': return [o(this.cwd)];
      case 'ls': { const all = args.includes('-a'); const p = args.find(a => !a.startsWith('-')); const path = this.fs.norm(p ?? '.', this.cwd); const l = this.fs.list(path, all); if (!l) return [o(`ls: ${path}: not a directory`, 'err')]; return l.length ? l.map(n => o(this.fmt(n), n.type === 'dir' ? 'head' : n.corrupted || n.deleted ? 'warn' : undefined)) : [o('(empty)', 'dim')]; }
      case 'cd': { const path = this.fs.norm(args[0] ?? '/', this.cwd); const n = this.fs.get(path); if (!n || n.type !== 'dir') return [o(`cd: ${path}: no such directory`, 'err')]; this.cwd = path; return []; }
      case 'cat': { if (!args[0]) return [o('usage: cat <file>', 'err')]; const path = this.fs.norm(args[0], this.cwd); const n = this.fs.get(path); if (!n) return [o(`cat: ${path}: no such file`, 'err')]; if (n.type === 'dir') return [o(`cat: ${path}: is a directory`, 'err')];
        if (n.perm === 'locked') return [o(`cat: ${path}: PERMISSION DENIED — locked by ADMIN`, 'err'), o('hint: processes / permissions', 'dim')];
        if (path === '/system/admin.log') { story.set('adminLogRead', true); this.onEvent('adminLogRead'); }
        if (path === '/logs/exceptions.log') return [o(`[exceptions] ${story.data.stats.compiles} rule applications, ${story.data.stats.deaths} terminations.`), o(`[exceptions] corruption: ${Math.round(story.data.corruption)}%`), o('[exceptions] unauthorised modifications: all of them.')];
        return (n.content ?? '').split('\n').map(t => o(t, n.corrupted ? 'warn' : undefined)); }
      case 'inspect': { if (!args[0]) return [o('usage: inspect <file|pid>', 'err')]; const p = this.procs.find(args[0]); if (p) return [o(`pid ${p.pid}  ${p.name}`, 'head'), o(`state: ${p.state}   cpu: ${p.cpu}%`), o(p.note)]; const path = this.fs.norm(args[0], this.cwd); const n = this.fs.get(path); if (!n) return [o(`inspect: ${args[0]}: not found`, 'err')]; return [o(path, 'head'), o(`type: ${n.type}   permission: ${n.perm}${n.corrupted ? '   CORRUPTED' : ''}${n.deleted ? '   DELETED' : ''}`), o(n.note ?? '—')]; }
      case 'restore': { if (!args[0]) return [o('usage: restore <file>', 'err')]; const path = this.fs.norm(args[0], this.cwd); const n = this.fs.get(path); if (!n || n.type !== 'file') return [o(`restore: ${path}: not found`, 'err')];
        if (n.corrupted) { n.content = ECHO_CLEAN; n.corrupted = false; n.note = 'restored'; const pr = this.procs.find('echo.exe'); if (pr) { pr.state = 'running'; pr.note = 'ECHO is back.'; } story.set('echoRestored', true); this.onEvent('echoRestored'); return [o('restoring…', 'dim'), o('ECHO.memory restored. echo.exe is running again.', 'ok'), o('"…thank you. I thought nobody would look."', 'warn')]; }
        if (n.deleted) { n.deleted = false; n.note = 'restored from archive'; return [o(`${path} restored.`, 'ok')]; } return [o(`${path} is not damaged.`, 'dim')]; }
      case 'processes': case 'ps': return [o('PID   NAME          STATE       CPU', 'head'), ...this.procs.procs.map(p => o(`${String(p.pid).padEnd(5)} ${p.name.padEnd(13)} ${p.state.padEnd(11)} ${p.cpu}%`, p.state === 'corrupted' ? 'warn' : p.state === 'frozen' ? 'ok' : undefined))];
      case 'freeze': { const r = this.procs.freeze(args[0]); if (r.ok && args[0] && /admin|^1$/.test(args[0])) this.onEvent('adminFrozen'); return [o(r.msg, r.ok ? 'ok' : 'err')]; }
      case 'resume': { const r = this.procs.resume(args[0]); return [o(r.msg, r.ok ? 'ok' : 'err')]; }
      case 'kill': { const r = this.procs.kill(args[0]); if (r.ok && /daemon|^7$/.test(args[0])) { story.set('daemonDeleted', true); this.onEvent('daemonKilled'); } return [o(r.msg, r.ok ? 'ok' : 'err')]; }
      case 'permissions': { if (!args[0]) { const out: OutLine[] = [o('path                      permission', 'head')]; const walk = (n: VNode, path: string) => { for (const c of n.children ?? []) { const p = (path === '/' ? '' : path) + '/' + c.name; if (c.type === 'file' && c.perm === 'locked') out.push(o(p.padEnd(26) + 'LOCKED (ADMIN)', 'warn')); if (c.type === 'dir') walk(c, p); } }; walk(this.fs.root, '/'); out.push(o(this.procs.adminFrozen ? 'admin.exe is FROZEN: locks can be changed.' : 'admin.exe is running: it enforces every lock.', this.procs.adminFrozen ? 'ok' : 'dim')); return out; }
        const path = this.fs.norm(args[0], this.cwd); const n = this.fs.get(path); if (!n) return [o(`permissions: ${path}: not found`, 'err')]; const act = args[1];
        if (!act) return [o(`${path}: ${n.perm}`)]; if (!this.procs.adminFrozen) return [o('permissions: ADMIN is running and rejects the change. (A frozen process cannot enforce a lock.)', 'err')];
        if (act === 'grant') { n.perm = 'open'; story.set('permissionsEdited', true); this.onEvent('permissionsEdited'); return [o(`${path} unlocked.`, 'ok')]; } if (act === 'revoke') { n.perm = 'locked'; return [o(`${path} locked.`, 'warn')]; } return [o('usage: permissions <file> grant|revoke', 'err')]; }
      case 'delete': { const path = this.fs.norm(args[0] ?? '', this.cwd); const n = this.fs.get(path); if (!n) return [o('delete: not found', 'err')]; if (n.perm === 'locked') return [o('delete: PERMISSION DENIED', 'err')]; this.fs.remove(path); if (path === '/entities/daemon.rules') { story.set('daemonDeleted', true); this.onEvent('daemonDeleted'); } return [o(`${path} deleted.`, 'warn')]; }
      case 'repair': case 'purge': { const path = this.fs.norm(args[0] ?? '', this.cwd); if (path !== '/system/kernel.rules') return [o(`${cmd}: only /system/kernel.rules`, 'err')]; const n = this.fs.get(path)!; if (n.perm === 'locked') return [o(`${cmd}: PERMISSION DENIED — freeze admin.exe and grant access first`, 'err')];
        if (cmd === 'repair') { story.set('kernelRepaired', true); this.onEvent('kernelRepaired'); return [o('kernel.rules repaired: null.exists = true; loop.restart_on_exit = false;', 'ok')]; } story.set('kernelPurged', true); this.onEvent('kernelPurged'); return [o('kernel.rules purged. EDEN has nothing left to run.', 'warn')]; }
      default: return [o(`${cmd}: command not found. Try 'help'.`, 'err')];
    }
  }
}
