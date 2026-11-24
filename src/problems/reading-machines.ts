// D. Reading machines (trace), plus a describe-the-language problem on an FSM without output.
import type { Problem } from './types';
import { dfa, mealy, nfa, s } from './dsl';

export const GIVEN_D1 = dfa(`>s0 | s1 s2
  s1 | s3 s0
  *s2 | s2 s3
  *s3 | s0 s1`);

export const GIVEN_D2 = mealy(`>s0 | s1/1 s0/0
  s1 | s2/0 s0/1
  s2 | s2/1 s1/0`);

export const GIVEN_D3 = nfa(`>s0 | s0,s1 s2
  s1 | - s1,s2
  *s2 | s0 -`);

export const GIVEN_D4 = mealy(`>s0 | s1/0 s2/1
  s1 | s3/1 s0/0
  s2 | s0/0 s3/1
  s3 | s2/1 s1/0`);

const ends00 = dfa(`>s0 | s1 s0
  s1 | s2 s0
  *s2 | s2 s0`);

export const readingMachines: Omit<Problem, 'slug'>[] = [
  {
    id: 'D1', title: 'Follow the arrows', tier: 'warm-up', topic: 'reading-machines', format: 'trace',
    statement: 'Here is an FSM without output $M = (S, I, f, s_0, F)$. Find $f(s_0, 1011)$, and decide whether $1011$ is recognised by $M$.',
    given: GIVEN_D1,
    reference: {
      kind: 'trace',
      fields: [
        { id: 'final', label: '$f(s_0, 1011) =$', type: 'state', expected: 's1' },
        { id: 'acc', label: 'Is $1011 \\in L(M)$?', type: 'yesno', expected: false },
      ],
    },
    hints: [
      'Read the string left to right, one symbol at a time, starting in s₀.',
      'After the first symbol you are in f(s₀, 1) = s₂.',
      'The states visited are s₀, s₂, s₂, s₃, s₁. Is s₁ in F?',
    ],
    explanation: 'Following the extended transition function: f(s₀, 1) = s₂, f(s₂, 0) = s₂, f(s₂, 1) = s₃, f(s₃, 1) = s₁. So f(s₀, 1011) = s₁ ∉ F, and 1011 is not recognised.',
  },
  {
    id: 'D2', title: 'Read off the outputs', tier: 'standard', topic: 'reading-machines', format: 'trace',
    statement: 'Here is an FSM with output $M = (S, I, O, f, g, s_0)$. Give the output string for each input.',
    given: GIVEN_D2,
    reference: {
      kind: 'trace',
      fields: [
        { id: 'a', label: 'Output for $01110$', type: 'word', expected: '11001' },
        { id: 'b', label: 'Output for $10001$', type: 'word', expected: '01010' },
        { id: 'c', label: 'Output for $010101$', type: 'word', expected: '111111' },
      ],
    },
    hints: [
      'Each edge label i, o means: on input i, output o and follow the edge.',
      'The output string has the same length as the input.',
      'For 01110 the states visited are s₀, s₁, s₀, s₀, s₀, s₁.',
    ],
    explanation: 'For each input, follow the edges from s₀ and write down the output on each edge taken. For example, 01110 takes the edges with labels 0, 1 · 1, 1 · 1, 0 · 1, 0 · 0, 1, giving 11001.',
  },
  {
    id: 'D3', title: 'Sets of states', tier: 'standard', topic: 'reading-machines', format: 'trace',
    statement: 'Here is a non-deterministic FSM $M$. Give the sets $f(s_0, 0)$, $f(s_0, 01)$ and $f(s_0, 011)$, and decide whether $011 \\in L(M)$.',
    given: GIVEN_D3,
    reference: {
      kind: 'trace',
      fields: [
        { id: 'a', label: '$f(s_0, 0) =$', type: 'set', expected: ['s0', 's1'] },
        { id: 'b', label: '$f(s_0, 01) =$', type: 'set', expected: ['s1', 's2'] },
        { id: 'c', label: '$f(s_0, 011) =$', type: 'set', expected: ['s1', 's2'] },
        { id: 'acc', label: 'Is $011 \\in L(M)$?', type: 'yesno', expected: true },
      ],
    },
    hints: [
      'For a non-deterministic FSM, f(s₀, x) is a set: all states reachable by reading x.',
      'To get f(s₀, xa), take the union of f(s, a) over all s ∈ f(s₀, x).',
      'f(s₀, 01) = f(s₀, 1) ∪ f(s₁, 1) = {s₂} ∪ {s₁, s₂}. A string is accepted iff the final set meets F.',
    ],
    explanation: 'f(s₀, 0) = {s₀, s₁}. Then f(s₀, 01) = f(s₀, 1) ∪ f(s₁, 1) = {s₁, s₂}, and f(s₀, 011) = f(s₁, 1) ∪ f(s₂, 1) = {s₁, s₂} ∪ ∅ = {s₁, s₂}. This set contains the final state s₂, so 011 ∈ L(M).',
  },
  {
    id: 'D4', title: 'From the table alone', tier: 'exam', topic: 'reading-machines', format: 'trace',
    statement: 'An FSM with output is given only by its state table below (columns $f$ and $g$). Find the output for the input $1101001$.',
    given: GIVEN_D4,
    givenAsTable: true,
    reference: {
      kind: 'trace',
      fields: [{ id: 'out', label: 'Output for $1101001$', type: 'word', expected: '1111101' }],
    },
    hints: [
      'Row s, column f: i gives the next state; column g: i gives the output.',
      'Keep a two-column scratch list: current state and output so far.',
      'The states visited are s₀, s₂, s₃, s₂, s₃, s₂, s₀, s₂.',
    ],
    explanation: 'Reading the table row by row: from s₀ on 1 output 1 and go to s₂, from s₂ on 1 output 1 and go to s₃, and so on. The outputs are 1, 1, 1, 1, 1, 0, 1.',
  },
  {
    id: 'E2', title: 'What does this FSM recognise?', tier: 'standard', topic: 'reading-machines', format: 'describe-language',
    statement: 'Here is an FSM without output $M$ with $I = \\{0, 1\\}$. Which description matches $L(M)$? Then give one string in $L(M)$ and one string not in $L(M)$.',
    given: ends00,
    predicate: (w) => s(w).endsWith('00'),
    reference: {
      kind: 'describe',
      correct: 1,
      options: [
        { text: 'Strings containing $00$', predicate: (w) => s(w).includes('00') },
        { text: 'Strings ending in $00$', predicate: (w) => s(w).endsWith('00') },
        { text: 'Strings ending in $0$', predicate: (w) => s(w).endsWith('0') },
        { text: 'Strings with an even number of $0$s', predicate: (w) => w.filter((c) => c === '0').length % 2 === 0 },
      ],
    },
    hints: [
      'Where does every 1 lead?',
      'Every 1 goes back to s₀, so a 1 wipes out all progress.',
      'To finish in s₂, the last two symbols must both be 0.',
    ],
    explanation: 'Every 1 returns to s₀, and two 0s in a row reach the final state s₂, where further 0s keep it. So the machine is in F exactly when the last two symbols are 00.',
  },
];
