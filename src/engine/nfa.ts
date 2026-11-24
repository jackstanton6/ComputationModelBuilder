// Subset construction (lecture theorem): only reachable subsets, including ∅ if reached.
import type { DFA, NFA, StateId, Sym } from './types';
import { stateName } from './notation';
import { orderStates, stepSet } from './fsm';

export interface SubsetRow {
  subset: StateId[];
  next: Record<Sym, StateId[]>;
  final: boolean;
}

export interface SubsetResult {
  rows: SubsetRow[];
  dfa: DFA;
}

export const subsetKey = (ids: StateId[]) => `{${ids.join(',')}}`;

export function subsetConstruction(m: NFA, maxSubsets = 4096): SubsetResult {
  if (m.start === null) throw new Error('No initial state');
  const acc = new Set(m.accepting);
  const startSet = [m.start];
  const rows: SubsetRow[] = [];
  const seen = new Map<string, StateId[]>([[subsetKey(startSet), startSet]]);
  const queue: StateId[][] = [startSet];
  while (queue.length) {
    const cur = queue.shift()!;
    const next: Record<Sym, StateId[]> = {};
    for (const i of m.input) {
      const t = stepSet(m, cur, i);
      next[i] = t;
      const k = subsetKey(t);
      if (!seen.has(k)) {
        if (seen.size >= maxSubsets) throw new Error(`The subset construction reached more than ${maxSubsets} subsets.`);
        seen.set(k, t);
        queue.push(t);
      }
    }
    rows.push({ subset: cur, next, final: cur.some((s) => acc.has(s)) });
  }
  const names: Record<StateId, string> = {};
  for (const r of rows) {
    names[subsetKey(r.subset)] = r.subset.length === 0
      ? '∅'
      : `{${orderStates(m, r.subset).map((s) => stateName(m, s)).join(',')}}`;
  }
  const delta: DFA['delta'] = {};
  for (const r of rows) {
    delta[subsetKey(r.subset)] = Object.fromEntries(m.input.map((i) => [i, subsetKey(r.next[i])]));
  }
  const dfa: DFA = {
    kind: 'dfa',
    states: rows.map((r) => subsetKey(r.subset)),
    input: [...m.input],
    start: subsetKey(startSet),
    accepting: rows.filter((r) => r.final).map((r) => subsetKey(r.subset)),
    delta,
    names,
  };
  return { rows, dfa };
}

/** Rename states s0, s1, … in order. Returns the machine and a legend old name -> new name. */
export function renameSequential(m: DFA): { dfa: DFA; legend: [string, string][] } {
  const map = new Map<StateId, StateId>();
  m.states.forEach((s, i) => map.set(s, `s${i}`));
  const legend: [string, string][] = m.states.map((s) => [stateName(m, s), map.get(s)!]);
  const delta: DFA['delta'] = {};
  for (const s of m.states) {
    delta[map.get(s)!] = Object.fromEntries(Object.entries(m.delta[s] ?? {}).map(([i, t]) => [i, map.get(t)!]));
  }
  return {
    dfa: {
      kind: 'dfa',
      states: m.states.map((s) => map.get(s)!),
      input: [...m.input],
      start: m.start === null ? null : map.get(m.start)!,
      accepting: m.accepting.map((s) => map.get(s)!),
      delta,
    },
    legend,
  };
}
