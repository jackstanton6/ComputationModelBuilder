// Bounded breadth-first search over sentential forms, for grammars of any type.
import type { Grammar, Production, Sym } from './types';
import { LIMITS } from './types';
import type { Derivation, DerivationStep } from './derivation';
import { applyAt, occurrences } from './derivation';
import { nonTerminals } from './grammar';

const SEP = '\u0001';
const keyOf = (f: Sym[]) => f.join(SEP);

/** Non-contracting apart from S → λ when S is on no right-hand side, so forms never shrink. */
export function isNonContracting(g: Grammar): boolean {
  const sOnRight = g.P.some((p) => p.rhs.includes(g.S));
  return g.P.every((p) => p.rhs.length >= p.lhs.length
    || (!sOnRight && p.lhs.length === 1 && p.lhs[0] === g.S && p.rhs.length === 0));
}

interface Node {
  form: Sym[];
  parent: string | null;
  step: DerivationStep | null;
}

export interface SearchOptions {
  nodeCap?: number;
  shouldStop?: () => boolean;
  onProgress?: (nodes: number) => void;
}

function rebuild(nodes: Map<string, Node>, key: string): Derivation {
  const forms: Sym[][] = [];
  const steps: DerivationStep[] = [];
  let k: string | null = key;
  while (k !== null) {
    const nd: Node = nodes.get(k)!;
    forms.push(nd.form);
    if (nd.step) steps.push(nd.step);
    k = nd.parent;
  }
  return { forms: forms.reverse(), steps: steps.reverse() };
}

interface Explorer {
  /** Return false to prune this form. */
  keep: (form: Sym[]) => boolean;
  /** Return true to stop the search. */
  visit: (form: Sym[], key: string) => boolean;
}

function bfs(g: Grammar, ex: Explorer, opts: SearchOptions, nodes: Map<string, Node>): { complete: boolean; nodes: number } {
  const cap = opts.nodeCap ?? LIMITS.searchNodeCap;
  const start = [g.S];
  nodes.set(keyOf(start), { form: start, parent: null, step: null });
  const queue: string[] = [keyOf(start)];
  const prods: Production[] = g.P;
  for (let head = 0; head < queue.length; head++) {
    const key = queue[head];
    const { form } = nodes.get(key)!;
    if (ex.visit(form, key)) return { complete: true, nodes: nodes.size };
    if ((head & 2047) === 0) {
      opts.onProgress?.(nodes.size);
      if (opts.shouldStop?.()) return { complete: false, nodes: nodes.size };
    }
    for (const p of prods) {
      for (const pos of occurrences(form, p.lhs)) {
        const next = applyAt(form, p, pos);
        const k = keyOf(next);
        if (nodes.has(k) || !ex.keep(next)) continue;
        if (nodes.size >= cap) return { complete: false, nodes: nodes.size };
        nodes.set(k, { form: next, parent: key, step: { prod: p, pos } });
        queue.push(k);
      }
    }
  }
  return { complete: true, nodes: nodes.size };
}

function terminalOnLeft(g: Grammar): boolean {
  const T = new Set(g.T);
  return g.P.some((p) => p.lhs.some((s) => T.has(s)));
}

export interface MembershipResult {
  /** A derivation if found. */
  derivation: Derivation | null;
  /** True if the search space was exhausted, so "not found" means w ∉ L(G). */
  exact: boolean;
  nodes: number;
}

/** Search for a derivation of w. Exact when G is non-contracting (forms longer than |w| are pruned). */
export function searchMembership(g: Grammar, w: Sym[], opts: SearchOptions = {}): MembershipResult {
  const T = new Set(g.T);
  const monotone = isNonContracting(g);
  const fixedTerminals = !terminalOnLeft(g);
  const wKey = keyOf(w);
  const wSyms = new Set(w);
  const keep = (form: Sym[]) => {
    if (monotone && form.length > w.length) return false;
    if (fixedTerminals) {
      // Terminals before the first non-terminal (and after the last) can never change.
      let i = 0;
      while (i < form.length && T.has(form[i])) {
        if (form[i] !== w[i]) return false;
        i++;
      }
      let j = 0;
      while (j < form.length - i && T.has(form[form.length - 1 - j])) {
        if (form[form.length - 1 - j] !== w[w.length - 1 - j]) return false;
        j++;
      }
      let terms = 0;
      for (const s of form) {
        if (T.has(s)) {
          if (!wSyms.has(s)) return false;
          terms++;
        }
      }
      if (terms > w.length) return false;
    }
    return true;
  };
  let found: string | null = null;
  const nodes = new Map<string, Node>();
  const r = bfs(g, {
    keep,
    visit: (_f, k) => {
      if (k === wKey) {
        found = k;
        return true;
      }
      return false;
    },
  }, opts, nodes);
  // An empty w has the key '' which equals the key of the empty form.
  return { derivation: found !== null ? rebuild(nodes, found) : null, exact: r.complete, nodes: r.nodes };
}

export interface GeneratedWords {
  words: Sym[][];
  /** True if every word of length ≤ n was found. */
  complete: boolean;
  derivationOf: (w: Sym[]) => Derivation | null;
}

/** Generate the words of L(G) up to length n by bounded BFS. */
export function generateWords(g: Grammar, n: number, opts: SearchOptions = {}): GeneratedWords {
  const T = new Set(g.T);
  const N = new Set(nonTerminals(g));
  const monotone = isNonContracting(g);
  const fixedTerminals = !terminalOnLeft(g);
  const words: Sym[][] = [];
  const nodes = new Map<string, Node>();
  const keep = (form: Sym[]) => {
    if (monotone && form.length > n) return false;
    if (fixedTerminals) {
      let terms = 0;
      for (const s of form) if (T.has(s)) terms++;
      if (terms > n) return false;
    }
    return true;
  };
  const r = bfs(g, {
    keep,
    visit: (form) => {
      if (form.length <= n && form.every((s) => !N.has(s))) words.push(form);
      return false;
    },
  }, opts, nodes);
  const rank = new Map(g.T.map((s, i) => [s, i]));
  words.sort((a, b) => a.length - b.length || a.reduce((d, s, i) => d || rank.get(s)! - rank.get(b[i])!, 0));
  return {
    words,
    complete: r.complete,
    derivationOf: (w) => (nodes.has(keyOf(w)) ? rebuild(nodes, keyOf(w)) : null),
  };
}
