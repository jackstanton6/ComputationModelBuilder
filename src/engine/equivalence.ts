// Equivalence with the shortest (then lexicographically least) counterexample.
import type { DFA, Mealy, NFA, StateId, Sym } from './types';
import { sortSyms } from './notation';
import { transduce } from './fsm';

type Acceptor = DFA | NFA;

function step(m: Acceptor, set: StateId[], a: Sym): StateId[] {
  const out = new Set<StateId>();
  for (const s of set) {
    const t = m.delta[s]?.[a];
    if (t === undefined) continue;
    if (Array.isArray(t)) t.forEach((u) => out.add(u));
    else out.add(t);
  }
  return [...out].sort();
}

export interface LanguageDifference {
  word: Sym[];
  /** Which machine accepts the word (the other rejects it). */
  acceptedBy: 'first' | 'second';
}

/** Returns null if L(a) = L(b), otherwise the shortlex-least word in the symmetric difference. */
export function languageDifference(a: Acceptor, b: Acceptor, maxPairs = 200_000): LanguageDifference | null {
  const alphabet = sortSyms(new Set([...a.input, ...b.input]));
  const accA = new Set(a.accepting);
  const accB = new Set(b.accepting);
  const start: [StateId[], StateId[]] = [a.start === null ? [] : [a.start], b.start === null ? [] : [b.start]];
  const key = (p: StateId[], q: StateId[]) => p.join(',') + '|' + q.join(',');
  const seen = new Set([key(...start)]);
  const queue: { p: StateId[]; q: StateId[]; w: Sym[] }[] = [{ p: start[0], q: start[1], w: [] }];
  for (let head = 0; head < queue.length; head++) {
    const { p, q, w } = queue[head];
    const inA = p.some((s) => accA.has(s));
    const inB = q.some((s) => accB.has(s));
    if (inA !== inB) return { word: w, acceptedBy: inA ? 'first' : 'second' };
    for (const sym of alphabet) {
      const p2 = step(a, p, sym);
      const q2 = step(b, q, sym);
      const k = key(p2, q2);
      if (!seen.has(k)) {
        if (seen.size >= maxPairs) throw new Error('The comparison grew too large.');
        seen.add(k);
        queue.push({ p: p2, q: q2, w: [...w, sym] });
      }
    }
  }
  return null;
}

export interface OutputDifference {
  word: Sym[];
  first: Sym[];
  second: Sym[];
}

/** Returns null if the machines give the same output on every input, else the shortest differing input. */
export function outputDifference(a: Mealy, b: Mealy): OutputDifference | null {
  if (a.start === null || b.start === null) throw new Error('No initial state');
  const alphabet = sortSyms(new Set([...a.input, ...b.input]));
  const seen = new Set([a.start + '|' + b.start]);
  const queue: { p: StateId; q: StateId; w: Sym[] }[] = [{ p: a.start, q: b.start, w: [] }];
  for (let head = 0; head < queue.length; head++) {
    const { p, q, w } = queue[head];
    for (const sym of alphabet) {
      const op = a.out[p]?.[sym];
      const oq = b.out[q]?.[sym];
      const p2 = a.delta[p]?.[sym];
      const q2 = b.delta[q]?.[sym];
      const word = [...w, sym];
      if (op !== oq || (p2 === undefined) !== (q2 === undefined)) {
        return { word, first: transduce(a, word), second: transduce(b, word) };
      }
      if (p2 === undefined || q2 === undefined) continue;
      const k = p2 + '|' + q2;
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ p: p2, q: q2, w: word });
      }
    }
  }
  return null;
}
