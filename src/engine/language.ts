// Unified grammar membership, word listing and comparison with a language predicate.
import type { Grammar, Sym } from './types';
import type { Derivation } from './derivation';
import { isContextFree } from './grammar';
import { cfgWordsUpTo, earleyDerive } from './earley';
import { generateWords, isNonContracting, searchMembership, type SearchOptions } from './bounded-search';
import { enumerate } from './fsm';

export interface Membership {
  /** true / false, or null when the search limit was hit. */
  member: boolean | null;
  derivation: Derivation | null;
  method: 'earley' | 'search';
}

export function membership(g: Grammar, w: Sym[], opts: SearchOptions = {}): Membership {
  if (isContextFree(g)) {
    const d = earleyDerive(g, w);
    return { member: d !== null, derivation: d, method: 'earley' };
  }
  const r = searchMembership(g, w, opts);
  return { member: r.derivation ? true : r.exact ? false : null, derivation: r.derivation, method: 'search' };
}

export interface WordsResult {
  words: Sym[][];
  /** False if a limit was hit, so the list may be missing words. */
  complete: boolean;
  derivationOf: (w: Sym[]) => Derivation | null;
}

export function wordsUpTo(g: Grammar, n: number, opts: SearchOptions = {}, cap = 5000): WordsResult {
  if (isContextFree(g)) {
    const r = cfgWordsUpTo(g, n, cap, opts.shouldStop);
    return { words: r.words, complete: !r.truncated, derivationOf: (w) => earleyDerive(g, w) };
  }
  const r = generateWords(g, n, opts);
  return {
    words: r.words.slice(0, cap),
    complete: r.complete && r.words.length <= cap,
    derivationOf: (w) => r.derivationOf(w) ?? searchMembership(g, w, opts).derivation,
  };
}

export type PredicateComparison =
  | { kind: 'equal'; checkedUpTo: number }
  | { kind: 'over'; word: Sym[]; derivation: Derivation | null; checkedUpTo: number }
  | { kind: 'under'; word: Sym[]; checkedUpTo: number }
  | { kind: 'inconclusive'; checkedUpTo: number; message: string };

/** Compare L(G) with a predicate on every word over T up to length n. Reports the shortlex-first discrepancy. */
export function compareWithPredicate(
  g: Grammar, predicate: (w: Sym[]) => boolean, T: Sym[], n: number, opts: SearchOptions = {},
): PredicateComparison {
  const r = wordsUpTo(g, n, opts, Infinity);
  const inG = new Set(r.words.map((w) => w.join('\u0001')));
  const Tset = new Set(T);
  // Words of G using symbols outside T are always over-generation.
  for (const w of enumerate(T, n)) {
    const k = w.join('\u0001');
    const g1 = inG.has(k);
    const p = predicate(w);
    if (g1 && !p) return { kind: 'over', word: w, derivation: r.derivationOf(w), checkedUpTo: n };
    if (!g1 && p) {
      if (!r.complete) {
        return {
          kind: 'inconclusive', checkedUpTo: n,
          message: `Couldn’t find a derivation of ${w.length ? w.join('') : 'λ'} within the search limit, so the check is inconclusive.`,
        };
      }
      return { kind: 'under', word: w, checkedUpTo: n };
    }
  }
  const stray = r.words.find((w) => w.some((s) => !Tset.has(s)));
  if (stray) return { kind: 'over', word: stray, derivation: r.derivationOf(stray), checkedUpTo: n };
  return { kind: 'equal', checkedUpTo: n };
}

export { isNonContracting };
