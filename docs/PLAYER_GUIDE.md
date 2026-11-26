# SOURCE CODE — Player guide

## The idea
You are **NULL**, a faceless entity inside **PROJECT EDEN**, a simulation whose rules are written in code. Some jumps are impossible with the default rules — so you rewrite the rules. Reach the exit gate of every sector.

## Controls
| Action | Keys |
|---|---|
| Move | A / D or ← → |
| Jump | Space, W or ↑ |
| Interact / read terminals and dialogue | E |
| Open or close the source editor | Tab |
| **Apply your code** | **Ctrl + Enter** |
| Leave the editor (without applying) | Esc or Tab |
| Pause menu (settings, how to play, restart) | Esc or P |
| Respawn at checkpoint | R |
| Debug overlay (inspect objects by clicking them) | F3 or B |
| **Toggle infinite jump** | **J** |

All keys can be rebound in Settings. While the editor is focused, every key types into it — leave it with Esc or Tab before moving.

## Using the editor
1. Open it with Tab (or at a terminal). In Sector 01 it is already unlocked once you read the first terminal.
2. Edit a value, e.g. `player.jumpHeight = 120;`. Every line ends with `;`. `//` starts a comment — don't type stray letters in front of it.
3. The **PREVIEW** line shows apex height, air time and range; a dotted arc is drawn in the world.
4. Press **Ctrl + Enter**. The status must say **APPLIED**. `SYNTAX ERROR` means nothing changed — read the console below.
5. Stuck? **HINT** gives a nudge, **UNDO/REDO** step through edits, **RESTORE DEFAULTS** resets the file.

The language grows by chapter: numbers → booleans (`true`/`false`) → `if` conditions → variables → `for` loops → arrays → functions such as `min`, `max`, `clamp`, `len`.

## Sector 01 walkthrough (INITIALISE)
| Obstacle | Rules to apply |
|---|---|
| 4-tile wall (128 px) | `player.jumpHeight = 150;` |
| Spike tunnel (ceiling ≈ 100 px up) | `player.jumpHeight = 85;` (keep it between 70 and 95) |
| 128 px gap | `player.speed = 4;` and `player.jumpHeight = 100;` |

Re-apply at each obstacle. Checkpoints keep your progress.

## Corruption
Every changed rule raises corruption (doors, lasers, enemies, platforms and cameras cost double). **STABLE** below 33%, **UNSTABLE** from 33% (cameras appear, hidden memories show), **CRITICAL** from 66% (a HUNTER starts chasing you). ADMIN's *PROTECTED* lines cannot be edited — change the values they depend on instead.

## Assist options
- **Infinite jump** — Settings → "Infinite jump (assist)", or press **J** in-game. Jump again in mid-air as often as you like. It trivialises walls and gaps, so it is off by default; hazards (spikes, lasers, enemies) still hurt.
- Reduced motion, no flashes, high contrast, CRT off, text size, dialogue speed and key rebinding are in Settings. Progress saves automatically.

## Tips
- Read every terminal; they contain the rules of the sector.
- Lower `world.gravity` makes you float: longer air time, longer range (Sector 02).
- Speed × air time is your jump range; height and gravity set the air time.
- You can't break the game: invalid code is rejected, and RESTORE DEFAULTS always recovers.

## Feel & feedback features

- **Rewrite flash** – every successful compile triggers a shockwave, glitch mosaic and a green editor flash; errors shake the panel red.
- **Trajectory graph** – the editor shows your jump arc against the default arc (apex and range in px) before you commit.
- **Ghost replay** – after a death, your previous attempt replays as a faint ghost. Toggle in Settings → *Ghost replay*.
- **Scoring & ranks** – each sector ends with a results card (S/A/B/C/D) scoring time, deaths, edits, corruption and memories, plus a diff of your code. Best score and rank are saved.
- **Memory playback** – ECHO memories play back as a terminal sequence (E / Enter / Space / Esc to close).
- **Corruption** – at UNSTABLE the world glitches and HUD text scrambles; at CRITICAL fake pop-ups, a dissonant audio layer and a one-time simulated crash appear (progress is always safe).
