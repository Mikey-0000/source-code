// Animated cover art for the title screen: giant crimson eye, tiny faceless silhouette, corrupted data. Drawn at 640x360, upscaled with nearest-neighbour.
import { C, VIEW_H, VIEW_W } from './Palette';
import { assets } from './Assets';
import { drawEye } from './Sprites';
import { hash2 } from '../core/Util';
import { rect, px, type Ctx } from './Painter';

const SNIPPETS = ['player.jumpHeight = 45;', 'if (admin.watching) { hide(); }', 'door.locked = true;', 'for (let i = 0; i < len(memories); i++)', 'world.gravity = 0.8;', 'entity NULL_001 :: checksum FAILED', 'enemy.hostile = true;', 'ECHO.memory = null;', 'platform.collision = false;', 'delete /entities/echo.memory'];

export function drawTitleArt(ctx: Ctx, t: number, mouse: [number, number], open = 1) {
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // dithered red haze behind the eye
  for (let y = 0; y < VIEW_H; y += 2) for (let x = (y / 2) % 2 * 2; x < VIEW_W; x += 4) { const dx = (x - 430) / 300, dy = (y - 170) / 170; const d = Math.sqrt(dx * dx + dy * dy); if (d < 1 && hash2(x, y) > d * 1.1) px(ctx, x, y, d < 0.5 ? C.darkRed : '#1a0609'); }
  // drifting code rain
  ctx.font = '8px "Space Mono", Consolas, "DejaVu Sans Mono", monospace'; ctx.textBaseline = 'top';
  for (let i = 0; i < 16; i++) { const s = SNIPPETS[i % SNIPPETS.length]; const x = (hash2(i, 1) * 700 - (t * (4 + (i % 5) * 2)) % 700 + 700) % 700 - 60, y = 12 + (i * 23) % 330; ctx.fillStyle = i % 4 === 0 ? 'rgba(255,38,61,0.35)' : 'rgba(229,229,229,0.10)'; ctx.fillText(s, Math.round(x), y); }
  // fragmented geometry
  for (let i = 0; i < 26; i++) { const a = i * 0.7 + t * 0.05 * (i % 3 + 1), r = 120 + hash2(i, 2) * 150; const x = 430 + Math.cos(a) * r, y = 170 + Math.sin(a) * r * 0.62; const w = 6 + hash2(i, 3) * 26, h = 3 + hash2(i, 4) * 10; rect(ctx, x, y, w, h, i % 5 === 0 ? C.dimRed : i % 2 ? C.ink : C.steel); rect(ctx, x, y, w, 1, i % 3 ? C.steel2 : C.bone); }
  // eye follows pointer
  const look: [number, number] = [Math.max(-1, Math.min(1, (mouse[0] - 430) / 260)), Math.max(-1, Math.min(1, (mouse[1] - 170) / 140))];
  const blink = Math.sin(t * 0.6) > 0.97 ? 0.15 : 1;
  if (open >= 1) drawEye(ctx, 430, 170, 96, t, look, blink, Math.sin(t * 0.37) > 0.9 ? 2 : 0.3);
  else { // the eye slowly opens: clip to a lens that grows, and glow through the slit
    const h = Math.max(1.5, 66 * open); ctx.save(); ctx.beginPath(); ctx.ellipse(430, 170, 110, h, 0, 0, Math.PI * 2); ctx.clip(); drawEye(ctx, 430, 170, 96, t, look, Math.max(0.2, open), 0.3 + (1 - open) * 2); ctx.restore();
    ctx.strokeStyle = `rgba(255,38,61,${0.25 + (1 - open) * 0.5})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(430, 170, 110, h, 0, 0, Math.PI * 2); ctx.stroke(); }
  // ground + silhouette
  rect(ctx, 0, 318, VIEW_W, 42, '#0c0c0e'); rect(ctx, 0, 318, VIEW_W, 2, C.steel2); for (let x = 0; x < VIEW_W; x += 16) rect(ctx, x, 324, 8, 1, C.steel3);
  const A = assets(); const f = A.nullR.idle.frames[Math.floor(t * 3) % 4]; ctx.drawImage(f, 96, 280);
  // shadow of the eye's light on the ground
  ctx.fillStyle = 'rgba(255,38,61,0.12)'; ctx.fillRect(0, 320, VIEW_W, 4);
  // horizontal glitch tear
  if (Math.sin(t * 1.9) > 0.94) { const y = Math.floor(hash2(Math.floor(t * 20), 7) * 300); ctx.drawImage(ctx.canvas, 0, y, VIEW_W, 6, 14, y, VIEW_W, 6); }
}
