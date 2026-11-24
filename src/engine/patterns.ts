// Pattern library for the language → grammar builder. Regular patterns are built as FSMs
// without output, minimised, then turned into type 3 grammars (SPEC §3.9 construction).
import type { DFA, Grammar, StateId, Sym } from './types';
import { minimise } from './fsm';
import { dfaToGrammar } from './conversions';
import { grammar as parseG } from './grammar';

export type ParamKind = 'word' | 'number' | 'symbol' | 'symbol2';

export interface PatternDef {
  id: string;
  label: string;
  params: { name: string; kind: ParamKind; label: string; default: string }[];
  /** Needs exactly two symbols in the alphabet. */
  binary?: boolean;
  regular: boolean;
}

export const PATTERNS: PatternDef[] = [
  { id: 'starts', label: 'Starts with w', params: [{ name: 'w', kind: 'word', label: 'w', default: '01' }], regular: true },
  { id: 'ends', label: 'Ends with w', params: [{ name: 'w', kind: 'word', label: 'w', default: '01' }], regular: true },
  { id: 'contains', label: 'Contains w', params: [{ name: 'w', kind: 'word', label: 'w', default: '11' }], regular: true },
  { id: 'avoids', label: 'Does not contain w', params: [{ name: 'w', kind: 'word', label: 'w', default: '00' }], regular: true },
  { id: 'len-eq', label: 'Length exactly k', params: [{ name: 'k', kind: 'number', label: 'k', default: '3' }], regular: true },
  { id: 'len-ge', label: 'Length at least k', params: [{ name: 'k', kind: 'number', label: 'k', default: '2' }], regular: true },
  { id: 'len-mod', label: 'Length ≡ r (mod k)', params: [{ name: 'k', kind: 'number', label: 'k', default: '3' }, { name: 'r', kind: 'number', label: 'r', default: '0' }], regular: true },
  { id: 'count-mod', label: 'Number of a’s ≡ r (mod k)', params: [{ name: 'a', kind: 'symbol', label: 'a', default: '1' }, { name: 'k', kind: 'number', label: 'k', default: '2' }, { name: 'r', kind: 'number', label: 'r', default: '0' }], regular: true },
  { id: 'palindromes', label: 'Palindromes', params: [], regular: false },
  { id: 'equal', label: 'As many a’s as b’s', params: [{ name: 'a', kind: 'symbol', label: 'a', default: '0' }, { name: 'b', kind: 'symbol2', label: 'b', default: '1' }], regular: false, binary: true },
  { id: 'balanced', label: 'Balanced brackets (a opens, b closes)', params: [{ name: 'a', kind: 'symbol', label: 'a', default: '0' }, { name: 'b', kind: 'symbol2', label: 'b', default: '1' }], regular: false, binary: true },
];

export interface PatternResult {
  grammar: Grammar;
  dfa?: DFA;
  /** KaTeX description of the language. */
  tex: string;
  predicate: (w: Sym[]) => boolean;
}

const str = (w: Sym[]) => w.join('');
const texSet = (I: Sym[]) => `\\{${I.join(', ')}\\}`;

function build(states: number, start: number, accepting: (s: number) => boolean, next: (s: number, a: Sym) => number, I: Sym[]): DFA {
  const ids = Array.from({ length: states }, (_, i) => `s${i}`);
  const delta: Record<StateId, Record<Sym, StateId>> = {};
  ids.forEach((id, i) => { delta[id] = Object.fromEntries(I.map((a) => [a, ids[next(i, a)]])); });
  return { kind: 'dfa', states: ids, input: [...I], start: ids[start], accepting: ids.filter((_, i) => accepting(i)), delta };
}

/** KMP automaton: state = length of the longest suffix of the input that is a prefix of w (capped at |w|). */
function kmp(w: Sym[], absorbing: boolean): (s: number, a: Sym) => number {
  return (s, a) => {
    if (absorbing && s === w.length) return s;
    const seen = [...w.slice(0, Math.min(s, w.length)), a];
    for (let l = Math.min(w.length, seen.length); l >= 0; l--) {
      if (str(seen.slice(seen.length - l)) === str(w.slice(0, l))) return l;
    }
    return 0;
  };
}

/** Clean up state names after minimising: s0, s1, … in order. */
function tidy(m: DFA): DFA {
  const r = minimise(m).dfa;
  const map = new Map(r.states.map((s, i) => [s, `s${i}`]));
  const delta: DFA['delta'] = {};
  for (const s of r.states) delta[map.get(s)!] = Object.fromEntries(Object.entries(r.delta[s]).map(([a, t]) => [a, map.get(t)!]));
  return { kind: 'dfa', states: r.states.map((s) => map.get(s)!), input: r.input, start: map.get(r.start!)!, accepting: r.accepting.map((s) => map.get(s)!), delta };
}

