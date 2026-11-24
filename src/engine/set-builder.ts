// Set-builder languages built from blocks with linear exponents, e.g. {0^n 1^m | m > n ≥ 0}:
// parsing, enumeration up to a length, KaTeX output, and synthesis of a grammar.
import type { Grammar, Production, Sym } from './types';
import { orderSymbols } from './grammar';
import { ABC_TEMPLATE } from './templates';

/** Σ t[v]·v + c */
export interface Lin {
  t: Record<string, number>;
  c: number;
}

export interface Block {
  word: Sym[];
  exp: Lin;
}

export type Op = '=' | '≠' | '<' | '≤' | '>' | '≥';

export interface Cond {
  left: Lin;
  op: Op;
  right: Lin;
}

export interface SetBuilder {
  blocks: Block[];
  conds: Cond[];
  vars: string[];
}

export const MAX_VARS = 4;

// ---------- Linear expressions ----------

const lin = (c = 0, t: Record<string, number> = {}): Lin => ({ c, t: { ...t } });
const varLin = (v: string, k = 1): Lin => ({ c: 0, t: { [v]: k } });

export function addLin(a: Lin, b: Lin, k = 1): Lin {
  const t = { ...a.t };
  for (const [v, x] of Object.entries(b.t)) {
    t[v] = (t[v] ?? 0) + k * x;
    if (t[v] === 0) delete t[v];
  }
  return { c: a.c + k * b.c, t };
}

const evalLin = (l: Lin, env: Record<string, number>) => Object.entries(l.t).reduce((s, [v, k]) => s + k * (env[v] ?? 0), l.c);
const varsOf = (l: Lin) => Object.keys(l.t).filter((v) => l.t[v] !== 0);

function substitute(l: Lin, v: string, by: Lin): Lin {
  const k = l.t[v];
  if (!k) return l;
  const rest = { ...l, t: { ...l.t } };
  delete rest.t[v];
  return addLin(rest, by, k);
}

export function parseLin(src: string): Lin {
  const s = src.replace(/\s+/g, '').replace(/^\{(.*)\}$/, '$1').replace(/^\((.*)\)$/, '$1');
  if (!s) throw new Error('Empty exponent.');
  let out = lin();
  const re = /([+-]?)(\d*)([a-z]?)/g;
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    m = re.exec(s);
    if (!m || m.index !== pos || m[0] === '' || (m[2] === '' && m[3] === '')) throw new Error(`Can’t read the exponent “${src}”. Use forms like n, 2n, n+m or n+1.`);
    const sign = m[1] === '-' ? -1 : 1;
    const k = m[2] === '' ? 1 : Number(m[2]);
    out = m[3] ? addLin(out, varLin(m[3], sign * k)) : addLin(out, lin(sign * k));
    pos += m[0].length;
  }
  return out;
}

// ---------- Parsing ----------

