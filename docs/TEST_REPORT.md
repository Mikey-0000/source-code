# Test report

Run on 2026-11-26 in a headless Linux container (Node, system Google Chrome via Playwright, WebGL through SwiftShader).

| Suite | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | clean |
| Unit + puzzle tests | `npm test` | **36 / 36 pass** |
| Browser end-to-end | `npm run build && npm run test:e2e` | **23 / 23 checks pass**, 0 console errors (`docs/E2E_RESULTS.json`) |

## Unit tests (`src/tests`)
- **interpreter.test.ts (17):** arithmetic, booleans, conditions, loops, arrays, functions, step/iteration limits, forbidden identifiers, atomic commit on failure, protected-line enforcement, `adminOnly`.
- **puzzles.test.ts (19, incl. infinite-jump assist):** physics formulas; level sanity; a headless greedy bot proves every puzzle in boot_01, boot_02, exc_01–03 and the boss route is **solvable with the intended rules and unsolvable with the defaults**.

## End-to-end checks (`tests-e2e/run.mjs`)
Boot gate and title; canvas actually renders; player moves and jumps; typing in the editor updates the live preview; Ctrl+Enter applies rules to the running world; a syntax error is reported and leaves the world unchanged; out-of-range values are rejected; corruption responds to changes; reaching the exit shows SECTOR COMPLETE and CONTINUE loads the next level; all six levels render with the editor open; EDEN OS opens; no console or page errors.

## Bugs found by browser testing and fixed
1. Frame loop only started after the intro dialogue closed, so the world was black behind it.
2. Post-FX vignette used `smoothstep` with reversed edges (undefined in GLSL).
3. `[hidden]` was overridden by `display` rules (overlays visible while hidden).
4. Game grid auto-placed `<main>` into the wrong row when the title bar was hidden, shrinking the canvas after the editor closed.
5. EDEN OS popup text clipped; scene too dark.

## Not verified
Real GPU hardware (only SwiftShader), real audio output (WebAudio runs but cannot be heard here), Safari/Firefox, touch devices, long-session performance, and screen-reader behaviour. Screenshots are in `docs/screenshots/`.
