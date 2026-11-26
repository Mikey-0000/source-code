/** Consistent physics units: pixels, frames (60 Hz). Tile = 32 px. */
export const DT = 1 / 60;
export const TILE = 32;
export const PHYS = { coyote: 6, buffer: 6, accelGround: 0.22, accelAir: 0.14, frictionGround: 0.30, frictionAir: 0.05, jumpCut: 0.45, maxFall: 14, hitW: 14, hitH: 28 };

/** Initial upward velocity (px/frame) so the discrete-integrated jump apex equals `jumpHeight` px. */
export function jumpVelocity(jumpHeight: number, gravity: number): number { return Math.sqrt(2 * gravity * jumpHeight) + gravity / 2; }
/** Apex of a held jump under semi-implicit Euler (vy += g; y += vy). */
export function jumpApex(jumpHeight: number, _gravity: number): number { return jumpHeight; }
/** Frames in the air for a jump landing at the same height. */
export function airTime(jumpHeight: number, gravity: number): number { const v = jumpVelocity(jumpHeight, gravity); return Math.floor(2 * v / gravity); }
/** Horizontal range (px) of a flat jump at full speed. */
export function jumpRange(speed: number, jumpHeight: number, gravity: number): number { return speed * airTime(jumpHeight, gravity); }
/** Height (px above take-off) after n frames. */
export function heightAt(n: number, jumpHeight: number, gravity: number): number { const v = jumpVelocity(jumpHeight, gravity); return n * v - gravity * n * (n + 1) / 2; }
/** Time-window (frames) during which the body is at least `h` px above take-off height. */
export function framesAbove(h: number, jumpHeight: number, gravity: number): number {
  let n = 0; for (let f = 1; f < 600; f++) { if (heightAt(f, jumpHeight, gravity) >= h) n++; else if (n) break; } return n;
}
/** Horizontal distance (px) covered while at least `h` px above take-off: how far you can reach a ledge `h` higher. */
export function reachAtHeight(speed: number, h: number, jumpHeight: number, gravity: number): number {
  // distance from take-off to the last frame still at height >= h
  let last = 0; for (let f = 1; f < 600; f++) { if (heightAt(f, jumpHeight, gravity) >= h) last = f; else if (last) break; } return speed * last;
}
