// Core engine types. Field names such as `delta` are internal and never shown in the UI.

export type Sym = string;
export type StateId = string;

interface MachineBase {
  states: StateId[];
  input: Sym[];
  start: StateId | null;
  /** Display names; a state without an entry is shown by its id. */
  names?: Record<StateId, string>;
}

/** FSM without output (deterministic). */
export interface DFA extends MachineBase {
  kind: 'dfa';
  accepting: StateId[];
  delta: Record<StateId, Record<Sym, StateId>>;
}

/** Non-deterministic FSM without output. f : S × I → 𝒫(S). */
export interface NFA extends MachineBase {
  kind: 'nfa';
  accepting: StateId[];
  delta: Record<StateId, Record<Sym, StateId[]>>;
}

/** FSM with output. */
export interface Mealy extends MachineBase {
  kind: 'mealy';
  output: Sym[];
  delta: Record<StateId, Record<Sym, StateId>>;
  out: Record<StateId, Record<Sym, Sym>>;
}

export type Machine = DFA | NFA | Mealy;
export type MachineKind = Machine['kind'];

/** rhs [] means λ. */
export interface Production {
  lhs: Sym[];
  rhs: Sym[];
}

export interface Grammar {
  V: Sym[];
  T: Sym[];
  S: Sym;
  P: Production[];
}

export const LIMITS = {
  maxStates: 40,
  maxProductions: 60,
  maxWordLength: 12,
  searchNodeCap: 200_000,
} as const;
