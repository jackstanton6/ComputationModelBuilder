// H. Conversions and tables.
import type { Problem } from './types';
import { dfa, mealy, nfa } from './dsl';
import { grammar } from '../engine/grammar';
import { earleyRecognise } from '../engine/earley';
import { accepts } from '../engine/fsm';
import { dfaToGrammar, kleeneGrammarToNfa } from '../engine/conversions';

export const GIVEN_H1 = dfa(`>s0 | s1 s3
  s1 | s1 s2
  *s2 | s3 s0
  s3 | s2 s3`);

export const GIVEN_H2 = mealy(`>s0 | s1/1 s2/0
  s1 | s0/0 s1/1
  s2 | s2/1 s0/1`);

export const GIVEN_H3 = dfa(`>s0 | s2 s1
  *s1 | s1 s3
  s2 | s0 s3
  *s3 | s2 s1`);

export const GIVEN_H4 = grammar('S -> 0S | 1A | 1\nA -> 0A | 1S | 0');

export const GIVEN_H5 = nfa(`>s0 | s0,s1 s0
  s1 | s2 s2
  s2 | - s3
  *s3 | s3 -`);

export const GIVEN_H6 = dfa(`>s0 | s1 s0
  s1 | s1 s2
  *s2 | s2 s2`);

export const conversions: Omit<Problem, 'slug'>[] = [
  {
    id: 'H1', title: 'Diagram to state table', tier: 'warm-up', topic: 'conversions', format: 'fill-table',
    statement: 'Fill in the state table of this FSM without output: for each state $s$ and input $i$, choose $f(s, i)$.',
    given: GIVEN_H1,
    reference: { kind: 'fill-table', mode: 'table' },
    hints: [
      'Each row is a state, and each column under f is an input.',
      'The cell in row s, column i is the state at the end of the arrow from s labelled i.',
      'Row s₀: f(s₀, 0) = s₁ and f(s₀, 1) = s₃.',
    ],
    explanation: 'The state table is just the function f written out in full. Every cell is filled because f is total for an FSM without output.',
  },
  {
    id: 'H2', title: 'Diagram to f and g', tier: 'standard', topic: 'conversions', format: 'fill-table',
    statement: 'Fill in the state table of this FSM with output: both $f$ (next state) and $g$ (output) for each state and input.',
    given: GIVEN_H2,
    reference: { kind: 'fill-table', mode: 'table' },
    hints: [
      'An edge label i, o means f(s, i) is the end of the edge and g(s, i) = o.',
      'The table has two groups of columns: f, then g, with one column per input in each.',
      'Row s₀: f(s₀, 0) = s₁, f(s₀, 1) = s₂, g(s₀, 0) = 1, g(s₀, 1) = 0.',
    ],
    explanation: 'For an FSM with output, each edge carries two pieces of information: where it goes (f) and what it outputs (g). The table separates them into the f and g column groups.',
  },
  {
    id: 'H3', title: 'State table to diagram', tier: 'standard', topic: 'conversions', format: 'build-machine',
    statement: 'Here is the state table of an FSM without output. Draw its state diagram: same states, same transitions, same initial and final states.',
    given: GIVEN_H3,
    givenAsTable: true,
    constraints: { machineKind: 'dfa', exactStates: 4 },
    predicate: (w) => accepts(GIVEN_H3, w),
    reference: GIVEN_H3,
    hints: [
      'Draw one circle per row, and mark the initial state with the Start arrow.',
      'Final states (⋆) get double circles.',
      'For each cell, draw an arrow from the row’s state to the cell’s state, labelled with the column’s input. Combine arrows between the same pair of states into one edge.',
    ],
    explanation: 'The diagram and the table carry the same information. The check compares your machine with the table’s machine by equivalence and also requires the same number of states.',
  },
  {
    id: 'H4', title: 'Kleene’s construction', tier: 'standard', topic: 'conversions', format: 'build-machine',
    statement: 'Use Kleene’s construction to build a non-deterministic FSM $M$ with $L(M) = L(G)$, where $G$ has $P = \\{S \\to 0S,\\ S \\to 1A,\\ S \\to 1,\\ A \\to 0A,\\ A \\to 1S,\\ A \\to 0\\}$.',
    given: GIVEN_H4,
    constraints: { machineKind: 'dfa-or-nfa' },
    predicate: (w) => earleyRecognise(GIVEN_H4, w),
    reference: kleeneGrammarToNfa(GIVEN_H4),
    hints: [
      'There is one state per non-terminal, plus one extra final state.',
      'A production A → aB becomes an edge from s_A to s_B labelled a.',
      'The construction: states s_S (initial), s_A and a final state s_F. A → a gives an edge s_A → s_F on a, A → aB gives s_A → s_B on a, and s_S is final only if S → λ ∈ P.',
    ],
    explanation: 'Kleene’s construction reads the grammar as a machine: each non-terminal is a state that remembers “what is still to be generated”, and a production that ends the word goes to the extra final state s_F. Here S → 1 and A → 0 both lead to s_F.',
  },
  {
    id: 'H5', title: 'Subset construction by hand', tier: 'exam', topic: 'conversions', format: 'fill-table',
    statement: 'Apply the subset construction to this non-deterministic FSM. Fill in one row for each **reachable** subset (starting from $\\{s_0\\}$): the subset reached on each input, and whether the subset is final. Rows can be in any order.',
    given: GIVEN_H5,
    reference: { kind: 'fill-table', mode: 'subset' },
    hints: [
      'Start with the row for {s₀}. Every new subset that appears in a cell needs its own row.',
      'On input i, a subset V goes to the union of f(s, i) over all s ∈ V.',
      'A subset is final iff it contains a final state of M. ∅ counts as a subset if it is reached.',
    ],
    explanation: 'The construction explores only the subsets reachable from {s₀}, which is usually far fewer than all 2ⁿ. Each row is computed from the union rule, and a subset is final when it meets F.',
  },
  {
    id: 'H6', title: 'FSM to regular grammar', tier: 'exam', topic: 'conversions', format: 'build-grammar',
    statement: 'Write a **regular (type 3)** grammar $G$ with $T = \\{0, 1\\}$ and $L(G) = L(M)$ for the FSM without output $M$ shown.',
    given: GIVEN_H6,
    constraints: { terminals: ['0', '1'], requiredGrammarType: 3 },
    predicate: (w) => accepts(GIVEN_H6, w),
    reference: dfaToGrammar(GIVEN_H6),
    hints: [
      'Use one non-terminal per state: S for s₀, then A, B, … for the others.',
      'For each transition f(s_X, a) = s_Y, add X → aY. If s_Y is final, also add X → a.',
      'If s₀ were final you would add S → λ. Here it isn’t.',
    ],
    explanation: 'Each non-terminal stands for a state. X → aY says “from X, read a and continue from Y”, and X → a finishes the word when the transition lands in a final state. This is the converse of Kleene’s construction.',
  },
];
