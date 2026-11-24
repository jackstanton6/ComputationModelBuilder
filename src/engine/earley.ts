// Earley recogniser and parser for context-free grammars (handles λ-productions and left
// recursion). The chart can be extended and shrunk one symbol at a time, which the word lister
// uses to prune dead prefixes.
import type { Grammar, Production, Sym } from './types';
import type { Derivation } from './derivation';
import { applyAt } from './derivation';
import { isContextFree, nonTerminals } from './grammar';

interface Item {
  p: number; // production index
  dot: number;
  origin: number;
}

interface ChartSet {
  items: Item[];
  keys: Set<string>;
}

const itemKey = (p: number, dot: number, origin: number) => `${p}:${dot}:${origin}`;

export function nullableSet(g: Grammar): Set<Sym> {
  const nullable = new Set<Sym>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of g.P) {
      const A = p.lhs[0];
      if (!nullable.has(A) && p.rhs.every((s) => nullable.has(s))) {
        nullable.add(A);
        changed = true;
      }
    }
  }
  return nullable;
}

export class Earley {
  readonly g: Grammar;
  private readonly N: Set<Sym>;
  private readonly byLhs = new Map<Sym, number[]>();
  private readonly nullable: Set<Sym>;
  readonly sets: ChartSet[] = [];
  readonly tokens: Sym[] = [];

  constructor(g: Grammar) {
    if (!isContextFree(g)) throw new Error('Earley parsing needs a context-free grammar.');
    this.g = g;
    this.N = new Set(nonTerminals(g));
    g.P.forEach((p, i) => {
      const A = p.lhs[0];
      if (!this.byLhs.has(A)) this.byLhs.set(A, []);
      this.byLhs.get(A)!.push(i);
    });
    this.nullable = nullableSet(g);
    const s0: ChartSet = { items: [], keys: new Set() };
    this.sets.push(s0);
    for (const p of this.byLhs.get(g.S) ?? []) this.add(s0, { p, dot: 0, origin: 0 });
    this.close(0);
  }

  private add(set: ChartSet, it: Item) {
    const k = itemKey(it.p, it.dot, it.origin);
    if (!set.keys.has(k)) {
      set.keys.add(k);
      set.items.push(it);
    }
  }

  private close(j: number) {
    const set = this.sets[j];
    for (let x = 0; x < set.items.length; x++) {
      const it = set.items[x];
      const rhs = this.g.P[it.p].rhs;
      if (it.dot < rhs.length) {
        const B = rhs[it.dot];
        if (this.N.has(B)) {
          for (const q of this.byLhs.get(B) ?? []) this.add(set, { p: q, dot: 0, origin: j });
          if (this.nullable.has(B)) this.add(set, { p: it.p, dot: it.dot + 1, origin: it.origin });
        }
      } else {
        const A = this.g.P[it.p].lhs[0];
        const from = this.sets[it.origin];
        for (let y = 0; y < from.items.length; y++) {
          const jt = from.items[y];
          const r2 = this.g.P[jt.p].rhs;
          if (jt.dot < r2.length && r2[jt.dot] === A) this.add(set, { p: jt.p, dot: jt.dot + 1, origin: jt.origin });
        }
      }
    }
  }

  /** Read one more symbol. Returns false if no word of L(G) has the current prefix. */
  push(sym: Sym): boolean {
    const prev = this.sets[this.sets.length - 1];
    const next: ChartSet = { items: [], keys: new Set() };
    for (const it of prev.items) {
      const rhs = this.g.P[it.p].rhs;
      if (it.dot < rhs.length && rhs[it.dot] === sym) this.add(next, { p: it.p, dot: it.dot + 1, origin: it.origin });
    }
    this.sets.push(next);
    this.tokens.push(sym);
    this.close(this.sets.length - 1);
    return next.items.length > 0;
  }

  pop() {
    if (this.tokens.length === 0) return;
    this.sets.pop();
    this.tokens.pop();
  }

  alive(): boolean {
    return this.sets[this.sets.length - 1].items.length > 0;
  }

  accepts(): boolean {
    const last = this.sets[this.sets.length - 1];
    return last.items.some((it) => it.origin === 0 && this.g.P[it.p].lhs[0] === this.g.S && it.dot === this.g.P[it.p].rhs.length);
  }

  // ---------- Parse tree extraction ----------

  private hasItem(set: number, p: number, dot: number, origin: number) {
    return this.sets[set].keys.has(itemKey(p, dot, origin));
  }

  private completedProds(A: Sym, i: number, j: number): number[] {
    return (this.byLhs.get(A) ?? []).filter((p) => this.hasItem(j, p, this.g.P[p].rhs.length, i));
  }

