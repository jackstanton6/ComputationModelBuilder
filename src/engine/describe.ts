// Guess a set-builder description of a language from its complete word list up to length n.
// A guess is only returned if it agrees with the list on every string over T up to length n.
import type { Sym } from './types';
import { enumerate } from './fsm';
import { languageUpTo, texSetBuilder, type Block, type Cond, type Lin, type SetBuilder } from './set-builder';

export interface Guess {
  /** KaTeX. */
  tex: string;
  /** Length up to which it was checked. */
  n: number;
}

const key = (w: Sym[]) => w.join('\u0001');
const str = (w: Sym[]) => w.join('');
const texT = (T: Sym[]) => `\\{${T.join(', ')}\\}`;
const count = (w: Sym[], a: Sym) => w.filter((x) => x === a).length;

interface Family {
  tex: string;
  pred: (w: Sym[]) => boolean;
}

function families(T: Sym[], W: Sym[][]): Family[] {
  const ws = `w \\in ${texT(T)}^\\star`;
  const fam: Family[] = [
    { tex: '\\emptyset', pred: () => false },
    { tex: '\\{\\lambda\\}', pred: (w) => w.length === 0 },
    { tex: `${texT(T)}^\\star`, pred: () => true },
    { tex: `${texT(T)}^\\star - \\{\\lambda\\}`, pred: (w) => w.length > 0 },
  ];
  const single = T.every((t) => [...t].length === 1);
  if (!single) return fam;
  const nonEmpty = W.filter((w) => w.length > 0).map(str);
  const common = (xs: string[], suffix: boolean) => {
    if (xs.length === 0) return '';
    let c = xs[0];
    for (const x of xs) {
      while (c && !(suffix ? x.endsWith(c) : x.startsWith(c))) c = suffix ? c.slice(1) : c.slice(0, -1);
    }
    return c;
  };
  const suf = common(nonEmpty, true);
  const pre = common(nonEmpty, false);
  for (let l = Math.min(3, suf.length); l >= 1; l--) {
    const s = suf.slice(-l);
    fam.push({ tex: `\\{${ws} \\mid w \\text{ ends in } ${s}\\}`, pred: (w) => str(w).endsWith(s) });
  }
  for (let l = Math.min(3, pre.length); l >= 1; l--) {
    const s = pre.slice(0, l);
    fam.push({ tex: `\\{${ws} \\mid w \\text{ starts with } ${s}\\}`, pred: (w) => str(w).startsWith(s) });
  }
  const shortest = nonEmpty.reduce((a, b) => (b.length < a.length ? b : a), nonEmpty[0] ?? '');
  const subs = new Set<string>();
  for (let i = 0; i < shortest.length; i++) for (let l = 1; l <= 3 && i + l <= shortest.length; l++) subs.add(shortest.slice(i, i + l));
  for (const s of [...subs].sort((a, b) => b.length - a.length)) {
    fam.push({ tex: `\\{${ws} \\mid w \\text{ contains } ${s}\\}`, pred: (w) => str(w).includes(s) });
  }
  for (const s of [...enumerate(T, 3)].filter((x) => x.length > 0).map(str)) {
    fam.push({ tex: `\\{${ws} \\mid w \\text{ does not contain } ${s}\\}`, pred: (w) => !str(w).includes(s) });
  }
  for (const k of [2, 3]) {
    for (let r = 0; r < k; r++) {
      fam.push({ tex: `\\{${ws} \\mid |w| \\equiv ${r} \\pmod{${k}}\\}`, pred: (w) => w.length % k === r });
      for (const a of T) {
        const what = k === 2 ? `\\text{${r === 0 ? 'an even' : 'an odd'} number of } ${a}\\text{s}` : `\\text{a number of } ${a}\\text{s} \\equiv ${r} \\pmod{3}`;
        fam.push({ tex: `\\{${ws} \\mid w \\text{ has } ${what}\\}`, pred: (w) => count(w, a) % k === r });
      }
    }
  }
  fam.push({ tex: `\\{${ws} \\mid w \\text{ is a palindrome}\\}`, pred: (w) => str(w) === [...w].reverse().join('') });
  if (T.length >= 2) {
    for (const a of T) {
      for (const b of T) {
        if (a === b) continue;
        if (a < b) fam.push({ tex: `\\{${ws} \\mid w \\text{ has as many } ${a}\\text{s as } ${b}\\text{s}\\}`, pred: (w) => count(w, a) === count(w, b) });
        fam.push({ tex: `\\{${ws} \\mid w \\text{ has twice as many } ${a}\\text{s as } ${b}\\text{s}\\}`, pred: (w) => count(w, a) === 2 * count(w, b) });
      }
    }
  }
  if (T.length === 2) {
    const [a, b] = T;
    fam.push({
      tex: `\\{${ws} \\mid w \\text{ is balanced, reading } ${a} \\text{ as ( and } ${b} \\text{ as )}\\}`,
      pred: (w) => {
        let d = 0;
        for (const c of w) {
          d += c === a ? 1 : -1;
          if (d < 0) return false;
        }
        return d === 0;
      },
    });
  }
  return fam;
}

