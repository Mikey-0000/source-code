# Architecture

```
src/
  main.ts            boot → title → game / EDEN OS flow, window.__eden debug hook, ?skipboot
  core/              Util, Settings (persisted, accessibility), Input (rebindable keys)
  editor/            Rule language: RuleParser → RuleValidator → RuleInterpreter, CodeEditor UI, RuleSchema
  game/
    physics/         Pure physics formulas (jump velocity, air time, range)
    levels/          LevelTypes + Levels (6 levels: boot_01, boot_02, exc_01..03, boss_watcher)
    systems/         World (pure simulation), Corruption, Renderer
    scenes/          GameScene: loop, DOM layout, compile flow, cutscenes, pause
  art/ effects/ audio/   Procedural pixel art, WebGL post-FX, WebAudio
  narrative/         StoryFlags, Endings (derived from decision flags)
  storage/           Versioned save with checksum + backup slot
  os/                EDEN OS: virtual filesystem, process manager, terminal, desktop
  ui/                HUD, dialogue, console, editor panel, menus, settings
  tests/             node:test unit + puzzle-solvability tests
tests-e2e/run.mjs    Playwright (system Chrome) end-to-end test + screenshots
```

## The functional-programming mechanic (rule language)
`player.jumpHeight = 120;` style source is tokenised and parsed by a recursive-descent parser into an AST, statically validated against a per-level **schema** (which objects/properties exist, ranges, feature tier), then run by a **tree-walking interpreter** on a *draft copy* of the rule state. Only if the whole program succeeds is the draft committed atomically to the live `World`; a failure leaves the world untouched.

Sandbox guarantees: no `eval` / `new Function`, forbidden identifiers rejected, limits of 4000 steps, 64 iterations per loop, arrays of ≤32, nesting depth ≤12 and 4000 characters. `adminOnly` properties can only be written by ADMIN's protected (locked) lines, which the editor refuses to edit and the compiler re-checks by normalised text. Feature tiers unlock progressively (numbers → booleans → conditions → variables → loops → arrays → functions).

## Physics
Fixed 60 Hz step, 32 px tiles, axis-separated 1 px stepping. Launch velocity `v = sqrt(2·g·h) + g/2`; `airTime = floor(2v/g)`; range = `speed · airTime`. Coyote time 6 frames, jump buffer 6 frames, variable jump (cut 0.45). The editor shows a live preview arc computed from the same formulas.

## Corruption
A pure function of changed rule values: +2 per ordinary property, +4 per sensitive one (door, laser, enemy, platform, watcher, camera). STABLE <33, UNSTABLE ≥33 (cameras, hidden memories), CRITICAL ≥66 (HUNTER spawns, screen distortion). Totals across levels are the sum of stored per-level contributions plus the current level.

## Rendering
Canvas 2D at 640x360 logical pixels: pre-rendered tile layer, parallax, lightmap (`destination-out` radial gradients), procedural sprites, particles → WebGL post shader scaled to the window. HUD, dialogue, editor, menus and EDEN OS are DOM for accessibility.