  /** Returns a parse tree for the whole input, or null. */
  tree(): ParseTree | null {
    if (!this.accepts()) return null;
    const memo = new Map<string, ParseTree | null>();
    const active = new Set<string>();
    const n = this.tokens.length;

    const build = (A: Sym, i: number, j: number): ParseTree | null => {
      const key = `${A}@${i}-${j}`;
      if (memo.has(key)) return memo.get(key)!;
      if (active.has(key)) return null;
      active.add(key);
      let result: ParseTree | null = null;
      for (const p of this.completedProds(A, i, j)) {
        const kids = match(p, i, this.g.P[p].rhs.length, j);
        if (kids) {
          result = { sym: A, prod: p, children: kids };
          break;
        }
      }
      active.delete(key);
      if (result) memo.set(key, result);
      return result;
    };

    const match = (p: number, i: number, pos: number, end: number): (ParseTree | Sym)[] | null => {
      if (pos === 0) return end === i ? [] : null;
      const X = this.g.P[p].rhs[pos - 1];
      if (!this.N.has(X)) {
        if (end > i && this.tokens[end - 1] === X && this.hasItem(end - 1, p, pos - 1, i)) {
          const rest = match(p, i, pos - 1, end - 1);
          return rest ? [...rest, X] : null;
        }
        return null;
      }
      for (let mid = end; mid >= i; mid--) {
        if (!this.hasItem(mid, p, pos - 1, i)) continue;
        if (this.completedProds(X, mid, end).length === 0) continue;
        const sub = build(X, mid, end);
        if (!sub) continue;
        const rest = match(p, i, pos - 1, mid);
        if (rest) return [...rest, sub];
      }
      return null;
    };

    return build(this.g.S, 0, n);
  }
}

export interface ParseTree {
  sym: Sym;
  prod: number;
  children: (ParseTree | Sym)[];
}

/** Turn a parse tree into a leftmost derivation. */
export function treeToDerivation(g: Grammar, t: ParseTree): Derivation {
  type Node = ParseTree | Sym;
  let frontier: Node[] = [t];
  const symOf = (x: Node) => (typeof x === 'string' ? x : x.sym);
  const forms: Sym[][] = [[g.S]];
  const steps: Derivation['steps'] = [];
  for (;;) {
    const idx = frontier.findIndex((x) => typeof x !== 'string');
    if (idx < 0) break;
    const node = frontier[idx] as ParseTree;
    const prod: Production = g.P[node.prod];
    steps.push({ prod, pos: idx });
    frontier = [...frontier.slice(0, idx), ...node.children, ...frontier.slice(idx + 1)];
    forms.push(frontier.map(symOf));
  }
  // Sanity: forms are consistent with applyAt.
  for (let k = 0; k < steps.length; k++) {
    const expected = applyAt(forms[k], steps[k].prod, steps[k].pos);
    if (expected.join('\u0001') !== forms[k + 1].join('\u0001')) throw new Error('Derivation mismatch');
  }
  return { forms, steps };
}

export function earleyRecognise(g: Grammar, w: Sym[]): boolean {
  const e = new Earley(g);
  for (const s of w) if (!e.push(s)) return false;
  return e.accepts();
}

/** Leftmost derivation of w, or null if w ∉ L(G). */
export function earleyDerive(g: Grammar, w: Sym[]): Derivation | null {
  const e = new Earley(g);
  for (const s of w) if (!e.push(s)) return null;
  const t = e.tree();
  return t ? treeToDerivation(g, t) : null;
}

/** All words of L(G) up to length n (context-free G), via DFS with dead-prefix pruning. */
export function cfgWordsUpTo(g: Grammar, n: number, cap = 5000, shouldStop?: () => boolean): { words: Sym[][]; truncated: boolean } {
  const e = new Earley(g);
  const words: Sym[][] = [];
  const T = g.T;
  let truncated = false;
  let counter = 0;
  const dfs = (prefix: Sym[]) => {
    if (truncated) return;
    if (e.accepts()) {
      words.push([...prefix]);
      if (words.length >= cap) {
        truncated = true;
        return;
      }
    }
    if (prefix.length === n) return;
    if ((++counter & 1023) === 0 && shouldStop?.()) {
      truncated = true;
      return;
    }
    for (const a of T) {
      if (e.push(a)) {
        prefix.push(a);
        dfs(prefix);
        prefix.pop();
      }
      e.pop();
      if (truncated) return;
    }
  };
  dfs([]);
  const rank = new Map(T.map((s, i) => [s, i]));
  words.sort((a, b) => a.length - b.length || cmpRank(a, b, rank));
  return { words, truncated };
}

function cmpRank(a: Sym[], b: Sym[], rank: Map<Sym, number>): number {
  for (let i = 0; i < a.length; i++) {
    const d = rank.get(a[i])! - rank.get(b[i])!;
    if (d) return d;
  }
  return 0;
}
