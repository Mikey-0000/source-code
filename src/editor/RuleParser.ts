// Restricted JavaScript-like rule language: lexer, parser and AST.
// No eval / Function anywhere in the project. Rules are data that a controlled interpreter walks.

export type TokKind = 'num' | 'id' | 'kw' | 'op' | 'punct' | 'eof';
export interface Token { kind: TokKind; text: string; line: number; col: number; start: number; end: number; value?: number }

export class RuleSyntaxError extends Error {
  constructor(public msg: string, public line: number, public col: number, public hint?: string) { super(msg); }
}

const KEYWORDS = new Set(['let', 'if', 'else', 'for', 'true', 'false']);
const FORBIDDEN = new Set(['eval', 'Function', 'window', 'document', 'fetch', 'XMLHttpRequest', 'localStorage', 'require', 'import', 'process', 'globalThis', 'constructor', 'prototype', '__proto__', 'while', 'function', 'class', 'new', 'this', 'var', 'const', 'return', 'async', 'await']);

export function tokenize(src: string, tolerant = false): Token[] {
  const toks: Token[] = [];
  let i = 0, line = 1, col = 1;
  const adv = (n = 1) => { for (let k = 0; k < n; k++) { if (src[i] === '\n') { line++; col = 1; } else col++; i++; } };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { adv(); continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') adv(); continue; }
    if (c === '/' && src[i + 1] === '*') {
      const sl = line, sc = col; adv(2);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) adv();
      if (i >= src.length) { if (tolerant) break; throw new RuleSyntaxError('Unterminated comment', sl, sc); }
      adv(2); continue;
    }
    const start = i, sl = line, sc = col;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i; while (/[0-9]/.test(src[j] || '')) j++;
      if (src[j] === '.') { j++; while (/[0-9]/.test(src[j] || '')) j++; }
      const text = src.slice(i, j); adv(j - i);
      toks.push({ kind: 'num', text, line: sl, col: sc, start, end: i, value: parseFloat(text) }); continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (/[A-Za-z0-9_$]/.test(src[j] || '')) j++;
      const text = src.slice(i, j); adv(j - i);
      toks.push({ kind: KEYWORDS.has(text) ? 'kw' : 'id', text, line: sl, col: sc, start, end: i }); continue;
    }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (three === '===' || three === '!==') { adv(3); toks.push({ kind: 'op', text: three, line: sl, col: sc, start, end: i }); continue; }
    if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '++', '--'].includes(two)) { adv(2); toks.push({ kind: 'op', text: two, line: sl, col: sc, start, end: i }); continue; }
    if ('+-*/%<>=!'.includes(c)) { adv(); toks.push({ kind: 'op', text: c, line: sl, col: sc, start, end: i }); continue; }
    if ('(){}[];,.'.includes(c)) { adv(); toks.push({ kind: 'punct', text: c, line: sl, col: sc, start, end: i }); continue; }
    if (tolerant) { adv(); toks.push({ kind: 'op', text: c, line: sl, col: sc, start, end: i }); continue; }
    if (c === '"' || c === "'" || c === '`') throw new RuleSyntaxError('Strings are not part of the rule language', sl, sc, 'Rules only handle numbers, booleans and arrays.');
    throw new RuleSyntaxError(`Unexpected character '${c}'`, sl, sc);
  }
  toks.push({ kind: 'eof', text: '', line, col, start: i, end: i });
  return toks;
}

// ---- AST ----
export interface Pos { line: number; col: number }
export type Expr =
  | (Pos & { t: 'num'; v: number })
  | (Pos & { t: 'bool'; v: boolean })
  | (Pos & { t: 'id'; name: string })
  | (Pos & { t: 'member'; obj: Expr; prop: string })
  | (Pos & { t: 'index'; obj: Expr; index: Expr })
  | (Pos & { t: 'unary'; op: '-' | '!'; arg: Expr })
  | (Pos & { t: 'bin'; op: string; l: Expr; r: Expr })
  | (Pos & { t: 'call'; name: string; args: Expr[] })
  | (Pos & { t: 'array'; elems: Expr[] });
