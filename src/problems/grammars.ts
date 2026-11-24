// E (grammar part) and G: describe the language of a grammar, and build grammars.
import type { Problem } from './types';
import { grammar } from '../engine/grammar';
import { count, s } from './dsl';
import type { Sym } from '../engine/types';

const balanced = (w: Sym[]) => {
  let d = 0;
  for (const c of w) {
    d += c === '0' ? 1 : -1;
    if (d < 0) return false;
  }
  return d === 0;
};

const describe = { topic: 'grammars', format: 'describe-language' } as const;
const build = { topic: 'grammars', format: 'build-grammar' } as const;

export const ABC_GRAMMAR = 'S -> 0SBC | 0BC\nCB -> HB\nHB -> HK\nHK -> BK\nBK -> BC\n0B -> 01\n1B -> 11\n1C -> 12\n2C -> 22';

export const grammars: Omit<Problem, 'slug'>[] = [
  {
    ...describe, id: 'E1', title: 'Zeros then a 1', tier: 'warm-up',
    statement: 'Let $G = (V, T, S, P)$ with $V = \\{0, 1, S\\}$, $T = \\{0, 1\\}$ and $P = \\{S \\to 0S,\\ S \\to 1\\}$. Which set is $L(G)$? Then give one string in $L(G)$ and one string not in $L(G)$.',
    given: grammar('S -> 0S | 1'),
    predicate: (w) => /^0*1$/.test(s(w)),
    reference: {
      kind: 'describe', correct: 0,
      options: [
        { text: '$\\{0^n1 \\mid n \\geq 0\\}$', predicate: (w) => /^0*1$/.test(s(w)) },
        { text: '$\\{0^n1^n \\mid n \\geq 1\\}$', predicate: (w) => /^0+1+$/.test(s(w)) && count(w, '0') === count(w, '1') },
        { text: '$\\{10^n \\mid n \\geq 0\\}$', predicate: (w) => /^10*$/.test(s(w)) },
        { text: 'All bit strings ending in $1$', predicate: (w) => s(w).endsWith('1') },
      ],
    },
    hints: [
      'Try a few derivations from S.',
      'S ⇒ 0S ⇒ 00S ⇒ 001. Where can the 1 appear?',
      'Every derivation applies S → 0S some number of times n ≥ 0, then S → 1 once.',
    ],
    explanation: 'Each use of S → 0S adds a 0 on the left of S, and the derivation can only finish with S → 1. So L(G) = {0ⁿ1 | n ≥ 0}: any number of 0s, including none, followed by exactly one 1.',
  },
  {
    ...describe, id: 'E3', title: 'Two kinds of runs', tier: 'standard',
    statement: 'Let $G = (V, T, S, P)$ with $V = \\{0, 1, 2, S, A, B\\}$, $T = \\{0, 1, 2\\}$ and $P = \\{S \\to 0A,\\ S \\to 1B,\\ A \\to 0A,\\ A \\to 2,\\ B \\to 1B,\\ B \\to 2\\}$. Which set is $L(G)$? Then give one string in $L(G)$ and one string not in $L(G)$.',
    given: grammar('S -> 0A | 1B\nA -> 0A | 2\nB -> 1B | 2'),
    predicate: (w) => /^(0+|1+)2$/.test(s(w)),
    reference: {
      kind: 'describe', correct: 2,
      options: [
        { text: '$\\{0^n2 \\mid n \\geq 0\\} \\cup \\{1^n2 \\mid n \\geq 0\\}$', predicate: (w) => /^(0*|1*)2$/.test(s(w)) },
        { text: '$\\{0^n1^n2 \\mid n \\geq 1\\}$', predicate: (w) => /^0+1+2$/.test(s(w)) && count(w, '0') === count(w, '1') },
        { text: '$\\{0^n2 \\mid n \\geq 1\\} \\cup \\{1^n2 \\mid n \\geq 1\\}$', predicate: (w) => /^(0+|1+)2$/.test(s(w)) },
        { text: 'Non-empty strings of $0$s and $1$s, followed by $2$', predicate: (w) => /^[01]+2$/.test(s(w)) },
      ],
    },
    hints: [
      'The first production chooses a branch: 0A or 1B.',
      'Once in A, can a 1 ever appear?',
      'A generates 0ⁿ2 for n ≥ 0, so S → 0A gives 0ⁿ2 with n ≥ 1. Is 2 on its own derivable?',
    ],
    explanation: 'S must first produce 0A or 1B. A then adds more 0s before finishing with 2, and B does the same with 1s. So every word is a non-empty run of one symbol followed by 2. The string 2 alone is not derivable, because S has no production S → 2.',
  },
  {
    ...describe, id: 'E4', title: 'Nested pairs', tier: 'exam',
    statement: 'Let $G$ have productions $P = \\{S \\to 0S1,\\ S \\to \\lambda\\}$, with $T = \\{0, 1\\}$. Which set is $L(G)$? Then give one string in $L(G)$ and one string not in $L(G)$.',
    given: grammar('S -> 0S1 | λ'),
    predicate: (w) => /^0*1*$/.test(s(w)) && count(w, '0') === count(w, '1'),
    reference: {
      kind: 'describe', correct: 1,
      options: [
        { text: '$\\{0^n1^n \\mid n \\geq 1\\}$', predicate: (w) => w.length > 0 && /^0*1*$/.test(s(w)) && count(w, '0') === count(w, '1') },
        { text: '$\\{0^n1^n \\mid n \\geq 0\\}$', predicate: (w) => /^0*1*$/.test(s(w)) && count(w, '0') === count(w, '1') },
        { text: '$\\{0^m1^n \\mid m, n \\geq 0\\}$', predicate: (w) => /^0*1*$/.test(s(w)) },
        { text: 'Strings with equally many $0$s and $1$s', predicate: (w) => count(w, '0') === count(w, '1') },
      ],
    },
    hints: [
      'What is the shortest word you can derive?',
      'S ⇒ λ in one step, so λ ∈ L(G).',
      'Each use of S → 0S1 adds one 0 on the left and one 1 on the right.',
    ],
    explanation: 'Applying S → 0S1 n times and then S → λ gives 0ⁿ1ⁿ, and that is the only way to derive a word. Since n = 0 is allowed, λ ∈ L(G), so L(G) = {0ⁿ1ⁿ | n ≥ 0}. Note that 0101 has equally many 0s and 1s but is not in L(G).',
  },
  {
    ...describe, id: 'E6', title: 'Brackets in disguise', tier: 'challenge',
    statement: 'Let $G$ have productions $P = \\{S \\to SS,\\ S \\to 0S1,\\ S \\to \\lambda\\}$, with $T = \\{0, 1\\}$. Read $0$ as “(” and $1$ as “)”. Which description matches $L(G)$? Then give one string in $L(G)$ and one string not in $L(G)$.',
    given: grammar('S -> SS | 0S1 | λ'),
    predicate: balanced,
    reference: {
      kind: 'describe', correct: 3,
      options: [
        { text: 'Strings with equally many $0$s and $1$s', predicate: (w) => count(w, '0') === count(w, '1') },
        { text: '$\\{0^n1^n \\mid n \\geq 0\\}$', predicate: (w) => /^0*1*$/.test(s(w)) && count(w, '0') === count(w, '1') },
        { text: 'Strings in which every prefix has at least as many $0$s as $1$s', predicate: (w) => w.every((_, i) => count(w.slice(0, i + 1), '0') >= count(w.slice(0, i + 1), '1')) },
        { text: 'Balanced bracket strings: equally many $0$s and $1$s, and every prefix has at least as many $0$s as $1$s', predicate: balanced },
      ],
    },
    hints: [
      'S → 0S1 wraps a word in a pair of brackets, and S → SS puts two words side by side.',
      'Is 10 derivable? Is 0110?',
      '10 has equally many 0s and 1s, but its first prefix has more 1s, so it isn’t balanced.',
    ],
    explanation: 'This is the classic grammar of balanced brackets: λ, nesting (S → 0S1) and concatenation (S → SS). A string of brackets is balanced exactly when it has equally many of each and no prefix closes more than it opens.',
  },

  // ---------- G. Build a grammar ----------
  {
    ...build, id: 'G1', title: 'Grammar for zeros then a 1', tier: 'warm-up',
    statement: 'Write a grammar $G$ with $T = \\{0, 1\\}$ and $L(G) = \\{0^n1 \\mid n \\geq 0\\}$.',
    constraints: { terminals: ['0', '1'] },
    predicate: (w) => /^0*1$/.test(s(w)),
    reference: grammar('S -> 0S | 1'),
    hints: [
      'Generate the 0s one at a time, then finish.',
      'A production of the form S → 0S adds one 0 and keeps S around.',
      'P = {S → 0S, S → 1}.',
    ],
    explanation: 'S → 0S adds a 0 and keeps going, and S → 1 ends the word. This grammar is regular (type 3).',
  },
  {
    ...build, id: 'G2', title: 'All bit strings', tier: 'warm-up',
    statement: 'Write a **regular (type 3)** grammar $G$ with $T = \\{0, 1\\}$ and $L(G) = \\{0, 1\\}^\\star$, the set of all bit strings, including $\\lambda$.',
    constraints: { terminals: ['0', '1'], requiredGrammarType: 3 },
    predicate: () => true,
    reference: grammar('S -> 0S | 1S | 0 | 1 | λ'),
    hints: [
      'Type 3 productions have the form A → aB, A → a or S → λ.',
      'S → 0S and S → 1S let you build any string, but you need a way to stop.',
      'P = {S → 0S, S → 1S, S → 0, S → 1, S → λ}.',
    ],
    explanation: 'S → 0S and S → 1S build any string symbol by symbol; S → 0 and S → 1 finish it; S → λ gives the empty string. Under the course’s type 3 rule, S → λ is allowed even though S appears on a right-hand side (that only matters for type 1). In fact S → 0S | 1S | λ alone also works.',
  },
  {
    ...build, id: 'G3', title: 'Matched zeros and ones', tier: 'standard',
    statement: 'Write a grammar $G$ with $T = \\{0, 1\\}$ and $L(G) = \\{0^n1^n \\mid n \\geq 1\\}$.',
    constraints: { terminals: ['0', '1'] },
    predicate: (w) => w.length > 0 && /^0*1*$/.test(s(w)) && count(w, '0') === count(w, '1'),
    reference: grammar('S -> 0S1 | 01'),
    hints: [
      'Build the word from the outside in.',
      'Each step should add one 0 and one 1 at the same time.',
      'P = {S → 0S1, S → 01}.',
    ],
    explanation: 'S → 0S1 adds a matching 0 and 1 around the middle, and S → 01 finishes with the innermost pair, so n ≥ 1. No FSM can recognise this language, but a context-free grammar can.',
  },
  {
    ...build, id: 'G4', title: 'Regular grammar for ending in 01', tier: 'standard',
    statement: 'Write a **regular (type 3)** grammar $G$ with $T = \\{0, 1\\}$ whose language is the set of bit strings ending in $01$.',
    constraints: { terminals: ['0', '1'], requiredGrammarType: 3 },
    predicate: (w) => s(w).endsWith('01'),
    reference: grammar('S -> 0S | 1S | 0A\nA -> 1'),
    hints: [
      'Think of an FSM for the language and turn each transition into a production.',
      'S can produce any prefix, then guess that the final 01 has started.',
      'P = {S → 0S, S → 1S, S → 0A, A → 1}.',
    ],
    explanation: 'S → 0S | 1S generates any prefix. S → 0A guesses that the last two symbols start here, and A → 1 ends the word. This is the grammar version of the non-deterministic FSM that guesses where 01 begins (Kleene’s construction in reverse).',
  },
  {
    ...build, id: 'G5', title: 'Palindromes', tier: 'standard',
    statement: 'Write a grammar $G$ with $T = \\{0, 1\\}$ whose language is the set of palindromes over $\\{0, 1\\}$ (strings equal to their reverse), including $\\lambda$.',
    constraints: { terminals: ['0', '1'] },
    predicate: (w) => s(w) === [...w].reverse().join(''),
    reference: grammar('S -> 0S0 | 1S1 | 0 | 1 | λ'),
    hints: [
      'A palindrome is the same symbol at both ends, wrapped around a smaller palindrome.',
      'The middle can be empty or a single symbol.',
      'P = {S → 0S0, S → 1S1, S → 0, S → 1, S → λ}.',
    ],
    explanation: 'Each step adds the same symbol at both ends. The derivation stops with λ (even length) or a single 0 or 1 (odd length).',
  },
  {
    ...build, id: 'G6', title: 'a’s and b’s balanced by c’s', tier: 'standard',
    statement: 'Write a **context-free (type 2)** grammar $G$ with $T = \\{a, b, c\\}$ and $L(G) = \\{a^n b^m c^{n+m} \\mid n, m \\geq 0\\}$.',
    constraints: { terminals: ['a', 'b', 'c'], requiredGrammarType: 2 },
    predicate: (w) => {
      const m = /^(a*)(b*)(c*)$/.exec(s(w));
      return !!m && m[3].length === m[1].length + m[2].length;
    },
    reference: grammar('S -> aSc | B\nB -> bBc | λ'),
    hints: [
      'Each a and each b needs its own c. Where do those c’s go?',
      'Match a’s with the outermost c’s first, then switch to matching b’s with the inner c’s.',
      'P = {S → aSc, S → B, B → bBc, B → λ}.',
    ],
    explanation: 'Read c^{n+m} as c^m c^n: the outer n c’s match the a’s (S → aSc), and the inner m c’s match the b’s (B → bBc). The production S → B switches from the first phase to the second.',
  },
  {
    ...build, id: 'G7', title: 'No double letters', tier: 'exam',
    statement: 'Write a **regular (type 3)** grammar $G$ with $T = \\{a, b\\}$ whose language is the set of **non-empty** strings over $\\{a, b\\}$ with no two equal letters next to each other (such as $abab$ or $b$).',
    constraints: { terminals: ['a', 'b'], requiredGrammarType: 3 },
    predicate: (w) => w.length > 0 && w.every((c, i) => i === 0 || c !== w[i - 1]),
    reference: grammar('S -> aA | bB | a | b\nA -> bB | b\nB -> aA | a'),
    hints: [
      'Use a non-terminal to remember the last letter produced.',
      'After an a, only a b may come next, and vice versa.',
      'S → aA | bB | a | b, A → bB | b (last letter was a), B → aA | a (last letter was b).',
    ],
    explanation: 'The non-terminals A and B act as the states of an FSM: “the last letter was a” and “the last letter was b”. Each production adds the other letter. The productions without a non-terminal end the word.',
  },
  {
    ...build, id: 'G8', title: 'Equally many 0s and 1s', tier: 'exam',
    statement: 'Write a grammar $G$ with $T = \\{0, 1\\}$ whose language is the set of bit strings with equally many $0$s and $1$s (including $\\lambda$).',
    constraints: { terminals: ['0', '1'] },
    predicate: (w) => count(w, '0') === count(w, '1'),
    reference: grammar('S -> 0S1S | 1S0S | λ'),
    hints: [
      'Look at the first symbol of a non-empty word, say 0. Find the first point where the counts balance again.',
      'That point is a matching 1, so the word looks like 0 u 1 v, where u and v are themselves balanced.',
      'P = {S → 0S1S, S → 1S0S, S → λ}.',
    ],
    explanation: 'Every non-empty balanced word splits as 0u1v or 1u0v, where the marked symbols are the first point where the counts return to equal, so u and v are balanced too. That gives S → 0S1S | 1S0S | λ. Simpler-looking grammars such as S → 0S1 | 1S0 | SS | λ also work.',
  },
  {
    ...build, id: 'G9', title: 'Unequal blocks', tier: 'exam',
    statement: 'Write a **context-free (type 2)** grammar $G$ with $T = \\{0, 1\\}$ and $L(G) = \\{0^m1^n \\mid m \\neq n\\}$ (with $m, n \\geq 0$).',
    constraints: { terminals: ['0', '1'], requiredGrammarType: 2 },
    predicate: (w) => /^0*1*$/.test(s(w)) && count(w, '0') !== count(w, '1'),
    reference: grammar('S -> 0S1 | A | B\nA -> 0A | 0\nB -> 1B | 1'),
    hints: [
      'Either there are more 0s or more 1s.',
      'Match 0s with 1s from the outside in, then add a non-empty run of extra 0s or extra 1s in the middle.',
      'P = {S → 0S1, S → A, S → B, A → 0A, A → 0, B → 1B, B → 1}.',
    ],
    explanation: 'S → 0S1 builds the matched part. In the middle, A adds one or more extra 0s, or B adds one or more extra 1s, so m ≠ n is guaranteed. λ is excluded because 0 = 0.',
  },
  {
    ...build, id: 'G10', title: 'Three equal blocks', tier: 'challenge',
    statement: 'Write a **context-sensitive (type 1)** grammar $G$ with $T = \\{0, 1, 2\\}$ and $L(G) = \\{0^n1^n2^n \\mid n \\geq 1\\}$. Every production must have the form $lAr \\to lwr$ with $w \\neq \\lambda$.',
    constraints: { terminals: ['0', '1', '2'], requiredGrammarType: 1, checkLength: 9 },
    predicate: (w) => {
      const m = /^(0+)(1+)(2+)$/.exec(s(w));
      return !!m && m[1].length === m[2].length && m[2].length === m[3].length;
    },
    reference: grammar(ABC_GRAMMAR),
    hints: [
      'Generate 0ⁿ together with n copies of two non-terminals, say (BC)ⁿ, then sort the B’s before the C’s.',
      'A swap CB → BC isn’t of the form lAr → lwr, because two symbols change. Do it in context-sensitive steps through temporary non-terminals: CB → HB → HK → BK → BC.',
      'Finally turn B into 1 and C into 2, but only next to the right neighbour: 0B → 01, 1B → 11, 1C → 12, 2C → 22.',
    ],
    explanation: 'S → 0SBC | 0BC produces 0ⁿ followed by a mix of n B’s and n C’s. The four rules CB → HB, HB → HK, HK → BK, BK → BC each rewrite one non-terminal in context, and together they swap CB into BC. The context rules then turn B’s into 1s and C’s into 2s only in the right order. Rewriting with fresh letters H and K avoids interference between overlapping swaps.',
  },
  {
    ...build, id: 'G11', title: 'Twice as many 0s', tier: 'challenge',
    statement: 'Write a grammar $G$ with $T = \\{0, 1\\}$ whose language is the set of bit strings with exactly twice as many $0$s as $1$s (including $\\lambda$).',
    constraints: { terminals: ['0', '1'], checkLength: 9 },
    predicate: (w) => count(w, '0') === 2 * count(w, '1'),
    reference: grammar('S -> SS | 0S0S1S | 0S1S0S | 1S0S0S | λ'),
    hints: [
      'Each 1 must be paired with two 0s, in any order.',
      'Think of the three orders 001, 010, 100, with balanced words allowed in every gap.',
      'P = {S → 0S0S1S, S → 0S1S0S, S → 1S0S0S, S → SS, S → λ}.',
    ],
    explanation: 'Every word with twice as many 0s as 1s can be built by inserting balanced words into the gaps of one of 001, 010 or 100, or by concatenating two balanced words. The checker compares against every string up to length 9, which is strong evidence rather than a proof.',
  },
];
