// B. Non-deterministic FSMs (build), plus a describe-the-language problem on one.
import type { Problem } from './types';
import { nfa, s } from './dsl';

const base = { topic: 'nondeterministic', format: 'build-machine', constraints: { machineKind: 'dfa-or-nfa' } } as const;

const contains010 = nfa(`>s0 | s0,s1 s0
  s1 | - s2
  s2 | s3 -
  *s3 | s3 s3`);

export const nondeterministic: Omit<Problem, 'slug'>[] = [
  {
    ...base, id: 'B1', title: 'Guess where 11 starts', tier: 'warm-up',
    statement: 'Build a non-deterministic FSM that recognises the bit strings containing $11$. Try it non-deterministically: let the machine “guess” where the $11$ starts. (A deterministic answer is also accepted.)',
    predicate: (w) => s(w).includes('11'),
    reference: nfa(`>s0 | s0 s0,s1
      s1 | - s2
      *s2 | s2 s2`),
    hints: [
      'In a non-deterministic FSM, f(s, i) is a set, and it may be ∅.',
      'Let s₀ loop on everything, and also allow it to jump ahead on a 1 (the guess).',
      'f(s₀, 1) = {s₀, s₁}, f(s₁, 1) = {s₂}, f(s₁, 0) = ∅, and s₂ is final with loops on 0 and 1.',
    ],
    explanation: 'The machine stays in s₀ until it guesses that the current 1 begins the pattern. A wrong guess just dies (f(s₁, 0) = ∅), and x is accepted if some sequence of guesses ends in F, that is, if f(s₀, x) ∩ F ≠ ∅.',
  },
  {
    ...base, id: 'B2', title: 'Ends in 01 or 10', tier: 'standard',
    statement: 'Build a non-deterministic FSM that recognises the bit strings ending in $01$ or in $10$.',
    predicate: (w) => s(w).endsWith('01') || s(w).endsWith('10'),
    reference: nfa(`>s0 | s0,s1 s0,s3
      s1 | - s2
      *s2 | - -
      s3 | s2 -`),
    hints: [
      'Guess when the last two symbols begin.',
      'Use one branch for "0 then 1" and one for "1 then 0". They can share the final state.',
      'f(s₀, 0) = {s₀, s₁}, f(s₀, 1) = {s₀, s₃}, f(s₁, 1) = {s₂}, f(s₃, 0) = {s₂}. s₂ is final and has no outgoing transitions.',
    ],
    explanation: 'Equivalently: the last two symbols differ. Non-determinism lets the machine guess the position of the last two symbols. Because the final state has no transitions, a guess made too early can’t succeed.',
  },
  {
    ...base, id: 'B3', title: 'Third-last symbol, again', tier: 'standard',
    constraints: { machineKind: 'dfa-or-nfa', maxStates: 4 },
    statement: 'Build a non-deterministic FSM with **at most 4 states** that accepts the bit strings whose third-last symbol is $1$.',
    predicate: (w) => w.length >= 3 && w[w.length - 3] === '1',
    reference: nfa(`>s0 | s0 s0,s1
      s1 | s2 s2
      s2 | s3 s3
      *s3 | - -`),
    hints: [
      'Guess which 1 is the third-last symbol.',
      'After the guess, exactly two more symbols must follow, whatever they are.',
      's₀ loops on 0 and 1, and on 1 may also go to s₁. Then s₁ → s₂ → s₃ on any symbol, with s₃ final and no transitions out.',
    ],
    explanation: 'The deterministic version needs 8 states to remember the last three symbols. The non-deterministic one needs only 4, because it guesses the position. The subset construction turns it back into the 8-state machine.',
  },
  {
    ...base, id: 'B4', title: 'Starts with 00 or ends with 11', tier: 'exam',
    statement: 'Build a non-deterministic FSM that accepts the bit strings that start with $00$ or end with $11$ (or both).',
    predicate: (w) => s(w).startsWith('00') || s(w).endsWith('11'),
    reference: nfa(`>s0 | s1,s3 s3,s4
      s1 | s2 -
      *s2 | s2 s2
      s3 | s3 s3,s4
      s4 | - s5
      *s5 | - -`),
    hints: [
      'Build the two parts separately and let the first symbol choose between them.',
      'Branch 1 checks the first two symbols and then accepts anything. Branch 2 loops and guesses where the final 11 begins.',
      'Don’t let branch 2 loop on s₀ itself, or branch 1 could start late. Use a separate looping state for branch 2. Watch out for the string 11, which ends branch 2 straight from s₀.',
    ],
    explanation: 'A union of two languages is easy non-deterministically: start both machines at once. The care needed is with the start state. Branch 1 must only begin at the very first symbol, so s₀ must not loop.',
  },
  {
    ...base, id: 'B5', title: 'Fourth-last symbol is 1', tier: 'challenge',
    constraints: { machineKind: 'dfa-or-nfa', maxStates: 5 },
    statement: 'Build a non-deterministic FSM with **at most 5 states** that accepts the bit strings whose fourth-last symbol is $1$. Then convert it with the subset construction and compare the size.',
    predicate: (w) => w.length >= 4 && w[w.length - 4] === '1',
    reference: nfa(`>s0 | s0 s0,s1
      s1 | s2 s2
      s2 | s3 s3
      s3 | s4 s4
      *s4 | - -`),
    hints: [
      'Same pattern as the third-last problem, one step longer.',
      'Guess the 1, then require exactly three more symbols.',
      's₀ loops on both and also goes to s₁ on 1. Then a chain s₁ → s₂ → s₃ → s₄ on any symbol, with only s₄ final.',
    ],
    explanation: 'The non-deterministic machine has 5 states, but the minimal FSM without output for this language needs 2⁴ = 16 states, one for each possible "last four symbols". The subset construction can blow up exponentially, and here it really does.',
  },
  {
    id: 'E5', title: 'What does this non-deterministic FSM accept?', tier: 'exam', topic: 'nondeterministic', format: 'describe-language',
    statement: 'Here is a non-deterministic FSM M with $I = \\{0, 1\\}$. Which description matches $L(M)$? Then give one string in $L(M)$ and one string not in $L(M)$.',
    given: contains010,
    predicate: (w) => s(w).includes('010'),
    reference: {
      kind: 'describe',
      correct: 0,
      options: [
        { text: 'Strings containing $010$', predicate: (w) => s(w).includes('010') },
        { text: 'Strings ending in $010$', predicate: (w) => s(w).endsWith('010') },
        { text: 'Strings starting with $010$', predicate: (w) => s(w).startsWith('010') },
        { text: 'Strings containing $01$ or $10$', predicate: (w) => s(w).includes('01') || s(w).includes('10') },
      ],
    },
    hints: [
      'Look at the final state: what happens once the machine reaches it?',
      'From s₀ the machine can wait as long as it likes before moving on. What path leads to F?',
      'The path s₀ → s₁ → s₂ → s₃ reads 0, 1, 0, and s₃ loops on everything.',
    ],
    explanation: 'The machine waits in s₀, guesses the start of 010, reads it along s₁, s₂, s₃, and then stays in the final state s₃ forever. So it accepts exactly the strings with 010 somewhere inside.',
  },
];