function normalise(text: string): string {
  return text
    .replace(/\$/g, '')
    .replace(/\\\{/g, '{').replace(/\\\}/g, '}')
    .replace(/\\mid|\\vert|∣/g, '|')
    .replace(/\\geq?|>=|⩾/g, '≥').replace(/\\leq?|<=|⩽/g, '≤')
    .replace(/\\neq?|!=|\/=/g, '≠')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\in\s*\\mathbb\{N\}|∈\s*ℕ|\\in\s*N\b|∈\s*N\b/g, '≥ 0')
    .replace(/\\(text|mathrm)\{[^}]*\}/g, '')
    .trim();
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '{' || ch === '(' || ch === '⟨') depth++;
    if (ch === '}' || ch === ')' || ch === '⟩') depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const chars = [...src];
  let i = 0;
  const readExp = (): Lin => {
    if (chars[i] !== '^') return lin(1);
    i++;
    if (chars[i] === '{' || chars[i] === '(') {
      const close = chars[i] === '{' ? '}' : ')';
      const j = chars.indexOf(close, i);
      if (j < 0) throw new Error(`Missing ${close} in an exponent.`);
      const e = parseLin(chars.slice(i + 1, j).join(''));
      i = j + 1;
      return e;
    }
    let tok = '';
    while (i < chars.length && /\d/.test(chars[i])) tok += chars[i++];
    if (!tok && i < chars.length && /[a-z]/.test(chars[i])) tok = chars[i++];
    if (!tok) throw new Error('Missing exponent after ^.');
    return parseLin(tok);
  };
  while (i < chars.length) {
    const ch = chars[i];
    if (/\s/.test(ch) || ch === '·') {
      i++;
      continue;
    }
    if (ch === 'λ') {
      i++;
      continue;
    }
    let word: Sym[];
    if (ch === '(') {
      const j = chars.indexOf(')', i);
      if (j < 0) throw new Error('Missing ).');
      word = tokeniseWord(chars.slice(i + 1, j).join(''));
      i = j + 1;
    } else if (ch === '⟨' || ch === '<') {
      const close = ch === '⟨' ? '⟩' : '>';
      const j = chars.indexOf(close, i);
      if (j < 0) throw new Error(`Missing ${close}.`);
      word = [`⟨${chars.slice(i + 1, j).join('')}⟩`];
      i = j + 1;
    } else if (ch === '^' || ch === '{' || ch === '}' || ch === ')') {
      throw new Error(`Unexpected “${ch}”.`);
    } else {
      word = [ch];
      i++;
    }
    blocks.push({ word, exp: readExp() });
  }
  return blocks;
}

function tokeniseWord(s: string): Sym[] {
  const out: Sym[] = [];
  const chars = [...s.replace(/\s+/g, '')];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '⟨') {
      const j = chars.indexOf('⟩', i);
      out.push(chars.slice(i, j + 1).join(''));
      i = j;
    } else out.push(chars[i]);
  }
  return out;
}

const OPS: Op[] = ['≠', '≤', '≥', '<', '>', '='];

function parseConds(src: string): Cond[] {
  const pieces = splitTop(src, ',').map((p) => p.trim()).filter(Boolean);
  // "n, m ≥ 1": a bare variable takes the comparison of the next piece.
  const merged: string[] = [];
  const pendingVars: string[] = [];
  for (const p of pieces) {
    if (/^[a-z]$/.test(p)) {
      pendingVars.push(p);
      continue;
    }
    const m = /^([a-z])\s*(.*)$/.exec(p);
    if (pendingVars.length && m && OPS.some((o) => m[2].startsWith(o))) {
      for (const v of pendingVars) merged.push(`${v} ${m[2]}`);
      pendingVars.length = 0;
    } else if (pendingVars.length) {
      throw new Error(`Can’t read the condition on ${pendingVars.join(', ')}.`);
    }
    merged.push(p);
  }
  if (pendingVars.length) throw new Error(`Missing a condition for ${pendingVars.join(', ')}.`);
  const conds: Cond[] = [];
  for (const piece of merged) {
    const parts = piece.split(/(≠|≤|≥|<|>|=)/).map((x) => x.trim());
    if (parts.length < 3) throw new Error(`Can’t read the condition “${piece}”. Use =, ≠, <, ≤, > or ≥.`);
    for (let k = 0; k + 2 < parts.length; k += 2) {
      conds.push({ left: parseLin(parts[k]), op: parts[k + 1] as Op, right: parseLin(parts[k + 2]) });
    }
  }
  return conds;
}

