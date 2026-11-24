// Validation, runs, enumeration and FSM-without-output operations.
import type { DFA, Machine, Mealy, NFA, StateId, Sym } from './types';
import { LIMITS } from './types';
import { plainName, stateName } from './notation';

export type IssueCode =
  | 'no-states' | 'no-initial' | 'empty-alphabet' | 'undefined-f' | 'undefined-g'
  | 'bad-target' | 'bad-symbol' | 'bad-output' | 'unreachable' | 'too-many-states'
  | 'duplicate-name';

export interface Issue {
  severity: 'error' | 'warning';
  code: IssueCode;
  message: string;
  state?: StateId;
  sym?: Sym;
}

const n = (m: Machine, id: StateId) => plainName(stateName(m, id));

export function reachable(m: Machine): Set<StateId> {
  const seen = new Set<StateId>();
  if (m.start === null || !m.states.includes(m.start)) return seen;
  const stack = [m.start];
  seen.add(m.start);
  while (stack.length) {
    const s = stack.pop()!;
    for (const i of m.input) {
      const t = m.delta[s]?.[i];
      const targets = t === undefined ? [] : Array.isArray(t) ? t : [t];
      for (const u of targets) {
        if (!seen.has(u)) {
          seen.add(u);
          stack.push(u);
        }
      }
    }
  }
  return seen;
}

