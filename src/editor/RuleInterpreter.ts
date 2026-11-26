import type { Expr, Program, Stmt } from './RuleParser';
import { cloneState, defaultState, FUNCTIONS, type PropValue, type RuleSchema, type RuleState } from './RuleSchema';
import { parseSafe, validate, type RuleError } from './RuleValidator';

export const LIMITS = { maxSteps: 4000, maxLoopIterations: 64, maxArray: 32, maxDepth: 12 };

class RuntimeError extends Error { constructor(public msg: string, public line: number, public col: number, public kind: RuleError['kind'] = 'runtime', public hint?: string) { super(msg); } }
interface ObjRef { __obj: string }
type Value = number | boolean | ObjRef | Value[];
const isRef = (v: Value): v is ObjRef => typeof v === 'object' && !Array.isArray(v) && v !== null;

export interface Change { path: string; from: PropValue; to: PropValue }
export interface RunResult { ok: boolean; errors: RuleError[]; state: RuleState; changes: Change[]; steps: number }

/** Controlled tree-walking interpreter. Operates ONLY on a draft copy of the state; the caller commits on success. */
export function interpret(program: Program, schema: RuleSchema, base: RuleState, adminLines: Set<number> = new Set()): RunResult {
  const draft = cloneState(base);
  let steps = 0;
  const scopes: Map<string, Value>[] = [new Map()];
  const tick = (n: { line: number; col: number }) => {
    if (++steps > LIMITS.maxSteps) throw new RuntimeError(`Execution limit exceeded (${LIMITS.maxSteps} steps) — is a loop too long?`, n.line, n.col, 'limit', 'Loops are bounded to 64 iterations each.');
  };
  const getVar = (name: string): Value | undefined => { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name); return undefined; };
  const setVar = (name: string, v: Value) => { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) { scopes[i].set(name, v); return true; } return false; };

  const num = (v: Value, n: { line: number; col: number }): number => { if (typeof v !== 'number') throw new RuntimeError('Expected a number', n.line, n.col); return v; };

  function ev(e: Expr, depth = 0): Value {
    if (depth > LIMITS.maxDepth * 4) throw new RuntimeError('Expression nested too deeply', e.line, e.col, 'limit');
    tick(e);
    switch (e.t) {
      case 'num': return e.v;
      case 'bool': return e.v;
      case 'id': {
        if (schema.objects[e.name]) return { __obj: e.name };
        if (schema.arrays[e.name]) return schema.arrays[e.name].map(o => ({ __obj: o }));
        const v = getVar(e.name); if (v === undefined) throw new RuntimeError(`Unknown name '${e.name}'`, e.line, e.col); return v;
      }
      case 'member': {
        const o = ev(e.obj, depth + 1); if (!isRef(o)) throw new RuntimeError(`Cannot read '.${e.prop}'`, e.line, e.col);
        const def = schema.objects[o.__obj]?.props[e.prop];
        if (!def) throw new RuntimeError(`'${o.__obj}' has no property '${e.prop}'`, e.line, e.col);
        return draft[o.__obj][e.prop];
      }
      case 'index': {
        const a = ev(e.obj, depth + 1); const i = ev(e.index, depth + 1);
        if (!Array.isArray(a)) throw new RuntimeError('Only arrays can be indexed', e.line, e.col);
        if (typeof i !== 'number' || !Number.isInteger(i)) throw new RuntimeError('Array index must be a whole number', e.line, e.col);
        if (i < 0 || i >= a.length) throw new RuntimeError(`Index ${i} is out of range (array length is ${a.length})`, e.line, e.col, 'runtime', 'Valid indices run from 0 to length-1.');
        return a[i];
      }
      case 'unary': { const a = ev(e.arg, depth + 1); if (e.op === '-') return -num(a, e); if (typeof a !== 'boolean') throw new RuntimeError("'!' needs a boolean", e.line, e.col); return !a; }
      case 'bin': {
        if (e.op === '&&' || e.op === '||') {
          const l = ev(e.l, depth + 1); if (typeof l !== 'boolean') throw new RuntimeError(`'${e.op}' needs booleans`, e.line, e.col);
          if (e.op === '&&' && !l) return false; if (e.op === '||' && l) return true;
          const r = ev(e.r, depth + 1); if (typeof r !== 'boolean') throw new RuntimeError(`'${e.op}' needs booleans`, e.line, e.col); return r;
        }
        const l = ev(e.l, depth + 1), r = ev(e.r, depth + 1);
        if (e.op === '==') return l === r; if (e.op === '!=') return l !== r;
        const a = num(l, e), b = num(r, e);
        switch (e.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': if (b === 0) throw new RuntimeError('Division by zero', e.line, e.col, 'runtime', 'EDEN does not define x / 0.'); return a / b;
          case '%': if (b === 0) throw new RuntimeError('Modulo by zero', e.line, e.col); return a % b;
          case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
        }
        throw new RuntimeError(`Unknown operator ${e.op}`, e.line, e.col);
      }
      case 'call': {
        const f = FUNCTIONS[e.name]; if (!f) throw new RuntimeError(`Unknown function '${e.name}'`, e.line, e.col);
        const args = e.args.map(a => ev(a, depth + 1));
        if (e.name === 'len') { if (!Array.isArray(args[0])) throw new RuntimeError('len() needs an array', e.line, e.col); return args[0].length; }
        const n = args.map(a => num(a, e));
        switch (e.name) {
          case 'min': return Math.min(n[0], n[1]); case 'max': return Math.max(n[0], n[1]); case 'abs': return Math.abs(n[0]);
          case 'clamp': return Math.min(Math.max(n[0], n[1]), n[2]); case 'round': return Math.round(n[0]); case 'floor': return Math.floor(n[0]);
        }
        throw new RuntimeError('Bad call', e.line, e.col);
      }
      case 'array': {
        if (e.elems.length > LIMITS.maxArray) throw new RuntimeError(`Arrays are limited to ${LIMITS.maxArray} elements`, e.line, e.col, 'limit');
        return e.elems.map(x => ev(x, depth + 1));
      }
    }
  }

  function assign(s: Extract<Stmt, { t: 'assign' }>) {
    let v = ev(s.value);
    const t = s.target;
    if (t.t === 'id') {
      const cur = getVar(t.name); if (cur === undefined) throw new RuntimeError(`Unknown variable '${t.name}'`, t.line, t.col);
      if (s.op !== '=') v = compound(s.op, num(cur, t), num(v, s), s);
      setVar(t.name, v); return;
    }
    if (t.t === 'index') throw new RuntimeError('Array elements are read-only; change the object property instead', t.line, t.col);
    const o = ev(t.obj); if (!isRef(o)) throw new RuntimeError(`Cannot assign '.${t.prop}'`, t.line, t.col);
    const def = schema.objects[o.__obj]?.props[t.prop];
    if (!def) throw new RuntimeError(`'${o.__obj}' has no property '${t.prop}'`, t.line, t.col);
    if (def.readonly) throw new RuntimeError(`${o.__obj}.${t.prop} is read-only`, t.line, t.col);
    if (def.adminOnly && !adminLines.has(s.line)) throw new RuntimeError(`${o.__obj}.${t.prop} is controlled by an ADMIN rule`, s.line, s.col, 'protected', 'Change the values the protected rule reads instead of overriding its result.');
    if (s.op !== '=') v = compound(s.op, num(draft[o.__obj][t.prop], t), num(v, s), s);
    if (def.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new RuntimeError(`${o.__obj}.${t.prop} needs a number`, s.line, s.col, 'runtime');
      if ((def.min !== undefined && v < def.min) || (def.max !== undefined && v > def.max))
        throw new RuntimeError(`${o.__obj}.${t.prop} must be between ${def.min ?? '-∞'} and ${def.max ?? '∞'} (got ${Math.round(v * 1000) / 1000})`, s.line, s.col, 'runtime', 'The sandbox enforces numeric limits.');
    } else if (typeof v !== 'boolean') throw new RuntimeError(`${o.__obj}.${t.prop} needs true or false`, s.line, s.col, 'runtime');
    draft[o.__obj][t.prop] = v;
  }
  function compound(op: string, a: number, b: number, n: { line: number; col: number }): number {
    if (op === '+=') return a + b; if (op === '-=') return a - b; if (op === '*=') return a * b;
    if (b === 0) throw new RuntimeError('Division by zero', n.line, n.col); return a / b;
  }
  function run(b: Stmt[], depth: number) {
    if (depth > LIMITS.maxDepth) throw new RuntimeError('Blocks nested too deeply', b[0]?.line ?? 1, 1, 'limit');
    scopes.push(new Map());
    for (const s of b) exec(s, depth);
    scopes.pop();
  }
  function exec(s: Stmt, depth: number) {
    tick(s);
    switch (s.t) {
      case 'let': scopes[scopes.length - 1].set(s.name, ev(s.value)); break;
      case 'assign': assign(s); break;
      case 'if': { const c = ev(s.test); if (typeof c !== 'boolean') throw new RuntimeError('Condition must be true/false', s.line, s.col); if (c) run(s.cons, depth + 1); else if (s.alt) run(s.alt, depth + 1); break; }
      case 'for': {
        scopes.push(new Map()); exec(s.init, depth);
        let it = 0;
        for (;;) {
          const c = ev(s.test); if (typeof c !== 'boolean') throw new RuntimeError('Loop condition must be true/false', s.line, s.col);
          if (!c) break;
          if (++it > LIMITS.maxLoopIterations) throw new RuntimeError(`Loop exceeded ${LIMITS.maxLoopIterations} iterations`, s.line, s.col, 'limit', 'Unbounded loops are blocked by the sandbox.');
          run(s.body, depth + 1); assign(s.update);
        }
        scopes.pop(); break;
      }
      case 'expr': ev(s.expr); break;
    }
  }

  const errors: RuleError[] = [];
  try { run(program.body, 0); }
  catch (e) {
    if (e instanceof RuntimeError) errors.push({ line: e.line, col: e.col, msg: e.msg, hint: e.hint, kind: e.kind });
    else throw e;
  }
  const changes: Change[] = [];
  if (!errors.length) for (const [o, props] of Object.entries(draft)) for (const [p, v] of Object.entries(props)) if (v !== base[o][p]) changes.push({ path: `${o}.${p}`, from: base[o][p], to: v });
  return { ok: !errors.length, errors, state: errors.length ? base : draft, changes, steps };
}

