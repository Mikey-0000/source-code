import { buildBackdropScanline, buildCamera, buildCheckpoint, buildDaemon, buildEcho, buildExit, buildMonitor, buildNullSheets, buildPlatform, buildSpike, buildTerminal, type NullSheets } from './Sprites';
import { canvas } from './Painter';
export interface AssetSet {
  nullR: NullSheets; nullL: NullSheets; echo: HTMLCanvasElement[]; daemonCalm: HTMLCanvasElement[]; daemonHostile: HTMLCanvasElement[]; terminal: HTMLCanvasElement[]; checkpoint: HTMLCanvasElement[];
  spike: HTMLCanvasElement; spikeDown: HTMLCanvasElement; camera: HTMLCanvasElement[]; monitor: HTMLCanvasElement[]; exit: HTMLCanvasElement[]; scan: HTMLCanvasElement; platform: (w: number, k: 'solid' | 'broken' | 'moving' | 'ghost') => HTMLCanvasElement;
}
let cache: AssetSet | null = null;
export function assets(): AssetSet {
  if (cache) return cache;
  const n = buildNullSheets(); const d = buildDaemon(); const spike = buildSpike(); const [sd, sx] = canvas(32, 32); sx.translate(0, 32); sx.scale(1, -1); sx.drawImage(spike, 0, 0);
  const pc = new Map<string, HTMLCanvasElement>();
  cache = { nullR: n.right, nullL: n.left, echo: buildEcho(), daemonCalm: d.calm, daemonHostile: d.hostile, terminal: buildTerminal(), checkpoint: buildCheckpoint(), spike, spikeDown: sd, camera: buildCamera(), monitor: buildMonitor(), exit: buildExit(), scan: buildBackdropScanline(),
    platform: (w, k) => { const key = w + k; let c = pc.get(key); if (!c) { c = buildPlatform(w, k); pc.set(key, c); } return c; } };
  return cache;
}
