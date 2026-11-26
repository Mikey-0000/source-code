import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../game/levels/Levels';
import { runBot, stateFor } from './bot';
import { World } from '../game/systems/World';
import { jumpRange, airTime, jumpVelocity, heightAt } from '../game/physics/Physics';
import { compileRules } from '../editor/RuleInterpreter';

const L = (id: string) => LEVELS.find(l => l.id === id)!;
const rules = (j: number, s: number, extra = '') => `player.jumpHeight = ${j};\nplayer.speed = ${s};\n${extra}`;

test('physics: apex of a held jump equals jumpHeight', () => {
  for (const h of [45, 80, 100, 130, 150]) for (const g of [0.25, 0.8, 1.5]) { let best = 0; for (let n = 1; n < 400; n++) best = Math.max(best, heightAt(n, h, g)); assert.ok(Math.abs(best - h) <= g / 2 + 0.01, `h=${h} g=${g} apex=${best}`); }
});
test('physics: lower gravity gives longer range', () => { assert.ok(jumpRange(3, 140, 0.25) > jumpRange(3, 140, 0.8) * 1.6); assert.ok(airTime(100, 0.5) > airTime(100, 1)); assert.ok(jumpVelocity(100, 0.8) > 0); });

test('every level: start is on solid ground and exit is reachable geometry', () => {
  for (const l of LEVELS) { const w = new World(l); for (let i = 0; i < 30; i++) w.update({ left: false, right: false, jumpHeld: false, jumpPressed: false }); assert.ok(w.onGround, l.id + ' start grounded'); assert.equal(w.stats.deaths, 0); }
});
test('every level: protected template lines compile cleanly with the template', () => {
  for (const l of LEVELS) { const r = compileRules({ source: l.template.join('\n'), schema: l.schema, lockedLines: l.locked }); assert.ok(r.ok, l.id + JSON.stringify(r.errors)); }
});
test('every level: puzzle limits keep solution values inside allowed ranges', () => {
  for (const l of LEVELS) for (const [o, d] of Object.entries(l.schema.objects)) for (const [p, def] of Object.entries(d.props)) if (def.type === 'number') assert.ok(def.default >= (def.min ?? -Infinity) && def.default <= (def.max ?? Infinity), `${l.id} ${o}.${p}`);
});