// ---------- Block forms ----------

function runs(w: Sym[]): { letters: Sym[]; counts: number[] } {
  const letters: Sym[] = [];
  const counts: number[] = [];
  for (const c of w) {
    if (letters[letters.length - 1] === c) counts[counts.length - 1]++;
    else {
      letters.push(c);
      counts.push(1);
    }
  }
  return { letters, counts };
}

const isSubseq = (a: Sym[], b: Sym[]) => {
  let j = 0;
  for (const x of b) if (j < a.length && a[j] === x) j++;
  return j === a.length;
};

type Rel =
  | { k: 'eq'; i: number; j: number }
  | { k: 'dbl'; big: number; small: number }
  | { k: 'sum'; to: number; i: number; j: number }
  | { k: 'cmp'; i: number; j: number; op: '<' | '>' | '≠' };

function relHolds(r: Rel, e: number[]): boolean {
  switch (r.k) {
    case 'eq': return e[r.i] === e[r.j];
    case 'dbl': return e[r.big] === 2 * e[r.small];
    case 'sum': return e[r.to] === e[r.i] + e[r.j];
    case 'cmp': return r.op === '<' ? e[r.i] < e[r.j] : r.op === '>' ? e[r.i] > e[r.j] : e[r.i] !== e[r.j];
  }
}

function relations(k: number): Rel[][] {
  const singles: Rel[] = [];
  const eqs: Rel[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      eqs.push({ k: 'eq', i, j });
      eqs.push({ k: 'dbl', big: i, small: j });
      eqs.push({ k: 'dbl', big: j, small: i });
      for (let t = 0; t < k; t++) if (t !== i && t !== j) eqs.push({ k: 'sum', to: t, i, j });
      for (const op of ['<', '>', '≠'] as const) singles.push({ k: 'cmp', i, j, op });
    }
  }
  const out: Rel[][] = [[]];
  for (const r of eqs) out.push([r]);
  for (const r of singles) out.push([r]);
  const target = (r: Rel) => (r.k === 'eq' ? r.j : r.k === 'dbl' ? r.big : r.k === 'sum' ? r.to : -1);
  for (let a = 0; a < eqs.length; a++) {
    for (let b = a + 1; b < eqs.length; b++) {
      if (target(eqs[a]) !== target(eqs[b])) out.push([eqs[a], eqs[b]]);
    }
  }
  return out;
}

const VAR_NAMES = ['n', 'm', 'k', 'l'];

function buildSb(M: Sym[], rels: Rel[], lbs: number[], consts: Map<number, number>): SetBuilder | null {
  const k = M.length;
  let exps: Lin[] = M.map((_, i) => (consts.has(i) ? { c: consts.get(i)!, t: {} } : { c: 0, t: { [`v${i}`]: 1 } }));
  const derived = new Set<number>(consts.keys());
  const conds: Cond[] = [];
  const add = (a: Lin, b: Lin, kb = 1): Lin => {
    const t = { ...a.t };
    for (const [v, x] of Object.entries(b.t)) t[v] = (t[v] ?? 0) + kb * x;
    return { c: a.c + kb * b.c, t };
  };
  for (const r of rels) {
    if (r.k === 'eq') {
      if (derived.has(r.j)) return null;
      exps[r.j] = exps[r.i];
      derived.add(r.j);
    } else if (r.k === 'dbl') {
      if (derived.has(r.big)) return null;
      exps[r.big] = add({ c: 0, t: {} }, exps[r.small], 2);
      derived.add(r.big);
    } else if (r.k === 'sum') {
      if (derived.has(r.to)) return null;
      exps[r.to] = add(exps[r.i], exps[r.j]);
      derived.add(r.to);
    } else {
      conds.push({ left: exps[r.i], op: r.op, right: exps[r.j] });
    }
  }
  // Rename free variables n, m, k, l in block order.
  const free = [...new Set(exps.flatMap((e) => Object.keys(e.t)))];
  const ren = (l: Lin): Lin => ({ c: l.c, t: Object.fromEntries(Object.entries(l.t).map(([v, x]) => [VAR_NAMES[free.indexOf(v)], x])) });
  exps = exps.map(ren);
  const renConds = conds.map((c) => ({ ...c, left: ren(c.left), right: ren(c.right) }));
  for (let i = 0; i < k; i++) {
    if (derived.has(i)) continue;
    const v = VAR_NAMES[free.indexOf(`v${i}`)];
    renConds.push({ left: { c: 0, t: { [v]: 1 } }, op: '≥', right: { c: lbs[i], t: {} } });
  }
  const blocks: Block[] = M.map((x, i) => ({ word: [x], exp: exps[i] }));
  return { blocks, conds: renConds, vars: free.map((_, i) => VAR_NAMES[i]) };
}

