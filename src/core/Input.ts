import { settings } from './Settings';
class InputSystem {
  private down = new Set<string>(); private pressedSet = new Set<string>(); private releasedSet = new Set<string>();
  enabled = true; private rebind: ((code: string) => void) | null = null;
  constructor() {
    addEventListener('keydown', e => {
      if (this.rebind) { e.preventDefault(); const f = this.rebind; this.rebind = null; f(e.code); return; }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
      if (typing) return;
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
      if (this.enabled && (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab' || e.code === 'F3') && !typing) e.preventDefault();
    });
    addEventListener('keyup', e => { this.down.delete(e.code); this.releasedSet.add(e.code); });
    addEventListener('blur', () => { this.down.clear(); });
  }
  private any(set: Set<string>, action: string) { return (settings.keys[action] ?? []).some(k => set.has(k)); }
  held(action: string) { return this.enabled && this.any(this.down, action); }
  pressed(action: string) { return this.enabled && this.any(this.pressedSet, action); }
  released(action: string) { return this.any(this.releasedSet, action); }
  /** Call once per rendered frame after logic consumed input. */
  endFrame() { this.pressedSet.clear(); this.releasedSet.clear(); }
  captureNextKey(cb: (code: string) => void) { this.rebind = cb; }
  /** Test hook / touch controls */
  simulate(code: string, down: boolean) { if (down) { if (!this.down.has(code)) this.pressedSet.add(code); this.down.add(code); } else { this.down.delete(code); this.releasedSet.add(code); } }
}
export const input = new InputSystem();
