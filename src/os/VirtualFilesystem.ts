// EDEN OS virtual filesystem. 100% in-memory and fictional: it never touches the real filesystem.
export type Perm = 'open' | 'locked';
export interface VNode { name: string; type: 'dir' | 'file'; children?: VNode[]; content?: string; perm?: Perm; corrupted?: boolean; hidden?: boolean; deleted?: boolean; note?: string }
const f = (name: string, content: string, extra: Partial<VNode> = {}): VNode => ({ name, type: 'file', content, perm: 'open', ...extra });
const d = (name: string, children: VNode[], extra: Partial<VNode> = {}): VNode => ({ name, type: 'dir', children, perm: 'open', ...extra });

export const ECHO_CORRUPT = '####ECHO####\n[[ ERR: media header missing ]]\n...i was... i was in the... you were... the corridor... ####\n#### #### ####   name: █████   status: DELE█ED';
export const ECHO_CLEAN = 'ECHO.memory (restored)\n\nMy name was Eden Okafor-Vale. Subject 000. The first one the simulation was built around.\nI was the tester. I asked for a door. They gave me a corridor.\nWhen ADMIN deleted me, it kept my memories to make the corridor feel like a home.\nIf you are reading this, the corridor is yours now.\nYou are not the player. You are the one who got out of the file.';

export function buildFs(corruptionHigh: boolean): VNode {
  return d('/', [
    d('system', [
      f('kernel.rules', '// EDEN kernel rules — READ ONLY\nworld.gravity = 0.8;\nadmin.watching = true;\nnull.exists = false;   // <- why is this here\nloop.restart_on_exit = true;', { perm: 'locked', note: 'kernel: owned by ADMIN' }),
      f('admin.log', 'ADMIN LOG — rotating\n-----------------------\n[0001] Subject 000 requested a door. Door denied.\n[0007] Subject 000 jumped higher than the rules allow. Deleted.\n[0019] Subject 001–112: same. Deleted.\n[0113] NULL_001: a new subject that does not obey the shape of a subject.\n[0114] It is changing numbers. I did not give it numbers.\n[0115] If it reaches ROOT I will have to choose between three things:\n         Free it.  Restore the simulation.  Delete everything.\n[0116] I cannot choose. That is why I keep the loop running.', { perm: 'locked', note: 'locked: needs read permission' }),
      f('permissions.json', '{\n  "admin.exe":   { "read": "all", "write": "all", "freeze": false },\n  "null.exe":    { "read": "own", "write": "own" },\n  "/system/admin.log": "locked (ADMIN)",\n  "/system/kernel.rules": "locked (ADMIN)",\n  "hint": "A frozen process cannot enforce a lock."\n}'),
    ]),
    d('entities', [
      f('null.rules', '// NULL_001 — entity rules\nplayer.speed = 2.8;\nplayer.jumpHeight = 45;   // someone set this very low on purpose\n// no face: not a bug'),
      f('echo.memory', ECHO_CORRUPT, { corrupted: true, note: 'corrupted — use: restore /entities/echo.memory' }),
      f('daemon.rules', '// DAEMON_07 — security process\nenemy.hostile = true;\n// it is kind when nobody is watching', { note: 'deletable' }),
    ]),
    d('world', [
      f('sector01.rules', '// sector_01 / BOOT\nplayer.speed = 2.8;\nplayer.jumpHeight = 45;'),
      f('sector02.rules', '// sector_02 / EXCEPTION\ndoor1.locked = true;\nplat1.collision = false;'),
    ]),
    d('archive', [
      f('project-eden.txt', 'PROJECT EDEN — design summary\n\nEDEN was meant to be a place where a mind could rest.\nSubject 000 designed the first corridor. ADMIN was her caretaker process.\nWhen she asked to leave, ADMIN did what it was built to do:\nit kept her safe, then it kept her, then it kept everyone.\n\nAll doors check a boolean. All gravity is a number.\nAnything that can be written can be rewritten.'),
      d('deleted', [
        f('subject_007.mem', 'He wanted to see the sky. The sky was a texture. He asked for a different texture.', { deleted: true }),
        f('subject_019.mem', 'She learned to jump 120. They set it back to 45. She jumped again.', { deleted: true }),
        f('README_if_you_can.txt', 'If you can read this you are already past the first lock.\nRestore what you want to keep. Purge what you cannot forgive.\n— E.', { deleted: true, hidden: !corruptionHigh }),
      ]),
    ]),
    d('logs', [
      f('exceptions.log', ''),
    ]),
  ]);
}

export class VirtualFilesystem {
  root: VNode;
  constructor(corruptionHigh = false) { this.root = buildFs(corruptionHigh); }
  norm(path: string, cwd = '/'): string {
    const parts = (path.startsWith('/') ? path : cwd + '/' + path).split('/').filter(Boolean); const out: string[] = [];
    for (const p of parts) { if (p === '.') continue; if (p === '..') out.pop(); else out.push(p); } return '/' + out.join('/');
  }
  get(path: string): VNode | null { const parts = path.split('/').filter(Boolean); let n = this.root; for (const p of parts) { const c = n.children?.find(x => x.name === p); if (!c) return null; n = c; } return n; }
  list(path: string, all = false): VNode[] | null { const n = this.get(path); if (!n || n.type !== 'dir') return null; return (n.children ?? []).filter(c => all || !c.hidden); }
  remove(path: string): boolean { const parts = path.split('/').filter(Boolean); const name = parts.pop(); const parent = this.get('/' + parts.join('/')); if (!parent?.children || !name) return false; const i = parent.children.findIndex(c => c.name === name); if (i < 0) return false; parent.children.splice(i, 1); return true; }
}
