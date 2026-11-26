import { C } from '../art/Palette';
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
export class Particles {
  list: P[] = [];
  emit(x: number, y: number, n: number, o: { col?: string[]; speed?: number; life?: number; g?: number; size?: number; dir?: number; spread?: number } = {}) {
    const cols = o.col ?? [C.bone, C.red];
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? 0) + (Math.random() - .5) * (o.spread ?? Math.PI * 2), s = (o.speed ?? 1.5) * (0.4 + Math.random());
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: (o.life ?? 30) * (0.6 + Math.random() * .8), col: cols[Math.floor(Math.random() * cols.length)], size: o.size ?? 1, g: o.g ?? 0.04 });
    }
  }
  update() { for (const p of this.list) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life++; } this.list = this.list.filter(p => p.life < p.max); if (this.list.length > 600) this.list.splice(0, this.list.length - 600); }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number) { for (const p of this.list) { ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.size, p.size); } ctx.globalAlpha = 1; }
}
