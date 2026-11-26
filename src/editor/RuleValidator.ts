import { parse, RuleSyntaxError, type Expr, type Program, type Stmt } from './RuleParser';
import { FEATURE_INFO, FUNCTIONS, type Feature, type RuleSchema } from './RuleSchema';

export interface RuleError { line: number; col: number; msg: string; hint?: string; kind: 'syntax' | 'validation' | 'runtime' | 'limit' | 'protected' }
type T = 'number' | 'boolean' | 'object' | 'array' | 'unknown';

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function suggest(word: string, options: string[]): string | undefined {
  let best: string | undefined, bd = 3;
  for (const o of options) { const d = lev(word.toLowerCase(), o.toLowerCase()); if (d < bd) { bd = d; best = o; } }
  return best;
}

export function parseSafe(src: string): { program?: Program; error?: RuleError } {
  try { return { program: parse(src) }; }
  catch (e) {
    if (e instanceof RuleSyntaxError) return { error: { line: e.line, col: e.col, msg: e.msg, hint: e.hint, kind: 'syntax' } };
    throw e;
  }
}

/** Static validation: unlocked features, unknown names, property types. Runtime checks (ranges, limits) live in the interpreter. */
export function validate(program: Program, schema: RuleSchema): RuleError[] {
  const errors: RuleError[] = [];
  const features = new Set<Feature>(schema.features);
  const objNames = Object.keys(schema.objects), arrNames = Object.keys(schema.arrays);
  const scopes: Map<string, T>[] = [new Map()];
  const lookupVar = (n: string) => { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(n)) return scopes[i].get(n); return undefined; };
  const add = (line: number, col: number, msg: string, hint?: string) => errors.push({ line, col, msg, hint, kind: 'validation' });
  const need = (f: Feature, line: number, col: number) => {
    if (!features.has(f)) { add(line, col, `${FEATURE_INFO[f].label} is not unlocked yet`, `Unlocks in ${FEATURE_INFO[f].unlock}.`); return false; }
    return true;
  };

  const type = (e: Expr): T => {
    switch (e.t) {
      case 'num': return 'number';
      case 'bool': need('booleans', e.line, e.col); return 'boolean';
      case 'id': {
        if (objNames.includes(e.name)) return 'object';
        if (arrNames.includes(e.name)) { need('arrays', e.line, e.col); return 'array'; }
        const v = lookupVar(e.name); if (v) return v;
        const s = suggest(e.name, [...objNames, ...arrNames, ...[...scopes].flatMap(m => [...m.keys()])]);
        add(e.line, e.col, `Unknown name '${e.name}'`, s ? `Did you mean '${s}'?` : `Available objects: ${objNames.join(', ')}`);
        return 'unknown';
      }
      case 'member': {
        const o = type(e.obj);
        if (e.obj.t === 'id' && schema.objects[e.obj.name]) {
          const def = schema.objects[e.obj.name].props[e.prop];
          if (!def) { const s = suggest(e.prop, Object.keys(schema.objects[e.obj.name].props)); add(e.line, e.col, `'${e.obj.name}' has no property '${e.prop}'`, s ? `Did you mean '${e.obj.name}.${s}'?` : `Properties: ${Object.keys(schema.objects[e.obj.name].props).join(', ')}`); return 'unknown'; }
          return def.type;
        }
        if (o === 'object') return 'unknown'; // element of an array: resolved at runtime
        if (o !== 'unknown') add(e.line, e.col, `Cannot read '.${e.prop}' of a ${o}`);
        return 'unknown';
      }
      case 'index': {
        need('arrays', e.line, e.col);
        const o = type(e.obj); const i = type(e.index);
        if (o !== 'array' && o !== 'unknown') add(e.line, e.col, 'Only arrays can be indexed');
        if (i !== 'number' && i !== 'unknown') add(e.line, e.col, 'Array index must be a number');
        if (e.obj.t === 'id' && schema.arrays[e.obj.name]) return 'object';
        return 'unknown';
      }
      case 'unary': {
        const a = type(e.arg);
        if (e.op === '!') { need('booleans', e.line, e.col); if (a !== 'boolean' && a !== 'unknown') add(e.line, e.col, "'!' needs a boolean"); return 'boolean'; }
        if (a !== 'number' && a !== 'unknown') add(e.line, e.col, "'-' needs a number"); return 'number';
      }
      case 'bin': {
        const l = type(e.l), r = type(e.r);
        if (['+', '-', '*', '/', '%'].includes(e.op)) {
          need('arithmetic', e.line, e.col);
          if ((l !== 'number' && l !== 'unknown') || (r !== 'number' && r !== 'unknown')) add(e.line, e.col, `'${e.op}' needs numbers on both sides`);
          return 'number';
        }
        if (e.op === '&&' || e.op === '||') {
          need('comparisons', e.line, e.col);
          if ((l !== 'boolean' && l !== 'unknown') || (r !== 'boolean' && r !== 'unknown')) add(e.line, e.col, `'${e.op}' needs booleans on both sides`);
          return 'boolean';
        }
        need('comparisons', e.line, e.col);
        if (l !== 'unknown' && r !== 'unknown' && l !== r) add(e.line, e.col, `Cannot compare a ${l} with a ${r}`);
        return 'boolean';
      }
      case 'call': {
        need('functions', e.line, e.col);
        const f = FUNCTIONS[e.name];
        if (!f) { const s = suggest(e.name, Object.keys(FUNCTIONS)); add(e.line, e.col, `Unknown function '${e.name}'`, s ? `Did you mean '${s}'?` : `Allowed: ${Object.keys(FUNCTIONS).join(', ')}`); e.args.forEach(type); return 'unknown'; }
        if (e.args.length !== f.argc) add(e.line, e.col, `${e.name}() takes ${f.argc} argument${f.argc > 1 ? 's' : ''}, got ${e.args.length}`);
        for (const a of e.args) { const at = type(a); const want = e.name === 'len' ? 'array' : 'number'; if (at !== want && at !== 'unknown') add(a.line, a.col, `${e.name}() needs ${want === 'array' ? 'an array' : 'numbers'}`); }
        return 'number';
      }
      case 'array': {
        need('arrays', e.line, e.col); e.elems.forEach(type); if (e.elems.length > 32) add(e.line, e.col, 'Arrays are limited to 32 elements'); return 'array';
      }
    }
  };

  const block = (b: Stmt[]) => { scopes.push(new Map()); b.forEach(stmt); scopes.pop(); };
  const stmt = (s: Stmt) => {
    switch (s.t) {
      case 'let': {
        need('variables', s.line, s.col);
        const v = type(s.value);
        if (objNames.includes(s.name)) add(s.line, s.col, `'${s.name}' is already an object name`);
        scopes[scopes.length - 1].set(s.name, v); break;
      }
      case 'assign': {
        if (s.op !== '=') need('arithmetic', s.line, s.col);
        const vt = type(s.value);
        const tt = type(s.target);
        if (s.target.t === 'id') {
          if (objNames.includes(s.target.name) || arrNames.includes(s.target.name)) add(s.line, s.col, `'${s.target.name}' is an object — assign to one of its properties`, `e.g. ${s.target.name}.<property> = value;`);
        } else if (s.target.t === 'member' && s.target.obj.t === 'id' && schema.objects[s.target.obj.name]) {
          const def = schema.objects[s.target.obj.name].props[s.target.prop];
          if (def?.readonly) add(s.line, s.col, `${s.target.obj.name}.${s.target.prop} is read-only`);
        }
        if (tt !== 'unknown' && vt !== 'unknown' && tt !== vt) add(s.value.line, s.value.col, `Type mismatch: expected ${tt}, got ${vt}`, tt === 'boolean' ? 'Use true or false.' : 'Use a number.');
        break;
      }
      case 'if': {
        need('conditions', s.line, s.col);
        const t = type(s.test); if (t !== 'boolean' && t !== 'unknown') add(s.test.line, s.test.col, 'Condition must be true/false', 'Try a comparison such as world.gravity < 0.5');
        block(s.cons); if (s.alt) block(s.alt); break;
      }
      case 'for': {
        need('loops', s.line, s.col);
        scopes.push(new Map()); stmt(s.init); type(s.test); stmt(s.update); block(s.body); scopes.pop(); break;
      }
      case 'expr': type(s.expr); add(s.line, s.col, 'A bare function call does nothing here', 'Assign its result to a property.'); break;
    }
  };
  program.body.forEach(stmt);
  return errors;
}
