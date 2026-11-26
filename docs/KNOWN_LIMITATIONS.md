# Known limitations & disclosed deviations

This is a **vertical slice** (BOOT + EXCEPTION). Please read this before judging completeness.

## Not implemented
- Chapters 3–6 (only chapters 1–2 are playable). The ending-scoring logic exists but the full branching campaign does not.
- Bosses other than THE WATCHER (no STACK OVERFLOW, COMPILER or ADMIN fights).
- Touch / mobile controls. The title screen warns about this; keyboard is required.
- Hand-authored sprite-sheet art files; `public/assets/` is empty by design (see ASSET_MANIFEST.md).

## Deviations from the specified stack
Network access was unavailable for installing packages, so instead of Vite / Phaser / CodeMirror / GSAP / Vitest this uses: esbuild for bundling, a custom Canvas-2D engine, a custom textarea-based code editor with syntax highlighting, CSS/JS tweens, and `node:test` via `tsx`. Behaviour (not library choice) is what is tested.
- Logical resolution is 640x360 (upscaled with nearest-neighbour + CRT shader); sprites are 32x40 rather than larger sheets.

## Other caveats
- Audio is fully procedural and was not audibly reviewed.
- Visuals were inspected via headless-Chrome screenshots only; some areas are quite dark by design.
- The GitHub Actions workflow publishes to GitHub Pages; Pages must be enabled for the repository (Settings → Pages → Source: GitHub Actions).