function blockGuess(W: Sym[][], n: number): string | null {
  const Wkeys = new Set(W.map(key));
  const seqs = new Map<string, Sym[]>();
  for (const w of W) seqs.set(key(runs(w).letters), runs(w).letters);
  const all = [...seqs.values()];
  const maximal = all.filter((s) => !all.some((o) => o.length > s.length && isSubseq(s, o)));
  if (maximal.length === 0 || maximal.length > 3 || maximal.some((m) => m.length > 4 || m.length === 0)) return null;
  const parts: { sb: SetBuilder; words: Set<string> }[] = [];
  for (const M of maximal) {
    const exact = W.filter((w) => key(runs(w).letters) === key(M)).map((w) => runs(w).counts);
    if (exact.length === 0) return null;
    const minObs = M.map((_, i) => Math.min(...exact.map((e) => e[i])));
    const constant = new Map<number, number>();
    M.forEach((_, i) => {
      if (exact.length > 1 && exact.every((e) => e[i] === exact[0][i]) && exact[0][i] <= 3) constant.set(i, exact[0][i]);
    });
    const involves = (r: Rel, i: number) => Object.values(r).includes(i);
    const attempts: { rs: Rel[]; consts: Map<number, number> }[] = [];
    for (const consts of constant.size ? [constant, new Map<number, number>()] : [new Map<number, number>()]) {
      for (const rs of relations(M.length)) {
        if (rs.some((r) => [...consts.keys()].some((i) => involves(r, i)))) continue;
        if (rs.every((r) => exact.every((e) => relHolds(r, e)))) attempts.push({ rs, consts });
      }
    }
    let found: { sb: SetBuilder; words: Set<string> } | null = null;
    outer: for (const { rs, consts } of attempts) {
      const options = M.map((_, i) => Array.from({ length: Math.min(2, minObs[i]) + 1 }, (_, x) => x));
      const combos: number[][] = [[]];
      for (const opt of options) {
        const next: number[][] = [];
        for (const c of combos) for (const o of opt) next.push([...c, o]);
        combos.splice(0, combos.length, ...next);
      }
      // Smallest lower bounds first: the largest language that still fits inside W.
      combos.sort((a, b) => a.reduce((s, x) => s + x, 0) - b.reduce((s, x) => s + x, 0));
      for (const lbs of combos) {
        const sb = buildSb(M, rs, lbs, consts);
        if (!sb) continue;
        const L = languageUpTo(sb, n);
        if (!L.every((w) => Wkeys.has(key(w)))) continue;
        const Lk = new Set(L.map(key));
        if (!W.filter((w) => key(runs(w).letters) === key(M)).every((w) => Lk.has(key(w)))) continue;
        found = { sb, words: Lk };
        break outer;
      }
    }
    if (!found) return null;
    parts.push(found);
  }
  const union = new Set(parts.flatMap((p) => [...p.words]));
  if (union.size !== Wkeys.size || ![...Wkeys].every((k) => union.has(k))) {
    return null;
  }
  return parts.map((p) => texSetBuilder(p.sb)).join(' \\cup ');
}

/** Guess a description of the language whose words up to length n are exactly `words`. */
export function guessLanguage(words: Sym[][], T: Sym[], n: number): Guess | null {
  const W = words.filter((w) => w.length <= n);
  const Wkeys = new Set(W.map(key));
  const all = [...enumerate(T, n)];
  for (const f of families(T, W)) {
    if (all.every((w) => f.pred(w) === Wkeys.has(key(w)))) return { tex: f.tex, n };
  }
  if (W.length === 0) return null;
  const b = blockGuess(W, n);
  if (b) return { tex: b, n };
  if (W.length <= 8 && W.every((w) => w.length <= n - 2)) return { tex: `\\{${W.map((w) => (w.length ? w.join('') : '\\lambda')).join(', ')}\\}`, n };
  return null;
}
