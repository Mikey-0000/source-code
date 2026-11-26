# Asset manifest & licences

Every visual and audio asset in SOURCE CODE is **generated procedurally at runtime from code in this repository**. No external images, fonts, audio files, sprite sheets or third-party art are bundled, so there are no third-party asset licences to track. `public/assets/` is intentionally empty (placeholder folders for future exported art).

| Asset group | Where it is made | Notes |
|---|---|---|
| NULL (idle/run/jump/fall/land/damage/death, 32x40) | `src/art/Sprites.ts` | Faceless silhouette, crimson eye (`drawEye`) |
| ECHO, DAEMON (calm + hostile), terminal, checkpoint, spikes, platforms, cameras, monitors, exit gate | `src/art/Sprites.ts` | Pixel art drawn with `Painter` primitives |
| Tile layer, 3-layer parallax backgrounds (boot / exception / root themes) | `src/art/Environment.ts` | Seeded RNG, deterministic |
| Title key art (animated eye, code rain, NULL silhouette) | `src/art/TitleArt.ts` | |
| THE WATCHER boss | `src/game/systems/Renderer.ts` (`drawBoss`) | |
| Sound effects and music drones | `src/audio/AudioEngine.ts` | WebAudio oscillators and noise; no samples |
| CRT / chromatic aberration / VHS post effect | `src/effects/PostFX.ts` | WebGL fragment shader, with a 2D fallback |
| Typeface | system monospace stack (IBM Plex Mono, Space Mono, Consolas, DejaVu Sans Mono) | Not bundled; falls back to what the OS provides |

All original work by this project; licensed under the repository licence. Dev tooling (TypeScript, esbuild, tsx, Playwright, @types/node) is used under its own open-source licences and is not shipped in `dist/`.
