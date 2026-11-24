// F. Classify the grammar (answer: the largest type k).
import type { Problem } from './types';
import { grammar } from '../engine/grammar';

const base = { topic: 'grammar-types', format: 'classify-grammar' } as const;
const ASK = 'What is the largest $k$ for which $G$ is of type $k$? Use the course’s table of types.';

export const grammarTypes: Omit<Problem, 'slug'>[] = [
  {
    ...base, id: 'F1', title: 'A right-linear grammar', tier: 'warm-up',
    statement: `Let $G$ have $P = \\{S \\to 0A,\\ S \\to 1S,\\ S \\to 0,\\ A \\to 1A,\\ A \\to 0S,\\ A \\to 1\\}$. ${ASK}`,
    given: grammar('S -> 0A | 1S | 0\nA -> 1A | 0S | 1'),
    reference: { kind: 'classify', type: 3 },
    hints: [
      'Start with type 3, since it has the strictest rules.',
      'Type 3 allows A → aB and A → a (and S → λ).',
      'Check each production: every right-hand side is a terminal, or a terminal followed by one non-terminal.',
    ],
    explanation: 'Every production has a single non-terminal on the left and aB or a on the right, so G is type 3 (regular). It is also type 2, 1 and 0 here, but the question asks for the largest type.',
  },
  {
    ...base, id: 'F2', title: 'Nested zeros and ones', tier: 'standard',
    statement: `Let $G$ have $P = \\{S \\to 0S1,\\ S \\to 01\\}$. ${ASK}`,
    given: grammar('S -> 0S1 | 01'),
    reference: { kind: 'classify', type: 2 },
    hints: [
      'Is S → 0S1 of the form A → aB or A → a?',
      'The right-hand side 0S1 has a terminal after the non-terminal.',
      'Every left-hand side is a single non-terminal, which is the type 2 condition.',
    ],
    explanation: 'S → 0S1 isn’t of the form A → aB or A → a, so G isn’t type 3. Every left side is a single non-terminal, so G is type 2 (context-free).',
  },
  {
    ...base, id: 'F3', title: 'Left-linear', tier: 'standard',
    statement: `Let $G$ have $P = \\{S \\to S0,\\ S \\to 1\\}$. ${ASK}`,
    given: grammar('S -> S0 | 1'),
    reference: { kind: 'classify', type: 2 },
    hints: [
      'Compare S → S0 with the forms A → aB and A → a.',
      'Here the non-terminal comes before the terminal.',
      'In this course, left-linear rules like A → Ba are not type 3.',
    ],
    explanation: 'S → S0 is left-linear, which the course’s type 3 definition does not allow, so G is type 2. But L(G) = 10⋆ (a 1 followed by any number of 0s) is still regular: it has the type 3 grammar S → 1A | 1, A → 0A | 0. The type of a grammar is not the same as the type of its language.',
  },
  {
    ...base, id: 'F4', title: 'Blocks sorted in context', tier: 'exam',
    statement: 'Let $G$ have the productions below, with $T = \\{a, b, c\\}$ and $N = \\{S, B, C, H, K\\}$. What is the largest $k$ for which $G$ is of type $k$?\n\n$$S \\to aSBC \\mid aBC,\\quad CB \\to HB,\\quad HB \\to HK,\\quad HK \\to BK,\\quad BK \\to BC$$\n\n$$aB \\to ab,\\quad bB \\to bb,\\quad bC \\to bc,\\quad cC \\to cc$$',
    given: grammar('S -> aSBC | aBC\nCB -> HB\nHB -> HK\nHK -> BK\nBK -> BC\naB -> ab\nbB -> bb\nbC -> bc\ncC -> cc'),
    reference: { kind: 'classify', type: 1 },
    hints: [
      'Some left-hand sides have two symbols, so G isn’t type 2.',
      'For type 1, check each production has the form lAr → lwr with w ≠ λ.',
      'For example CB → HB has A = C, r = B, w = H. Find l, A, r and w for each production.',
    ],
    explanation: 'Each production rewrites a single non-terminal in context. For example aB → ab has l = a, A = B, w = b, and HK → BK has A = H, r = K, w = B. There is no λ, so G is type 1 (context-sensitive). It generates {aⁿbⁿcⁿ | n ≥ 1}.',
  },
  {
    ...base, id: 'F5', title: 'A shrinking rule', tier: 'exam',
    statement: `Let $G$ have $P = \\{S \\to AB,\\ S \\to 0S,\\ AB \\to B,\\ A \\to 0A,\\ A \\to 0,\\ B \\to 1\\}$. ${ASK}`,
    given: grammar('S -> AB | 0S\nAB -> B\nA -> 0A | 0\nB -> 1'),
    reference: { kind: 'classify', type: 0 },
    hints: [
      'Which production has more than one symbol on its left?',
      'Can AB → B be written as lAr → lwr with w ≠ λ?',
      'AB → B makes the string shorter, but lAr → lwr never does.',
    ],
    explanation: 'AB → B has two symbols on the left, so G isn’t type 2 or 3. It also isn’t type 1, because lAr → lwr with w ≠ λ can never shrink a string, while AB → B does. So G is only type 0.',
  },
  {
    ...base, id: 'F6', title: 'The λ trap', tier: 'challenge',
    statement: `Let $G$ have $P = \\{S \\to 0S1,\\ S \\to \\lambda\\}$. ${ASK}`,
    given: grammar('S -> 0S1 | λ'),
    reference: { kind: 'classify', type: 2 },
    hints: [
      'Type 3 fails for the same reason as S → 0S1 | 01.',
      'Type 1 allows S → λ only if S is on no right-hand side.',
      'S is on the right-hand side of S → 0S1. What does that mean for type 1?',
    ],
    explanation: 'G is type 2, because every left side is a single non-terminal. It is not type 1, because S → λ is only allowed when S appears on no right-hand side, and here S appears in S → 0S1. With the λ rules the types aren’t nested, so “type 2 but not type 1” is possible.',
  },
  {
    ...base, id: 'F7', title: 'Regular but not type 1', tier: 'challenge',
    statement: `Let $G$ have $P = \\{S \\to 0S,\\ S \\to \\lambda\\}$. ${ASK}`,
    given: grammar('S -> 0S | λ'),
    reference: { kind: 'classify', type: 3 },
    hints: [
      'Check the type 3 forms, including the special rule for S → λ.',
      'Type 3 allows S → λ with no further condition.',
      'Is G type 1? S is on the right-hand side of S → 0S.',
    ],
    explanation: 'Both productions fit the type 3 forms (A → aB, and S → λ), so G is type 3. Yet G is not type 1, because S → λ needs S to be on no right-hand side for type 1. So the largest type is 3, even though the type 1 check fails.',
  },
];