export function buildPattern(id: string, I: Sym[], params: Record<string, string>): PatternResult | { error: string } {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) return { error: 'Unknown pattern.' };
  if (I.length === 0) return { error: 'The alphabet is empty.' };
  if (I.some((a) => [...a].length !== 1 || /[A-Z]/.test(a))) return { error: 'Use single-character, non-uppercase symbols for the alphabet.' };
  if (p.binary && I.length !== 2) return { error: 'This pattern needs exactly two symbols in the alphabet.' };
  const wordParam = (name: string): Sym[] | { error: string } => {
    const w = [...(params[name] ?? '').replace(/\s+/g, '')];
    if (w.length === 0) return { error: 'w must be non-empty.' };
    if (w.length > 6) return { error: 'Keep w to at most 6 symbols.' };
    const bad = w.find((c) => !I.includes(c));
    if (bad) return { error: `“${bad}” isn’t in the alphabet.` };
    return w;
  };
  const numParam = (name: string, min: number, max: number): number | { error: string } => {
    const n = Number(params[name]);
    if (!Number.isInteger(n) || n < min || n > max) return { error: `${name} must be a whole number from ${min} to ${max}.` };
    return n;
  };
  const symParam = (name: string): Sym | { error: string } => {
    const a = (params[name] ?? '').trim();
    if (!I.includes(a)) return { error: `${name} must be a symbol of the alphabet.` };
    return a;
  };
  const ws = `w \\in ${texSet(I)}^\\star`;
  const regular = (dfa: DFA, tex: string, predicate: (w: Sym[]) => boolean): PatternResult => {
    const m = tidy(dfa);
    return { dfa: m, grammar: dfaToGrammar(m), tex, predicate };
  };

  switch (id) {
    case 'starts': case 'ends': case 'contains': case 'avoids': {
      const w = wordParam('w');
      if ('error' in w) return w;
      const s = str(w);
      const L = w.length;
      if (id === 'starts') {
        const dead = L + 1;
        return regular(
          build(L + 2, 0, (q) => q === L, (q, a) => (q === L ? L : q === dead ? dead : a === w[q] ? q + 1 : dead), I),
          `\\{${ws} \\mid w \\text{ starts with } ${s}\\}`, (x) => str(x).startsWith(s),
        );
      }
      if (id === 'ends') return regular(build(L + 1, 0, (q) => q === L, kmp(w, false), I), `\\{${ws} \\mid w \\text{ ends in } ${s}\\}`, (x) => str(x).endsWith(s));
      if (id === 'contains') return regular(build(L + 1, 0, (q) => q === L, kmp(w, true), I), `\\{${ws} \\mid w \\text{ contains } ${s}\\}`, (x) => str(x).includes(s));
      return regular(build(L + 1, 0, (q) => q < L, kmp(w, true), I), `\\{${ws} \\mid w \\text{ does not contain } ${s}\\}`, (x) => !str(x).includes(s));
    }
    case 'len-eq': case 'len-ge': {
      const k = numParam('k', 0, 12);
      if (typeof k !== 'number') return k;
      if (id === 'len-eq') {
        return regular(build(k + 2, 0, (q) => q === k, (q) => Math.min(q + 1, k + 1), I), `\\{${ws} \\mid |w| = ${k}\\}`, (x) => x.length === k);
      }
      return regular(build(k + 1, 0, (q) => q === k, (q) => Math.min(q + 1, k), I), `\\{${ws} \\mid |w| \\geq ${k}\\}`, (x) => x.length >= k);
    }
    case 'len-mod': {
      const k = numParam('k', 1, 9);
      if (typeof k !== 'number') return k;
      const r = numParam('r', 0, k - 1);
      if (typeof r !== 'number') return r;
      return regular(build(k, 0, (q) => q === r, (q) => (q + 1) % k, I), `\\{${ws} \\mid |w| \\equiv ${r} \\pmod{${k}}\\}`, (x) => x.length % k === r);
    }
    case 'count-mod': {
      const a = symParam('a');
      if (typeof a !== 'string') return a;
      const k = numParam('k', 1, 9);
      if (typeof k !== 'number') return k;
      const r = numParam('r', 0, k - 1);
      if (typeof r !== 'number') return r;
      return regular(
        build(k, 0, (q) => q === r, (q, b) => (b === a ? (q + 1) % k : q), I),
        `\\{${ws} \\mid \\text{the number of } ${a}\\text{s in } w \\equiv ${r} \\pmod{${k}}\\}`,
        (x) => x.filter((c) => c === a).length % k === r,
      );
    }
    case 'palindromes': {
      const text = `S -> ${I.map((a) => `${a}S${a} | ${a}`).join(' | ')} | λ`;
      return { grammar: parseG(text), tex: `\\{${ws} \\mid w \\text{ is a palindrome}\\}`, predicate: (x) => str(x) === [...x].reverse().join('') };
    }
    case 'equal': case 'balanced': {
      const a = symParam('a');
      if (typeof a !== 'string') return a;
      const b = symParam('b');
      if (typeof b !== 'string') return b;
      if (a === b) return { error: 'a and b must be different symbols.' };
      if (id === 'equal') {
        return {
          grammar: parseG(`S -> ${a}S${b}S | ${b}S${a}S | λ`),
          tex: `\\{${ws} \\mid w \\text{ has as many } ${a}\\text{s as } ${b}\\text{s}\\}`,
          predicate: (x) => x.filter((c) => c === a).length === x.filter((c) => c === b).length,
        };
      }
      return {
        grammar: parseG(`S -> SS | ${a}S${b} | λ`),
        tex: `\\{${ws} \\mid w \\text{ is balanced, reading } ${a} \\text{ as ( and } ${b} \\text{ as )}\\}`,
        predicate: (x) => {
          let d = 0;
          for (const c of x) {
            d += c === a ? 1 : -1;
            if (d < 0) return false;
          }
          return d === 0;
        },
      };
    }
  }
  return { error: 'Unknown pattern.' };
}