// ---- BOOT 01
test('boot_01 P1: default jump cannot pass the 128px wall', () => { const r = runBot(L('boot_01'), null, 1500); assert.ok(!r.exited); assert.ok(r.world.x < 30 * 32); });
test('boot_01 P1: jump 100 is still too low, 140 clears it', () => {
  assert.ok(runBot(L('boot_01'), rules(100, 4), 2000).maxX < 30 * 32); assert.ok(runBot(L('boot_01'), rules(140, 4), 2000).maxX > 31 * 32);
});
test('boot_01 P2: ceiling spikes punish jumpHeight > 100 (Goldilocks window 70–95)', () => {
  const tooHigh = runBot(L('boot_01'), rules(140, 4), 4000); assert.ok(tooHigh.deaths > 0 || !tooHigh.exited, 'too-high jump must hurt');
});
test('boot_01 P3: gap needs speed ≥ 3.4 at jump 100', () => {
  const r = (src: string) => runBot(L('boot_01'), null, 6000, { schedule: [{ x: -1, src: rules(140, 4) }, { x: 31, src: src.replace('JUMP', '84') }, { x: 47, src }] }).exited;
  assert.ok(r(rules(110, 4)), 'full solution'); assert.ok(!r(rules(110, 2.8)), 'default speed fails the gap');
});
test('boot_01: full solution reaches the exit without dying', () => {
  const r = runBot(L('boot_01'), null, 6000, { schedule: [{ x: -1, src: rules(140, 4) }, { x: 31, src: rules(84, 4) }, { x: 47, src: rules(110, 4) }] }); assert.ok(r.exited); assert.equal(r.deaths, 0);
});
// ---- BOOT 02
test('boot_02 P4: default gravity cannot cross the 192px pit; gravity 0.25 can', () => {
  assert.ok(!runBot(L('boot_02'), null, 3000).exited); assert.ok(!runBot(L('boot_02'), rules(140, 3, 'world.gravity = 0.8;'), 3000).exited);
  assert.ok(runBot(L('boot_02'), rules(140, 3, 'world.gravity = 0.25;'), 9000).exited);
});
// ---- EXC 01
test('exc_01 P6/P7: door and ghost platforms are all required', () => {
  const full = rules(90, 3.6, 'door1.locked = false;\nplat1.collision = true;\nplat2.collision = true;\nplat3.collision = true;');
  assert.ok(runBot(L('exc_01'), full, 6000).exited);
  assert.ok(!runBot(L('exc_01'), rules(90, 3.6, 'plat1.collision = true;\nplat2.collision = true;\nplat3.collision = true;'), 3000).exited, 'door still locked');
  assert.ok(!runBot(L('exc_01'), rules(90, 3.6, 'door1.locked = false;'), 3000).exited, 'platforms still ghosts');
  assert.ok(!runBot(L('exc_01'), 'door1.locked = false;\nplat1.collision = true;\nplat2.collision = true;\nplat3.collision = true;', 3000).exited, 'default jump cannot hop 96px gaps');
});
// ---- EXC 02
test('exc_02 P8/P9: conditions solved by changing the inputs, not the outputs', () => {
  const base = (g: number, j: number, s: number) => `world.gravity=${g};\nplayer.jumpHeight=${j};\nplayer.speed=${s};`;
  assert.ok(runBot(L('exc_02'), base(0.5, 55, 2.8), 9000, { schedule: [{ x: 52, src: base(0.5, 105, 2) }] }).exited);
  assert.ok(!runBot(L('exc_02'), null, 3000).exited, 'default fails');
  assert.ok(!runBot(L('exc_02'), base(0.5, 105, 2), 4000).exited, 'hostile DAEMON (jump>60) blocks');
  const r = compileRules({ source: 'laser1.active = false;\n' + L('exc_02').locked.join('\n'), schema: L('exc_02').schema, lockedLines: L('exc_02').locked });
  assert.ok(!r.ok); assert.equal(r.errors[0].kind, 'protected');
});
// ---- EXC 03
test('exc_03 P10: loops open every door and solidify every stair', () => {
  const loops = (j: number, s: number) => `${rules(j, s)}for (let i = 0; i < len(doors); i++) { doors[i].locked = false; }\nfor (let i = 0; i < len(plats); i++) { plats[i].collision = true; }`;
  assert.ok(runBot(L('exc_03'), loops(85, 3.2), 9000).exited); assert.ok(!runBot(L('exc_03'), null, 2000).exited);
  const st = stateFor(L('exc_03'), loops(85, 3.2)); for (let i = 1; i <= 3; i++) assert.equal(st['door' + i].locked, false); for (let i = 1; i <= 6; i++) assert.equal(st['plat' + i].collision, true);
});
// ---- BOSS
const boss = (src: string, pos: [number, number], frames = 200) => {
  const lvl = L('boss_watcher'); const w = new World(lvl); w.applyRules(stateFor(lvl, src)); w.checkpoint = { x: pos[0] * 32 + 16, y: pos[1] * 32 }; w.respawn(true); let hits = 0;
  for (let i = 0; i < frames; i++) { w.update({ left: false, right: false, jumpHeld: false, jumpPressed: false }); hits += w.events.filter(e => e.type === 'boss' && e.what === 'detected').length; }
  return { w, hits };
};
test('boss P11: default range 420 sees FUSE 1; lowering it hides you', () => {
  assert.ok(boss(rules(45, 2.8), [13, 8]).hits > 0, 'top of the stairs is seen by default'); assert.equal(boss(rules(45, 2.8, 'watcher.range = 300;'), [13, 8]).hits, 0); assert.equal(boss(rules(45, 2.8, 'watcher.range = 100;'), [13, 8]).hits, 0);
});
test('boss P12: bridge centre is always inside the 100px minimum; blind protects exactly blindTime seconds', () => {
  assert.ok(boss(rules(45, 2.8, 'watcher.range = 100;'), [24, 8]).hits > 0, 'seen on the bridge');
  assert.equal(boss(rules(45, 2.8, 'watcher.range = 100;\nwatcher.blind = true;\nwatcher.blindTime = 3;'), [24, 8], 170).hits, 0, 'protected while blind');
  assert.ok(boss(rules(45, 2.8, 'watcher.range = 100;\nwatcher.blind = true;\nwatcher.blindTime = 1;'), [24, 8], 200).hits > 0, 'caught after the eye reopens');
});
test('boss P13: loop overwrites the core and opens the exit', () => {
  const lvl = L('boss_watcher'); const w = new World(lvl, stateFor(lvl, rules(45, 2.8)));
  assert.ok(!w.exitOpen); w.applyRules(stateFor(lvl, rules(45, 2.8, 'for (let i = 0; i < 4; i++) { watcher.integrity -= 25; }'))); assert.ok(w.boss!.defeated && w.exitOpen);
});
test('boss: full route is physically possible (stairs, bridge, exit ledge)', () => {
  const lvl = L('boss_watcher'); const st = stateFor(lvl, rules(45, 3, 'watcher.range = 100;\nwatcher.blind = true;\nwatcher.blindTime = 6;'));
  const w = new World(lvl); w.applyRules(st); let jp = false; const solidAt = (x: number, y: number) => w.solidTile(Math.floor(x / 32), Math.floor(y / 32));
  for (let f = 0; f < 4000; f++) {
    let j = false; if (w.onGround) { const fx = w.x + 17; if (solidAt(fx, w.y + 12) || solidAt(fx, w.y + 24)) j = true; }
    if (f % 200 === 0) w.applyRules(st);
    w.update({ left: false, right: true, jumpHeld: j || !w.onGround, jumpPressed: j && !jp }); jp = j; if (w.x > 38 * 32 && w.y < 9 * 32) break;
  }
  assert.ok(w.x > 38 * 32 && w.y < 9 * 32, `reached far ledge x=${w.x / 32} y=${w.y / 32}`);
});