export function validate(m: Machine): Issue[] {
  const issues: Issue[] = [];
  const stateSet = new Set(m.states);
  if (m.states.length === 0) {
    issues.push({ severity: 'error', code: 'no-states', message: 'S is empty. Add at least one state.' });
    return issues;
  }
  if (m.states.length > LIMITS.maxStates) {
    issues.push({
      severity: 'error', code: 'too-many-states',
      message: `This machine has ${m.states.length} states. The limit is ${LIMITS.maxStates}.`,
    });
  }
  if (m.input.length === 0) {
    issues.push({ severity: 'error', code: 'empty-alphabet', message: 'The input alphabet I is empty.' });
  }
  if (m.kind === 'mealy' && m.output.length === 0) {
    issues.push({ severity: 'error', code: 'empty-alphabet', message: 'The output alphabet O is empty.' });
  }
  if (m.start === null || !stateSet.has(m.start)) {
    issues.push({ severity: 'error', code: 'no-initial', message: 'No initial state s₀.' });
  }
  const seenNames = new Map<string, StateId>();
  for (const s of m.states) {
    const name = stateName(m, s);
    if (seenNames.has(name)) {
      issues.push({
        severity: 'error', code: 'duplicate-name', state: s,
        message: `Two states are called ${plainName(name)}. Rename one of them.`,
      });
    }
    seenNames.set(name, s);
  }
  const inputSet = new Set(m.input);
  for (const s of m.states) {
    const row = m.delta[s] ?? {};
    for (const sym of Object.keys(row)) {
      if (!inputSet.has(sym)) {
        issues.push({
          severity: 'error', code: 'bad-symbol', state: s, sym,
          message: `A transition from ${n(m, s)} reads “${sym}”, which isn't in I.`,
        });
      }
    }
    for (const i of m.input) {
      const t = row[i];
      if (m.kind === 'nfa') {
        for (const u of (t as StateId[] | undefined) ?? []) {
          if (!stateSet.has(u)) {
            issues.push({ severity: 'error', code: 'bad-target', state: s, sym: i, message: `f(${n(m, s)}, ${i}) refers to a deleted state.` });
          }
        }
        continue;
      }
      if (t === undefined) {
        const what = m.kind === 'dfa' ? 'an FSM without output' : 'an FSM with output';
        issues.push({
          severity: 'error', code: 'undefined-f', state: s, sym: i,
          message: `f(${n(m, s)}, ${i}) is undefined. In ${what} f : S × I → S must be defined for every state and input.`,
        });
      } else if (!stateSet.has(t as StateId)) {
        issues.push({ severity: 'error', code: 'bad-target', state: s, sym: i, message: `f(${n(m, s)}, ${i}) refers to a deleted state.` });
      }
      if (m.kind === 'mealy') {
        const o = m.out[s]?.[i];
        if (o === undefined) {
          issues.push({
            severity: 'error', code: 'undefined-g', state: s, sym: i,
            message: `g(${n(m, s)}, ${i}) is undefined. g : S × I → O must be defined for every state and input.`,
          });
        } else if (!m.output.includes(o)) {
          issues.push({ severity: 'error', code: 'bad-output', state: s, sym: i, message: `g(${n(m, s)}, ${i}) = ${o}, which isn't in O.` });
        }
      }
    }
  }
  if (m.start !== null && stateSet.has(m.start)) {
    const r = reachable(m);
    for (const s of m.states) {
      if (!r.has(s)) {
        issues.push({
          severity: 'warning', code: 'unreachable', state: s,
          message: `${n(m, s)} can't be reached from s₀.`,
        });
      }
    }
  }
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');

// ---------- Runs ----------

export interface DetStep {
  k: number;
  sym: Sym;
  before: StateId;
  after: StateId;
  out?: Sym;
}

export interface DetRun {
  steps: DetStep[];
  final: StateId;
  accepted: boolean;
  output: Sym[];
  /** Set if a transition was missing (only possible for invalid machines). */
  stuck?: { state: StateId; sym: Sym };
}

export function runDeterministic(m: DFA | Mealy, w: Sym[]): DetRun {
  if (m.start === null) throw new Error('No initial state');
  let s = m.start;
  const steps: DetStep[] = [];
  const output: Sym[] = [];
  for (let k = 0; k < w.length; k++) {
    const sym = w[k];
    const t = m.delta[s]?.[sym];
    if (t === undefined) {
      return { steps, final: s, accepted: false, output, stuck: { state: s, sym } };
    }
    const step: DetStep = { k: k + 1, sym, before: s, after: t };
    if (m.kind === 'mealy') {
      step.out = m.out[s]?.[sym];
      if (step.out !== undefined) output.push(step.out);
    }
    steps.push(step);
    s = t;
  }
  const accepted = m.kind === 'dfa' ? m.accepting.includes(s) : false;
  return { steps, final: s, accepted, output };
}

export interface SetStep {
  k: number;
  sym: Sym;
  before: StateId[];
  after: StateId[];
}

export interface SetRun {
  steps: SetStep[];
  final: StateId[];
  accepted: boolean;
}

/** Order a set of states by their order in S. */
export function orderStates(m: Machine, ids: Iterable<StateId>): StateId[] {
  const set = new Set(ids);
  return m.states.filter((s) => set.has(s));
}

export function stepSet(m: NFA, from: Iterable<StateId>, sym: Sym): StateId[] {
  const next = new Set<StateId>();
  for (const s of from) for (const t of m.delta[s]?.[sym] ?? []) next.add(t);
  return orderStates(m, next);
}

export function runNondeterministic(m: NFA, w: Sym[]): SetRun {
  if (m.start === null) throw new Error('No initial state');
  let cur: StateId[] = [m.start];
  const steps: SetStep[] = [];
  w.forEach((sym, k) => {
    const after = stepSet(m, cur, sym);
    steps.push({ k: k + 1, sym, before: cur, after });
    cur = after;
  });
  const acc = new Set(m.accepting);
  return { steps, final: cur, accepted: cur.some((s) => acc.has(s)) };
}

export function accepts(m: DFA | NFA, w: Sym[]): boolean {
  return m.kind === 'dfa' ? runDeterministic(m, w).accepted : runNondeterministic(m, w).accepted;
}

export function transduce(m: Mealy, w: Sym[]): Sym[] {
  return runDeterministic(m, w).output;
}

// ---------- Enumeration ----------

/** All words over the alphabet up to length n, in shortlex order (alphabet order as given). */
export function* enumerate(alphabet: Sym[], n: number): Generator<Sym[]> {
  yield [];
  let layer: Sym[][] = [[]];
  for (let len = 1; len <= n; len++) {
    const next: Sym[][] = [];
    for (const w of layer) {
      for (const a of alphabet) {
        const x = [...w, a];
        next.push(x);
        yield x;
      }
    }
    layer = next;
  }
}

export function countWords(alphabetSize: number, n: number): number {
  let total = 0;
  for (let i = 0; i <= n; i++) total += alphabetSize ** i;
  return total;
}

export interface WordList {
  words: Sym[][];
  truncated: boolean;
}

/** Accepted strings up to length n, shortlex. Walks the state space so it stays fast. */
export function acceptedUpTo(m: DFA | NFA, n: number, cap = 2000): WordList {
  const words: Sym[][] = [];
  if (m.start === null) return { words, truncated: false };
  const acc = new Set(m.accepting);
  let layer: { w: Sym[]; set: StateId[] }[] = [{ w: [], set: [m.start] }];
  for (let len = 0; len <= n; len++) {
    for (const { w, set } of layer) {
      if (set.some((s) => acc.has(s))) {
        words.push(w);
        if (words.length >= cap) return { words, truncated: true };
      }
    }
    if (len === n) break;
    const next: typeof layer = [];
    for (const { w, set } of layer) {
      for (const a of m.input) {
        const after = m.kind === 'nfa'
          ? stepSet(m, set, a)
          : set.map((s) => m.delta[s]?.[a]).filter((t): t is StateId => t !== undefined);
        // Dead prefixes still matter for longer words only if non-empty.
        if (after.length > 0) next.push({ w: [...w, a], set: after });
      }
    }
    layer = next;
  }
  return { words, truncated: false };
}

// ---------- Complete with a dead state ----------

function freshName(m: Machine, base: string): string {
  const used = new Set(m.states.map((s) => stateName(m, s)));
  const ids = new Set(m.states);
  if (!used.has(base) && !ids.has(base)) return base;
  for (let i = 1; ; i++) {
    const c = `${base}${i}`;
    if (!used.has(c) && !ids.has(c)) return c;
  }
}

/** Adds a non-accepting trap state d, routes all missing transitions there and loops d on every input. */
export function completeWithDeadState<M extends DFA | Mealy>(m: M): { machine: M; dead: StateId | null } {
  const missing = m.states.some((s) => m.input.some((i) => m.delta[s]?.[i] === undefined));
  const missingOut = m.kind === 'mealy'
    && m.states.some((s) => m.input.some((i) => (m as Mealy).out[s]?.[i] === undefined));
  if (!missing && !missingOut) return { machine: m, dead: null };
  const dead = freshName(m, 'd');
  const delta: Record<StateId, Record<Sym, StateId>> = {};
  for (const s of m.states) {
    delta[s] = { ...m.delta[s] };
    for (const i of m.input) if (delta[s][i] === undefined) delta[s][i] = dead;
  }
  delta[dead] = Object.fromEntries(m.input.map((i) => [i, dead]));
  const machine = { ...m, states: [...m.states, dead], delta } as M;
  if (m.kind === 'mealy') {
    const mm = m as Mealy;
    const o0 = mm.output[0];
    const out: Record<StateId, Record<Sym, Sym>> = {};
    for (const s of [...m.states, dead]) {
      out[s] = { ...mm.out[s] };
      for (const i of m.input) if (out[s][i] === undefined) out[s][i] = o0;
    }
    (machine as Mealy).out = out;
  }
  return { machine, dead };
}

// ---------- Minimise (Moore partition refinement) ----------

export interface MinimiseResult {
  dfa: DFA;
  /** Groups of original states merged into each new state. */
  groups: StateId[][];
  removedUnreachable: StateId[];
  alreadyMinimal: boolean;
}

export function minimise(m: DFA): MinimiseResult {
  if (m.start === null) throw new Error('No initial state');
  const r = reachable(m);
  const states = m.states.filter((s) => r.has(s));
  const removedUnreachable = m.states.filter((s) => !r.has(s));
  const acc = new Set(m.accepting);
  let block = new Map<StateId, number>(states.map((s) => [s, acc.has(s) ? 1 : 0]));
  let count = new Set(block.values()).size;
  for (;;) {
    const sigs = new Map<string, number>();
    const next = new Map<StateId, number>();
    for (const s of states) {
      const sig = [block.get(s), ...m.input.map((i) => block.get(m.delta[s][i]))].join('|');
      if (!sigs.has(sig)) sigs.set(sig, sigs.size);
      next.set(s, sigs.get(sig)!);
    }
    const newCount = sigs.size;
    block = next;
    if (newCount === count) break;
    count = newCount;
  }
  // Order groups by first appearance in S.
  const order: number[] = [];
  for (const s of states) if (!order.includes(block.get(s)!)) order.push(block.get(s)!);
  const groups = order.map((b) => states.filter((s) => block.get(s) === b));
  const idOf = (s: StateId) => {
    const g = groups.find((gr) => gr.includes(s))!;
    return g.length === 1 ? g[0] : `{${g.join(',')}}`;
  };
  const names: Record<StateId, string> = {};
  for (const g of groups) {
    const id = g.length === 1 ? g[0] : `{${g.join(',')}}`;
    names[id] = g.length === 1 ? stateName(m, g[0]) : `{${g.map((s) => stateName(m, s)).join(',')}}`;
  }
  const delta: DFA['delta'] = {};
  for (const g of groups) {
    const id = idOf(g[0]);
    delta[id] = Object.fromEntries(m.input.map((i) => [i, idOf(m.delta[g[0]][i])]));
  }
  const dfa: DFA = {
    kind: 'dfa',
    states: groups.map((g) => idOf(g[0])),
    input: [...m.input],
    start: idOf(m.start),
    accepting: groups.filter((g) => acc.has(g[0])).map((g) => idOf(g[0])),
    delta,
    names,
  };
  return {
    dfa, groups, removedUnreachable,
    alreadyMinimal: removedUnreachable.length === 0 && groups.every((g) => g.length === 1),
  };
}

/** View an FSM without output as a non-deterministic one (lossless). */
export function dfaToNfa(m: DFA): NFA {
  const delta: NFA['delta'] = {};
  for (const s of m.states) {
    delta[s] = {};
    for (const i of m.input) {
      const t = m.delta[s]?.[i];
      delta[s][i] = t === undefined ? [] : [t];
    }
  }
  return { kind: 'nfa', states: [...m.states], input: [...m.input], start: m.start, accepting: [...m.accepting], delta, names: m.names && { ...m.names } };
}

/** True if a non-deterministic machine happens to be deterministic and total. */
export function nfaIsDeterministic(m: NFA): boolean {
  return m.states.every((s) => m.input.every((i) => (m.delta[s]?.[i] ?? []).length === 1));
}

export function nfaAsDfa(m: NFA): DFA {
  const delta: DFA['delta'] = {};
  for (const s of m.states) {
    delta[s] = {};
    for (const i of m.input) {
      const t = m.delta[s]?.[i] ?? [];
      if (t.length > 0) delta[s][i] = t[0];
    }
  }
  return { kind: 'dfa', states: [...m.states], input: [...m.input], start: m.start, accepting: [...m.accepting], delta, names: m.names && { ...m.names } };
}