export type Target = Extract<Expr, { t: 'id' | 'member' | 'index' }>;
export type Stmt =
  | (Pos & { t: 'let'; name: string; value: Expr })
  | (Pos & { t: 'assign'; target: Target; op: '=' | '+=' | '-=' | '*=' | '/='; value: Expr })
  | (Pos & { t: 'if'; test: Expr; cons: Stmt[]; alt: Stmt[] | null })
  | (Pos & { t: 'for'; init: Extract<Stmt, { t: 'let' }>; test: Expr; update: Extract<Stmt, { t: 'assign' }>; body: Stmt[] })
  | (Pos & { t: 'expr'; expr: Expr });
export interface Program { body: Stmt[] }

export function parse(src: string): Program {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const err = (msg: string, tok = peek(), hint?: string): never => { throw new RuleSyntaxError(msg, tok.line, tok.col, hint); };
  const is = (text: string) => { const t = peek(); return (t.kind === 'op' || t.kind === 'punct' || t.kind === 'kw') && t.text === text; };
  const eat = (text: string) => { if (!is(text)) { const t = peek(); err(`Expected '${text}' but found ${t.kind === 'eof' ? 'end of file' : `'${t.text}'`}`, t, text === ';' ? 'Every statement ends with a semicolon.' : undefined); } return toks[p++]; };
  const ident = () => { const t = peek(); if (t.kind !== 'id') err(`Expected a name but found ${t.kind === 'eof' ? 'end of file' : `'${t.text}'`}`); if (FORBIDDEN.has(t.text)) err(`'${t.text}' is not allowed in rules`, t, 'The sandbox exposes no host access.'); p++; return t; };

  function block(): Stmt[] {
    eat('{'); const out: Stmt[] = [];
    while (!is('}')) { if (peek().kind === 'eof') err("Missing '}' — block was never closed"); out.push(stmt()); }
    eat('}'); return out;
  }
  function stmt(): Stmt {
    const t = peek();
    if (t.kind === 'kw' && t.text === 'let') { p++; const n = ident(); eat('='); const value = expr(); eat(';'); return { t: 'let', name: n.text, value, line: t.line, col: t.col }; }
    if (t.kind === 'kw' && t.text === 'if') {
      p++; eat('('); const test = expr(); eat(')'); const cons = block(); let alt: Stmt[] | null = null;
      if (is('else')) { p++; alt = is('if') ? [stmt()] : block(); }
      return { t: 'if', test, cons, alt, line: t.line, col: t.col };
    }
    if (t.kind === 'kw' && t.text === 'for') {
      p++; eat('(');
      const lt = eat('let'); const n = ident(); eat('='); const iv = expr(); eat(';');
      const init: Extract<Stmt, { t: 'let' }> = { t: 'let', name: n.text, value: iv, line: lt.line, col: lt.col };
      const test = expr(); eat(';');
      const un = ident(); let update: Extract<Stmt, { t: 'assign' }>;
      const target: Target = { t: 'id', name: un.text, line: un.line, col: un.col };
      if (is('++') || is('--')) { const o = toks[p++]; update = { t: 'assign', target, op: o.text === '++' ? '+=' : '-=', value: { t: 'num', v: 1, line: o.line, col: o.col }, line: un.line, col: un.col }; }
      else { const o = peek(); if (!['+=', '-=', '*=', '/=', '='].includes(o.text)) err("Loop update must be 'i++', 'i--' or 'i += n'"); p++; update = { t: 'assign', target, op: o.text as '=', value: expr(), line: un.line, col: un.col }; }
      eat(')'); const body = block();
      return { t: 'for', init, test, update, body, line: t.line, col: t.col };
    }
    if (t.kind === 'id' && FORBIDDEN.has(t.text)) err(`'${t.text}' is not allowed in rules`, t, 'The sandbox exposes no host access. Rules are not JavaScript.');
    if (t.kind === 'kw' || t.kind === 'punct' && t.text === '}') err(`Unexpected '${t.text}'`);
    // assignment or call statement
    const e = postfix();
    if (is('=') || is('+=') || is('-=') || is('*=') || is('/=')) {
      if (e.t !== 'id' && e.t !== 'member' && e.t !== 'index') err('Left side of an assignment must be a property like player.speed', t);
      const op = toks[p++].text as '=' | '+=' | '-=' | '*=' | '/='; const value = expr(); eat(';');
      return { t: 'assign', target: e as Target, op, value, line: t.line, col: t.col };
    }
    if (is('++') || is('--')) {
      if (e.t !== 'id' && e.t !== 'member' && e.t !== 'index') err('Cannot increment this', t);
      const o = toks[p++]; eat(';');
      return { t: 'assign', target: e as Target, op: o.text === '++' ? '+=' : '-=', value: { t: 'num', v: 1, line: o.line, col: o.col }, line: t.line, col: t.col };
    }
    if (e.t === 'call') { eat(';'); return { t: 'expr', expr: e, line: t.line, col: t.col }; }
    return err('Expected an assignment such as player.speed = 3;', t);
  }
  const prec: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
  function expr(minPrec = 1): Expr {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t.kind !== 'op' || !(t.text in prec) || prec[t.text] < minPrec) break;
      p++; const right = expr(prec[t.text] + 1);
      left = { t: 'bin', op: t.text === '===' ? '==' : t.text === '!==' ? '!=' : t.text, l: left, r: right, line: t.line, col: t.col };
    }
    return left;
  }
  function unary(): Expr {
    const t = peek();
    if (t.kind === 'op' && (t.text === '-' || t.text === '!')) { p++; return { t: 'unary', op: t.text as '-', arg: unary(), line: t.line, col: t.col }; }
    return postfix();
  }
  function postfix(): Expr {
    let e = primary();
    for (;;) {
      if (is('.')) { p++; const n = peek(); if (n.kind !== 'id') err("Expected a property name after '.'"); if (FORBIDDEN.has(n.text)) err(`'${n.text}' is not allowed in rules`, n); p++; e = { t: 'member', obj: e, prop: n.text, line: n.line, col: n.col }; }
      else if (is('[')) { const b = eat('['); const idx = expr(); eat(']'); e = { t: 'index', obj: e, index: idx, line: b.line, col: b.col }; }
      else break;
    }
    return e;
  }
  function primary(): Expr {
    const t = peek();
    if (t.kind === 'num') { p++; return { t: 'num', v: t.value!, line: t.line, col: t.col }; }
    if (t.kind === 'kw' && (t.text === 'true' || t.text === 'false')) { p++; return { t: 'bool', v: t.text === 'true', line: t.line, col: t.col }; }
    if (is('(')) { p++; const e = expr(); eat(')'); return e; }
    if (is('[')) { p++; const elems: Expr[] = []; while (!is(']')) { elems.push(expr()); if (!is(']')) eat(','); } eat(']'); return { t: 'array', elems, line: t.line, col: t.col }; }
    if (t.kind === 'id') {
      const n = ident();
      if (is('(')) { p++; const args: Expr[] = []; while (!is(')')) { args.push(expr()); if (!is(')')) eat(','); } eat(')'); return { t: 'call', name: n.text, args, line: n.line, col: n.col }; }
      return { t: 'id', name: n.text, line: n.line, col: n.col };
    }
    return err(t.kind === 'eof' ? 'Unexpected end of file' : `Unexpected '${t.text}'`);
  }

  const body: Stmt[] = [];
  while (peek().kind !== 'eof') body.push(stmt());
  return { body };
}