export interface CompileOptions { source: string; schema: RuleSchema; lockedLines?: string[] }
export interface CompileResult extends RunResult { source: string }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Full pipeline: protected-line check -> parse -> validate -> interpret (draft) -> result. Never mutates anything. */
export function compileRules(opts: CompileOptions): CompileResult {
  const { source, schema, lockedLines = [] } = opts;
  const base = defaultState(schema);
  const fail = (errors: RuleError[]): CompileResult => ({ ok: false, errors, state: base, changes: [], steps: 0, source });
  if (source.length > 4000) return fail([{ line: 1, col: 1, msg: 'Rule file is too large (4000 characters max)', kind: 'limit' }]);
  const present = source.split('\n').map(norm);
  const missing: RuleError[] = [];
  let cursor = 0; const adminLines = new Set<number>();
  for (const l of lockedLines) {
    const idx = present.indexOf(norm(l), cursor);
    if (idx >= 0) adminLines.add(idx + 1);
    if (idx < 0) missing.push({ line: 1, col: 1, msg: `Protected line was modified or removed: ${norm(l)}`, hint: 'Protected lines belong to the system. Use Restore Defaults if the file is damaged.', kind: 'protected' });
    else cursor = idx + 1;
  }
  if (missing.length) return fail(missing);
  const parsed = parseSafe(source);
  if (parsed.error) return fail([parsed.error]);
  const verrors = validate(parsed.program!, schema);
  if (verrors.length) return fail(verrors);
  const r = interpret(parsed.program!, schema, base, adminLines);
  return { ...r, source };
}