export function parseSetBuilder(text: string): { sb: SetBuilder } | { error: string } {
  try {
    let s = normalise(text);
    if (!s) return { error: 'Type a language such as {0^n 1^n | n ≥ 1}.' };
    if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
    const parts = splitTop(s, '|');
    if (parts.length > 2) return { error: 'Use a single | between the strings and the conditions.' };
    const blocks = parseBlocks(parts[0]);
    const conds = parts[1] ? parseConds(parts[1]) : [];
    const vars = [...new Set(blocks.flatMap((b) => varsOf(b.exp)))].sort();
    const condVars = [...new Set(conds.flatMap((c) => [...varsOf(c.left), ...varsOf(c.right)]))];
    const stray = condVars.find((v) => !vars.includes(v));
    if (stray) return { error: `${stray} appears in a condition but not in an exponent.` };
    if (vars.length > MAX_VARS) return { error: `At most ${MAX_VARS} variables, please.` };
    if (blocks.length === 0 && !parts[0].includes('λ')) return { error: 'There are no strings before the |.' };
    return { sb: { blocks, conds, vars } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Enumeration ----------

const holds = (c: Cond, env: Record<string, number>): boolean => {
  const a = evalLin(c.left, env);
  const b = evalLin(c.right, env);
  switch (c.op) {
    case '=': return a === b;
    case '≠': return a !== b;
    case '<': return a < b;
    case '≤': return a <= b;
    case '>': return a > b;
    case '≥': return a >= b;
  }
};

/** All words of the language with length ≤ n (each variable ranges over ℕ). */
export function languageUpTo(sb: SetBuilder, n: number): Sym[][] {
  const out = new Map<string, Sym[]>();
  const env: Record<string, number> = {};
  const rec = (k: number) => {
    if (k === sb.vars.length) {
      if (!sb.conds.every((c) => holds(c, env))) return;
      let len = 0;
      const exps = sb.blocks.map((b) => evalLin(b.exp, env));
      if (exps.some((e) => e < 0)) return;
      exps.forEach((e, i) => { len += e * sb.blocks[i].word.length; });
      if (len > n) return;
      const w: Sym[] = [];
      exps.forEach((e, i) => { for (let r = 0; r < e; r++) w.push(...sb.blocks[i].word); });
      out.set(w.join('\u0001'), w);
      return;
    }
    for (let x = 0; x <= n; x++) {
      env[sb.vars[k]] = x;
      rec(k + 1);
    }
  };
  rec(0);
  return [...out.values()];
}

export function predicateOf(sb: SetBuilder, n: number): (w: Sym[]) => boolean {
  const set = new Set(languageUpTo(sb, n).map((w) => w.join('\u0001')));
  return (w) => set.has(w.join('\u0001'));
}

export function terminalsOf(sb: SetBuilder): Sym[] {
  return orderSymbols([...new Set(sb.blocks.flatMap((b) => b.word))]);
}

// ---------- KaTeX ----------

function texLin(l: Lin): string {
  const terms = Object.entries(l.t).filter(([, k]) => k !== 0).map(([v, k]) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`));
  if (l.c !== 0 || terms.length === 0) terms.push(String(l.c));
  return terms.join('+').replace(/\+-/g, '-');
}

const texSymbol = (s: Sym) => (s.startsWith('⟨') ? `\\langle\\text{${s.slice(1, -1)}}\\rangle` : s);

export function texBlocks(blocks: Block[]): string {
  if (blocks.length === 0) return '\\lambda';
  return blocks.map((b) => {
    const base = b.word.length === 1 ? texSymbol(b.word[0]) : `(${b.word.map(texSymbol).join('')})`;
    const e = texLin(b.exp);
    return e === '1' ? base : `${base}^{${e}}`;
  }).join('');
}

const OP_TEX: Record<Op, string> = { '=': '=', '≠': '\\neq', '<': '<', '≤': '\\leq', '>': '>', '≥': '\\geq' };

export function texConds(conds: Cond[]): string {
  // Group "v ≥ c" with the same c: "n, m \geq 1".
  const groups = new Map<string, string[]>();
  const rest: string[] = [];
  for (const c of conds) {
    const lv = varsOf(c.left);
    if (lv.length === 1 && c.left.t[lv[0]] === 1 && c.left.c === 0 && varsOf(c.right).length === 0 && c.op === '≥') {
      const k = String(c.right.c);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(lv[0]);
    } else rest.push(`${texLin(c.left)} ${OP_TEX[c.op]} ${texLin(c.right)}`);
  }
  const g = [...groups.entries()].map(([k, vs]) => `${vs.join(', ')} \\geq ${k}`);
  return [...rest, ...g].join(',\\ ');
}

export function texSetBuilder(sb: SetBuilder): string {
  const conds = texConds(sb.conds);
  return conds ? `\\{${texBlocks(sb.blocks)} \\mid ${conds}\\}` : `\\{${texBlocks(sb.blocks)}\\}`;
}

// ---------- Grammar synthesis ----------

export type Synthesis = { grammar: Grammar; note?: string } | { error: string };

class Names {
  private k = 0;
  private readonly letters = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split('');
  next(): Sym {
    const n = this.k < this.letters.length ? this.letters[this.k] : `⟨X${this.k}⟩`;
    this.k++;
    return n;
  }
}

interface Normal {
  blocks: Block[];
  lb: Record<string, number>;
}

/** Turn conditions into substitutions and lower bounds. Returns branches (for ≠). */
function normaliseConds(sb: SetBuilder): Normal[] | string {
  const work = (blocks: Block[], conds: Cond[], vars: string[], lb: Record<string, number>, fresh: { k: number }): Normal[] | string => {
    for (let idx = 0; idx < conds.length; idx++) {
      const c = conds[idx];
      const rest = conds.filter((_, j) => j !== idx);
      let d = addLin(c.left, c.right, -1); // left − right  op  0
      let op = c.op;
      const vs = varsOf(d);
      if (vs.length === 0) {
        return holds({ left: lin(d.c), op, right: lin(0) }, {}) ? work(blocks, rest, vars, lb, fresh) : [];
      }
      if (vs.length === 1) {
        const v = vs[0];
        let a = d.t[v];
        if (a < 0) {
          d = addLin(lin(), d, -1);
          a = -a;
          op = ({ '<': '>', '≤': '≥', '>': '<', '≥': '≤', '=': '=', '≠': '≠' } as const)[op];
        }
        const bound = -d.c / a; // a·v + c op 0  ⇔  v op −c/a
        if (op === '≥' || op === '>') {
          const b = op === '≥' ? Math.ceil(bound) : Math.floor(bound) + 1;
          lb[v] = Math.max(lb[v] ?? 0, b);
          continue;
        }
        if (op === '=') {
          if (!Number.isInteger(bound) || bound < 0) return [];
          const by = lin(bound);
          return work(blocks.map((b) => ({ ...b, exp: substitute(b.exp, v, by) })), rest.map((r) => ({ ...r, left: substitute(r.left, v, by), right: substitute(r.right, v, by) })), vars.filter((x) => x !== v), lb, fresh);
        }
        if (op === '≠') {
          const val = bound;
          if (!Number.isInteger(val)) continue;
          const lower: Cond = { left: varLin(v), op: '<', right: lin(val) };
          const upper: Cond = { left: varLin(v), op: '>', right: lin(val) };
          const a1 = work(blocks, [...rest, lower], vars, { ...lb }, fresh);
          const a2 = work(blocks, [...rest, upper], vars, { ...lb }, fresh);
          if (typeof a1 === 'string') return a1;
          if (typeof a2 === 'string') return a2;
          return [...a1, ...a2];
        }
        // Upper bound: one branch per allowed value.
        const max = op === '≤' ? Math.floor(bound) : Math.ceil(bound) - 1;
        const min = lb[v] ?? 0;
        if (max - min > 10) return `The bound ${v} ${op} ${bound} allows too many values to split into cases.`;
        const all: Normal[] = [];
        for (let val = min; val <= max; val++) {
          const eq: Cond = { left: varLin(v), op: '=', right: lin(val) };
          const r = work(blocks, [...rest, eq], vars, { ...lb }, fresh);
          if (typeof r === 'string') return r;
          all.push(...r);
        }
        return all;
      }
      if (vs.length === 2) {
        const [u, v] = vs;
        if (op === '≠') {
          // u ≠ v ⇔ (left > right) or (left < right)
          const gt: Cond = { left: c.left, op: '>', right: c.right };
          const lt: Cond = { left: c.left, op: '<', right: c.right };
          const a1 = work(blocks, [...rest, gt], vars, { ...lb }, fresh);
          const a2 = work(blocks, [...rest, lt], vars, { ...lb }, fresh);
          if (typeof a1 === 'string') return a1;
          if (typeof a2 === 'string') return a2;
          return [...a1, ...a2];
        }
        if (op === '<' || op === '≤') {
          d = addLin(lin(), d, -1);
          op = op === '<' ? '>' : '≥';
        }
        // d op 0 with op ∈ {=, >, ≥}. Solve for a variable with coefficient +1 whose partner has a negative coefficient.
        const pick = [u, v].find((x) => d.t[x] === 1 && Object.entries(d.t).every(([y, k]) => y === x || k < 0))
          ?? [u, v].find((x) => d.t[x] === -1 && Object.entries(d.t).every(([y, k]) => y === x || k > 0));
        if (!pick) return 'Only relations like m = 2n, m = n + 1, m > n or m ≥ n are supported between two variables.';
        if (d.t[pick] === -1) {
          d = addLin(lin(), d, -1);
          if (op !== '=') return 'Only relations like m = 2n, m = n + 1, m > n or m ≥ n are supported between two variables.';
        }
        // pick + (negative terms) + c op 0  ⇒  pick = (positive terms) − c (+ k)
        const by = addLin(lin(), { ...d, t: Object.fromEntries(Object.entries(d.t).filter(([y]) => y !== pick)) }, -1);
        let sub = by;
        let newVars = vars.filter((x) => x !== pick);
        const newLb = { ...lb };
        if (op !== '=') {
          if (by.c < 0) return 'Relations such as m ≥ n − 1 aren’t supported. Try m ≥ n or m > n.';
          const k = `k${fresh.k++}`;
          sub = addLin(by, varLin(k));
          newVars = [...newVars, k];
          newLb[k] = op === '>' ? 1 : 0;
        } else if (by.c < 0) {
          return 'Relations such as m = n − 1 aren’t supported. Write the smaller variable in terms of the larger one.';
        }
        // The substituted variable's lower bound must already be implied.
        const implied = evalLin(sub, Object.fromEntries(Object.keys(sub.t).map((y) => [y, newLb[y] ?? 0])));
        if ((newLb[pick] ?? 0) > implied) {
          const k2 = Object.keys(sub.t).find((y) => y.startsWith('k'));
          if (k2) newLb[k2] = (newLb[k2] ?? 0) + ((newLb[pick] ?? 0) - implied);
          else return `Combining a lower bound on ${pick} with ${pick} = … isn’t supported.`;
        }
        delete newLb[pick];
        return work(
          blocks.map((b) => ({ ...b, exp: substitute(b.exp, pick, sub) })),
          rest.map((r) => ({ ...r, left: substitute(r.left, pick, sub), right: substitute(r.right, pick, sub) })),
          newVars, newLb, fresh,
        );
      }
      return 'Conditions may involve at most two variables each.';
    }
    return [{ blocks, lb }];
  };
  return work(sb.blocks, sb.conds, sb.vars, {}, { k: 0 });
}

type Item =
  | { kind: 'const'; word: Sym[]; times: number }
  | { kind: 'point'; v: string; word: Sym[]; k: number }
  | { kind: 'open'; v: string; word: Sym[]; k: number; partner: number }
  | { kind: 'close'; v: string; word: Sym[]; k: number; partner: number };

function itemsFor(blocks: Block[]): Item[] | string {
  const pos = new Map<string, number[]>();
  blocks.forEach((b, i) => {
    for (const [v, k] of Object.entries(b.exp.t)) {
      if (k < 0) throw new Error('neg');
      if (k > 0) pos.set(v, [...(pos.get(v) ?? []), i]);
    }
  });
  for (const [v, ps] of pos) if (ps.length > 2) return `three-blocks:${v}`;
  const items: Item[] = [];
  blocks.forEach((b, i) => {
    const closes: Item[] = [];
    const opens: Item[] = [];
    const points: Item[] = [];
    for (const [v, k] of Object.entries(b.exp.t)) {
      const ps = pos.get(v)!;
      if (ps.length === 1) points.push({ kind: 'point', v, word: b.word, k });
      else if (ps[0] === i) opens.push({ kind: 'open', v, word: b.word, k, partner: ps[1] });
      else closes.push({ kind: 'close', v, word: b.word, k, partner: ps[0] });
    }
    closes.sort((x, y) => (y as { partner: number }).partner - (x as { partner: number }).partner);
    opens.sort((x, y) => (y as { partner: number }).partner - (x as { partner: number }).partner);
    if (b.exp.c > 0) points.push({ kind: 'const', word: b.word, times: b.exp.c });
    items.push(...closes, ...points, ...opens);
  });
  // Check proper nesting.
  const stack: string[] = [];
  for (const it of items) {
    if (it.kind === 'open') stack.push(it.v);
    else if (it.kind === 'close') {
      if (stack.pop() !== it.v) return 'crossing';
    }
  }
  return items;
}

function rep(word: Sym[], times: number): Sym[] {
  const out: Sym[] = [];
  for (let i = 0; i < times; i++) out.push(...word);
  return out;
}

function buildFromItems(items: Item[], lb: Record<string, number>, names: Names, P: Production[], lhs: Sym) {
  // Produces productions for `lhs` generating the concatenation of items.
  const seq = (list: Item[]): Sym[] => {
    const out: Sym[] = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.kind === 'const') out.push(...rep(it.word, it.times));
      else if (it.kind === 'point') {
        const X = names.next();
        const L = lb[it.v] ?? 0;
        P.push({ lhs: [X], rhs: [...rep(it.word, it.k), X] });
        P.push({ lhs: [X], rhs: rep(it.word, it.k * L) });
        out.push(X);
      } else if (it.kind === 'open') {
        let depth = 0;
        let j = i + 1;
        for (; j < list.length; j++) {
          const x = list[j];
          if (x.kind === 'open') depth++;
          if (x.kind === 'close') {
            if (depth === 0 && x.v === it.v) break;
            depth--;
          }
        }
        const close = list[j] as Extract<Item, { kind: 'close' }>;
        const inner = list.slice(i + 1, j);
        const X = names.next();
        const L = lb[it.v] ?? 0;
        P.push({ lhs: [X], rhs: [...rep(it.word, it.k), X, ...rep(close.word, close.k)] });
        P.push({ lhs: [X], rhs: [...rep(it.word, it.k * L), ...seq(inner), ...rep(close.word, close.k * L)] });
        out.push(X);
        i = j;
      }
    }
    return out;
  };
  P.push({ lhs: [lhs], rhs: seq(items) });
}

function abcGrammar(blocks: Block[], v: string, lb: Record<string, number>): Synthesis {
  const ok = blocks.length === 3 && blocks.every((b) => b.word.length === 1 && b.exp.t[v] === 1 && b.exp.c === 0 && Object.keys(b.exp.t).length === 1)
    && new Set(blocks.map((b) => b.word[0])).size === 3;
  if (!ok) {
    return { error: 'A variable appears in three or more blocks. Apart from the pattern xⁿyⁿzⁿ, languages like this aren’t context-free, and the builder can’t construct a grammar for them automatically.' };
  }
  const [x, y, z] = blocks.map((b) => b.word[0]);
  const L = Math.max(lb[v] ?? 0, 0);
  const text = ABC_TEMPLATE(x, y, z);
  const P: Production[] = text.map(([l, r]) => ({ lhs: [...l], rhs: [...r] }));
  // ABC_TEMPLATE generates n ≥ 1 from R. Add the lower bound by a prefix of fixed blocks.
  const fixed = Math.max(L, 1);
  const start: Production[] = [];
  if (fixed === 1) start.push({ lhs: ['S'], rhs: ['R'] });
  else return { error: 'For xⁿyⁿzⁿ only n ≥ 0 or n ≥ 1 are supported.' };
  if (L === 0) start.push({ lhs: ['S'], rhs: [] });
  return { grammar: { V: orderSymbols(['S', 'R', 'B', 'C', 'H', 'K', x, y, z]), T: [x, y, z], S: 'S', P: [...start, ...P] }, note: 'Built from the context-sensitive pattern for xⁿyⁿzⁿ.' };
}

export function synthesizeGrammar(sb: SetBuilder): Synthesis {
  const T = terminalsOf(sb);
  if (T.some((t) => /^[A-Z]$/.test(t))) return { error: 'Use lowercase letters or digits for terminals: uppercase letters are non-terminals.' };
  // Finite languages: list the words.
  const bounded = sb.vars.every((v) => sb.conds.some((c) => {
    const lv = varsOf(c.left);
    return lv.length === 1 && lv[0] === v && varsOf(c.right).length === 0 && (c.op === '≤' || c.op === '<' || c.op === '=');
  }));
  if (bounded && sb.vars.length > 0) {
    const words = languageUpTo(sb, 40);
    if (words.length > 40) return { error: 'This finite language has too many words to list.' };
    return { grammar: { V: orderSymbols(['S', ...T]), T, S: 'S', P: words.map((w) => ({ lhs: ['S'], rhs: w })) }, note: 'A finite language: one production per word.' };
  }
  const branches = normaliseConds(sb);
  if (typeof branches === 'string') return { error: branches };
  if (branches.length === 0) return { grammar: { V: ['S', ...T], T, S: 'S', P: [{ lhs: ['S'], rhs: ['S'] }] }, note: 'The conditions can never hold, so L = ∅ (no word is derivable).' };
  const names = new Names();
  const P: Production[] = [];
  const starts: Sym[] = [];
  for (const br of branches) {
    let items: Item[] | string;
    try {
      items = itemsFor(br.blocks);
    } catch {
      return { error: 'Negative exponents aren’t supported.' };
    }
    if (typeof items === 'string') {
      if (items.startsWith('three-blocks')) {
        if (branches.length > 1) return { error: 'This language isn’t one the builder can handle automatically.' };
        return abcGrammar(br.blocks, items.split(':')[1], br.lb);
      }
      return { error: 'The exponents cross (as in {0ⁿ1ᵐ2ⁿ3ᵐ}), so the language isn’t context-free and no grammar can be built automatically.' };
    }
    const lhs = branches.length === 1 ? 'S' : names.next();
    buildFromItems(items, br.lb, names, P, lhs);
    starts.push(lhs);
  }
  if (branches.length > 1) P.unshift(...starts.map((s) => ({ lhs: ['S'], rhs: [s] })));
  const simplified = simplify(P);
  const NT = [...new Set(simplified.flatMap((p) => [...p.lhs, ...p.rhs]).filter((s) => !T.includes(s)))];
  return { grammar: { V: orderSymbols(['S', ...NT, ...T]), T, S: 'S', P: simplified } };
}

/** Inline non-terminals that have a single production and aren't recursive; drop duplicates. */
function simplify(P: Production[]): Production[] {
  let prods = P;
  for (let changed = true; changed;) {
    changed = false;
    const byLhs = new Map<Sym, Production[]>();
    for (const p of prods) byLhs.set(p.lhs[0], [...(byLhs.get(p.lhs[0]) ?? []), p]);
    for (const [X, ps] of byLhs) {
      if (X === 'S' || ps.length !== 1 || ps[0].rhs.includes(X)) continue;
      const body = ps[0].rhs;
      prods = prods.filter((p) => p !== ps[0]).map((p) => ({ lhs: p.lhs, rhs: p.rhs.flatMap((s) => (s === X ? body : [s])) }));
      changed = true;
      break;
    }
  }
  const seen = new Set<string>();
  return prods.filter((p) => {
    const k = p.lhs.join(' ') + '→' + p.rhs.join(' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