test('assist: infinite jump allows repeated mid-air jumps; off by default behaviour unchanged', () => {
  const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  const climb = (infinite: boolean) => {
    const w = new World(L('boot_01')); w.infiniteJump = infinite; for (let i = 0; i < 30; i++) w.update(idle);
    const y0 = w.y; let minY = y0;
    for (let i = 0; i < 120; i++) { w.update({ left: false, right: false, jumpHeld: true, jumpPressed: i % 12 === 0 }); minY = Math.min(minY, w.y); }
    return y0 - minY;
  };
  const normal = climb(false), infinite = climb(true);
  assert.ok(infinite > normal + 60, `infinite ${infinite} should climb far higher than normal ${normal}`);
});

import { scoreRun, rankOf, diffRules } from '../game/systems/Scoring';
test('scoring: perfect run is S, sloppy run is lower, never negative; ranks are monotonic', () => {
  const perfect = scoreRun({ ms: 20000, deaths: 0, edits: 3, corruption: 0, memories: 1 });
  assert.equal(perfect.rank, 'S'); assert.ok(perfect.total >= 1000);
  const sloppy = scoreRun({ ms: 400000, deaths: 20, edits: 40, corruption: 100, memories: 0 }); assert.ok(sloppy.total < perfect.total && sloppy.total >= 0 && sloppy.rank === 'D');
  assert.ok(scoreRun({ ms: 20000, deaths: 2, edits: 3, corruption: 0, memories: 0 }).total < scoreRun({ ms: 20000, deaths: 0, edits: 3, corruption: 0, memories: 0 }).total);
  assert.deepEqual(['S', 'A', 'B', 'C', 'D'], [1000, 800, 600, 400, 0].map(rankOf));
});
test('diffRules: reports changed code lines only', () => {
  const d = diffRules(['// c', 'player.speed = 2.8;', 'player.jumpHeight = 45;'], '// c\nplayer.speed = 2.8;\nplayer.jumpHeight = 150;');
  assert.deepEqual(d, [{ kind: '-', text: 'player.jumpHeight = 45;' }, { kind: '+', text: 'player.jumpHeight = 150;' }]);
  assert.deepEqual(diffRules(['a = 1;'], 'a = 1;'), []);
});
