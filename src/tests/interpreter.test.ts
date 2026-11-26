import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRules, LIMITS } from '../editor/RuleInterpreter';
import type { RuleSchema } from '../editor/RuleSchema';

const mk = (features: RuleSchema['features']): RuleSchema => ({
  features,
  arrays: { doors: ['door1', 'door2', 'door3'] },
  objects: {
    player: { doc: '', props: { speed: { type: 'number', default: 2.8, min: 1, max: 6, doc: '' }, jumpHeight: { type: 'number', default: 45, min: 20, max: 180, doc: '' } } },
    world: { doc: '', props: { gravity: { type: 'number', default: 0.8, min: 0.2, max: 2, doc: '' } } },
    door1: { doc: '', props: { locked: { type: 'boolean', default: true, doc: '' } } },
    door2: { doc: '', props: { locked: { type: 'boolean', default: true, doc: '' } } },
    door3: { doc: '', props: { locked: { type: 'boolean', default: true, doc: '' } } },
  },
});
const base = mk(['arithmetic']);
const full = mk(['arithmetic', 'booleans', 'comparisons', 'conditions', 'variables', 'loops', 'arrays', 'functions']);

test('valid numeric assignment applies', () => {
  const r = compileRules({ source: 'player.speed = 4;\nplayer.jumpHeight = 60 * 2;', schema: base });
  assert.ok(r.ok); assert.equal(r.state.player.speed, 4); assert.equal(r.state.player.jumpHeight, 120); assert.equal(r.changes.length, 2);
});
test('syntax errors are reported with line numbers', () => {
  const r = compileRules({ source: 'player.speed = 4\nplayer.jumpHeight = 5;', schema: base });
  assert.ok(!r.ok); assert.equal(r.errors[0].kind, 'syntax'); assert.match(r.errors[0].msg, /';'/);
});
test('unknown property suggests correction', () => {
  const r = compileRules({ source: 'player.sped = 4;', schema: base });
  assert.ok(!r.ok); assert.match(r.errors[0].hint ?? '', /player\.speed/);
});
test('type mismatch is rejected', () => {
  const r = compileRules({ source: 'door1.locked = 3;', schema: full });
  assert.ok(!r.ok); assert.match(r.errors[0].msg, /Type mismatch/);
});
test('numeric limits are enforced and state stays untouched', () => {
  const r = compileRules({ source: 'player.speed = 9;', schema: base });
  assert.ok(!r.ok); assert.match(r.errors[0].msg, /between 1 and 6/); assert.equal(r.state.player.speed, 2.8);
});
test('locked features report unlock chapter', () => {
  const r = compileRules({ source: 'door1.locked = false;', schema: base });
  assert.ok(!r.ok); assert.match(r.errors[0].msg, /not unlocked/);
});
test('conditions and booleans', () => {
  const r = compileRules({ source: 'if (world.gravity < 1) { door1.locked = false; } else { door2.locked = false; }', schema: full });
  assert.ok(r.ok); assert.equal(r.state.door1.locked, false); assert.equal(r.state.door2.locked, true);
});
test('bounded loops and arrays', () => {
  const r = compileRules({ source: 'for (let i = 0; i < len(doors); i++) { doors[i].locked = false; }', schema: full });
  assert.ok(r.ok, JSON.stringify(r.errors)); assert.ok(['door1', 'door2', 'door3'].every(d => r.state[d].locked === false));
});
test('infinite loop is stopped by iteration limit', () => {
  const r = compileRules({ source: 'for (let i = 0; i < 100; i += 0) { player.speed = 2; }', schema: full });
  assert.ok(!r.ok); assert.equal(r.errors[0].kind, 'limit');
});
test('long loops are bounded', () => {
  const r = compileRules({ source: 'for (let i = 0; i < 1000; i++) { player.speed = 2; }', schema: full });
  assert.ok(!r.ok); assert.match(r.errors[0].msg, new RegExp(String(LIMITS.maxLoopIterations)));
});
test('array index out of range', () => {
  const r = compileRules({ source: 'doors[5].locked = false;', schema: full });
  assert.ok(!r.ok); assert.match(r.errors[0].msg, /out of range/);
});
test('division by zero', () => {
  const r = compileRules({ source: 'player.speed = 3 / 0;', schema: base });
  assert.ok(!r.ok); assert.match(r.errors[0].msg, /zero/);
});
test('host access is blocked', () => {
  for (const s of ['eval("1");', 'window.x = 1;', 'fetch(1);', 'document.cookie = 1;', 'this.x = 1;', 'constructor.x = 1;', 'player.__proto__ = 1;', 'localStorage.a = 1;', 'new Function();', 'while (true) {}']) {
    const r = compileRules({ source: s, schema: full }); assert.ok(!r.ok, s);
  }
});
test('protected lines cannot be changed or removed', () => {
  const locked = ['door1.locked = true;'];
  assert.ok(compileRules({ source: 'door1.locked = true;\nplayer.speed = 3;', schema: full, lockedLines: locked }).ok);
  const r = compileRules({ source: 'player.speed = 3;', schema: full, lockedLines: locked });
  assert.ok(!r.ok); assert.equal(r.errors[0].kind, 'protected');
});
test('compile is atomic: a failing last line applies nothing', () => {
  const r = compileRules({ source: 'player.speed = 4;\nplayer.jumpHeight = 999;', schema: base });
  assert.ok(!r.ok); assert.equal(r.state.player.speed, 2.8);
});
test('restoring defaults: empty source yields default state', () => {
  const r = compileRules({ source: '', schema: base }); assert.ok(r.ok); assert.equal(r.changes.length, 0);
});
test('step limit on heavy expressions', () => {
  const nested = 'player.speed = ' + '1+'.repeat(300) + '1;';
  const r = compileRules({ source: nested, schema: base }); assert.ok(!r.ok);
});
