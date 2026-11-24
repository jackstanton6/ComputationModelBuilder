// A. FSMs without output: build (format build-machine, kind dfa).
import type { Problem } from './types';
import { binValueMod, count, dfa, occurrencesOf, s } from './dsl';

const base = { topic: 'fsm-without-output', format: 'build-machine', constraints: { machineKind: 'dfa' } } as const;

export const fsmWithoutOutput: Omit<Problem, 'slug'>[] = [
  {
    ...base, id: 'A1', title: 'Starts with 1', tier: 'warm-up',
    statement: 'Build an FSM without output M with $I = \\{0, 1\\}$ such that $L(M)$ is the set of bit strings that start with $1$.',
    predicate: (w) => w[0] === '1',
    reference: dfa(`>s0 | d s1
      *s1 | s1 s1
      d | d d`),
    hints: [
      'Only the first symbol matters. After that, the machine can stop paying attention.',
      'Once the first symbol is read, the answer is decided for good. Which states never need to be left?',
      'Use three states: s₀ (nothing read yet), an accepting state that loops on 0 and 1, and a non-accepting trap state d that also loops on 0 and 1.',
    ],
    explanation: 'The first symbol sends the machine to one of two "sink" states that loop on every input. Starting with 1 leads to the accepting sink, starting with 0 to the trap d. λ is rejected because s₀ is not final. Remember that f must be total, so even the trap state needs both loops.',
  },
  {
    ...base, id: 'A2', title: 'Ends in 0', tier: 'warm-up',
    statement: 'Build an FSM without output that recognises the bit strings ending in $0$. ($\\lambda$ does not end in 0.)',
    predicate: (w) => w[w.length - 1] === '0',
    reference: dfa(`>s0 | s1 s0
      *s1 | s1 s0`),
    hints: [
      'The machine needs to remember just one thing: what was the last symbol?',
      'Use one state for "the last symbol was 0" and one for "not".',
      'Two states are enough: on 0 go to the accepting state, on 1 go to the non-accepting start state, from either state.',
    ],
    explanation: 'Each state records whether the most recent symbol was 0. Every 0 moves to the accepting state and every 1 moves back to s₀, so f(s₀, x) ∈ F exactly when x ends in 0.',
  },
  {
    ...base, id: 'A3', title: 'At least one 0', tier: 'warm-up',
    statement: 'Build an FSM without output whose language is the set of bit strings containing at least one $0$.',
    predicate: (w) => w.includes('0'),
    reference: dfa(`>s0 | s1 s0
      *s1 | s1 s1`),
    hints: [
      'Before the first 0 the machine waits; after it, nothing can change the answer.',
      'What should the start state do on 1? What about on 0?',
      's₀ loops on 1 and moves to an accepting state on 0; that state loops on both symbols.',
    ],
    explanation: 'Seeing a 0 is a one-way event, so the machine moves into an accepting state that it never leaves. Strings of only 1s (including λ) stay in s₀, which is not final.',
  },
  {
    ...base, id: 'A4', title: 'Exactly length 2', tier: 'warm-up',
    statement: 'Build an FSM without output that accepts exactly the bit strings of length $2$: $L(M) = \\{00, 01, 10, 11\\}$.',
    predicate: (w) => w.length === 2,
    reference: dfa(`>s0 | s1 s1
      s1 | s2 s2
      *s2 | d d
      d | d d`),
    hints: [
      'The symbols themselves don’t matter, only how many have been read.',
      'Count 0, 1, 2 and "too many".',
      'Chain s₀ → s₁ → s₂ on both inputs, make s₂ accepting, and send everything after s₂ to a dead state.',
    ],
    explanation: 'The states count the symbols read so far, capped at "more than 2". Only the state for exactly two symbols is final, and the dead state d absorbs longer strings.',
  },
  {
    ...base, id: 'A5', title: 'Only the empty string', tier: 'warm-up',
    statement: 'Build an FSM without output with $L(M) = \\{\\lambda\\}$. Remember that $f$ must still be total.',
    predicate: (w) => w.length === 0,
    reference: dfa(`>*s0 | d d
      d | d d`),
    hints: [
      'f(s₀, λ) = s₀, so which state must be final?',
      'Any symbol at all should lead to rejection, permanently.',
      'Make s₀ accepting and send both inputs to a non-accepting dead state that loops on everything.',
    ],
    explanation: 'Since f(s₀, λ) = s₀, the start state itself must be final. Every non-empty string must be rejected, so both inputs go to a trap state d. Leaving f(s₀, 0) undefined is not allowed for an FSM without output: f is a total function S × I → S.',
  },
  {
    ...base, id: 'A6', title: 'Ends in 01', tier: 'warm-up',
    statement: 'Build an FSM without output that recognises the bit strings ending in $01$.',
    predicate: (w) => s(w).endsWith('01'),
    reference: dfa(`>s0 | s1 s0
      s1 | s1 s2
      *s2 | s1 s0`),
    hints: [
      'Track how much of the pattern 01 you have just seen: nothing, "0", or "01".',
      'From the "01" state, a 0 gives a fresh start of the pattern (you’ve just seen 0).',
      'States s₀ (no progress), s₁ (last symbol 0), s₂ (last two symbols 01, accepting). On 0 always go to s₁. On 1: s₀ → s₀, s₁ → s₂, s₂ → s₀.',
    ],
    explanation: 'Each state remembers the longest suffix of the input so far that is a prefix of 01. A 0 always means the suffix "0", and a 1 completes the pattern only straight after a 0.',
  },
  {
    ...base, id: 'A7', title: 'Even number of 1s', tier: 'standard',
    statement: 'Build an FSM without output that accepts the bit strings with an even number of $1$s. (Zero is even, so $\\lambda$ and $000$ are accepted.)',
    predicate: (w) => count(w, '1') % 2 === 0,
    reference: dfa(`>*s0 | s0 s1
      s1 | s1 s0`),
    hints: [
      'You only need the count modulo 2.',
      'What does reading a 0 do to the parity of the number of 1s?',
      'Two states: "even" (initial and accepting) and "odd". 1 swaps them, 0 loops.',
    ],
    explanation: 'The states store the parity of the number of 1s read so far. A 1 flips the parity and a 0 leaves it alone. Since λ has zero 1s, the initial state is the even state and is final.',
  },
  {
    ...base, id: 'A8', title: 'Odd number of 0s', tier: 'standard',
    statement: 'Build an FSM without output whose language is the set of bit strings with an odd number of $0$s.',
    predicate: (w) => count(w, '0') % 2 === 1,
    reference: dfa(`>s0 | s1 s0
      *s1 | s0 s1`),
    hints: [
      'Like counting 1s mod 2, but now for 0s.',
      'Which state is s₀ (parity of λ), and which is final?',
      'Two states; 0 swaps them, 1 loops; the "odd" state is final, s₀ is the "even" state.',
    ],
    explanation: 'Parity of the number of 0s is all that matters. The start state is "even" because λ has no 0s, and the only final state is "odd".',
  },
  {
    ...base, id: 'A9', title: 'Contains 11', tier: 'standard',
    statement: 'Build an FSM without output that recognises the bit strings containing $11$ as a substring.',
    predicate: (w) => s(w).includes('11'),
    reference: dfa(`>s0 | s0 s1
      s1 | s0 s2
      *s2 | s2 s2`),
    hints: [
      'Remember whether the previous symbol was a 1.',
      'Once you have seen 11, the string is in the language no matter what follows.',
      's₀ (last symbol not 1), s₁ (last symbol 1), s₂ (seen 11, accepting, loops on everything). A 0 from s₁ goes back to s₀.',
    ],
    explanation: 'Before the pattern appears, the machine tracks the last symbol. Two 1s in a row move it into a final state that it never leaves, because a substring can’t be "un-seen".',
  },
  {
    ...base, id: 'A10', title: 'No 00 anywhere', tier: 'standard',
    statement: 'Build an FSM without output that accepts the bit strings that do **not** contain $00$.',
    predicate: (w) => !s(w).includes('00'),
    reference: dfa(`>*s0 | s1 s0
      *s1 | d s0
      d | d d`),
    hints: [
      'Build a machine for "contains 00" first, then think about which states should be final.',
      'Swapping final and non-final states of a (total!) FSM without output recognises the complement.',
      'States: s₀ (last symbol not 0), s₁ (last symbol 0), d (seen 00). Make s₀ and s₁ final and d not final.',
    ],
    explanation: 'This is the complement of "contains 00". For an FSM without output with a total f, swapping F and S − F gives a machine for the complement. That trick fails if f is partial, which is one reason the course insists that f is total.',
  },
  {
    ...base, id: 'A11', title: 'Begins with 0 or with 10', tier: 'standard',
    statement: 'Build an FSM without output that accepts the bit strings that begin with $0$ or begin with $10$.',
    predicate: (w) => w[0] === '0' || (w[0] === '1' && w[1] === '0'),
    reference: dfa(`>s0 | s2 s1
      s1 | s2 d
      *s2 | s2 s2
      d | d d`),
    hints: [
      'Only the first one or two symbols matter.',
      'Both prefixes lead to the same outcome, so they can share an accepting sink.',
      'From s₀: 0 goes to an accepting sink, 1 goes to s₁. From s₁: 0 goes to the accepting sink, 1 goes to a dead state.',
    ],
    explanation: 'Once the string has started with 0 or with 10, the answer is "yes" forever, so both paths can lead to the same final state that loops on everything. Starting with 11 goes to a trap. λ and 1 are rejected.',
  },
  {
    ...base, id: 'A12', title: 'Length divisible by 3', tier: 'standard',
    statement: 'Build an FSM without output that accepts exactly the bit strings whose length is divisible by $3$ (including $\\lambda$).',
    predicate: (w) => w.length % 3 === 0,
    reference: dfa(`>*s0 | s1 s1
      s1 | s2 s2
      s2 | s0 s0`),
    hints: [
      'Count the length modulo 3.',
      'Each symbol, whatever it is, moves the count on by one.',
      'A cycle of three states s₀ → s₁ → s₂ → s₀ on both inputs, with only s₀ final.',
    ],
    explanation: 'The state is the length mod 3. Since the symbols don’t matter, each state has both inputs going to the next state in the cycle.',
  },
  {
    ...base, id: 'A13', title: 'Every 0 is followed by 1', tier: 'standard',
    statement: 'Build an FSM without output that accepts the bit strings in which every $0$ is immediately followed by a $1$. For example, $1011$ and $\\lambda$ are accepted, while $100$ and $10$ are not.',
    predicate: (w) => w.every((c, i) => c !== '0' || w[i + 1] === '1'),
    reference: dfa(`>*s0 | s1 s0
      s1 | d s0
      d | d d`),
    hints: [
      'After reading a 0, the machine owes a 1.',
      'What happens if the string ends while a 1 is still owed? What if another 0 arrives?',
      's₀ (nothing owed, final), s₁ (just read 0, not final), d (failed). From s₁: 1 → s₀, 0 → d.',
    ],
    explanation: 'The state records whether a 0 is waiting for its 1. Ending in that state means the last 0 was never followed by a 1, so s₁ is not final; a second 0 in a row is an immediate failure.',
  },
  {
    ...base, id: 'A14', title: 'Binary multiples of 3', tier: 'exam',
    statement: 'Build an FSM without output that accepts the **non-empty** bit strings which, read as a binary number (most significant bit first, leading zeros allowed), are divisible by $3$. So $0$, $11$, $110$ and $0011$ are accepted, while $\\lambda$ and $10$ are not.',
    predicate: (w) => w.length > 0 && binValueMod(w, 3) === 0,
    reference: dfa(`>s | r0 r1
      *r0 | r0 r1
      r1 | r2 r0
      r2 | r1 r2`),
    hints: [
      'Keep track of the value read so far, modulo 3.',
      'If the value so far is v, reading bit b gives the new value 2v + b.',
      'Use states r₀, r₁, r₂ for the remainder plus a separate start state for λ (which must be rejected). From rₖ on bit b go to r with index (2k + b) mod 3.',
    ],
    explanation: 'Appending bit b to a binary number with value v gives 2v + b, so the remainder mod 3 updates as k ↦ (2k + b) mod 3. A separate initial state is needed because λ isn’t a number and must be rejected, even though its "value" would be 0.',
  },
  {
    ...base, id: 'A15', title: 'Contains 0101', tier: 'exam',
    statement: 'Build an FSM without output that recognises the bit strings containing $0101$ as a substring.',
    predicate: (w) => s(w).includes('0101'),
    reference: dfa(`>s0 | s1 s0
      s1 | s1 s2
      s2 | s3 s0
      s3 | s1 s4
      *s4 | s4 s4`),
    hints: [
      'Track the longest suffix of the input that is a prefix of 0101: λ, 0, 01 or 010.',
      'The tricky transitions are failures. From "010", reading 0 leaves you with suffix "0", not with nothing.',
      'States s₀–s₄ for progress 0–4. Failures: s₁ on 0 → s₁, s₂ on 1 → s₀, s₃ on 0 → s₁. s₄ is final and loops.',
    ],
    explanation: 'Each state is the amount of 0101 matched so far. On a mismatch you don’t always start again from scratch: after 010 a 0 still leaves the single 0 as a useful start. This is the same idea as the KMP string-matching algorithm.',
  },
  {
    ...base, id: 'A16', title: 'Even 0s and odd 1s', tier: 'exam',
    statement: 'Build an FSM without output that accepts the bit strings with an even number of $0$s **and** an odd number of $1$s.',
    predicate: (w) => count(w, '0') % 2 === 0 && count(w, '1') % 2 === 1,
    reference: dfa(`>s0 | s2 s1
      *s1 | s3 s0
      s2 | s0 s3
      s3 | s1 s2`),
    hints: [
      'Track two parities at once.',
      'Four combinations: (even 0s, even 1s), (even, odd), (odd, even), (odd, odd).',
      'A 0 flips the first parity and a 1 flips the second. Only (even 0s, odd 1s) is final, and the initial state is (even, even).',
    ],
    explanation: 'This is the product of the "parity of 0s" and "parity of 1s" machines. Each state is a pair of parities, and only one pair meets both conditions.',
  },
  {
    ...base, id: 'A17', title: 'Third-last symbol is 1', tier: 'exam',
    statement: 'Build an FSM without output (so it must be deterministic) that accepts the bit strings whose third-last symbol is $1$. For example, $0100$ and $111$ are accepted, while $11$ and $1000$ are not.',
    predicate: (w) => w.length >= 3 && w[w.length - 3] === '1',
    reference: (() => {
      const lines = Array.from({ length: 8 }, (_, n) => {
        const name = `s${n}`;
        const t0 = `s${((n << 1) | 0) & 7}`;
        const t1 = `s${((n << 1) | 1) & 7}`;
        return `${n === 0 ? '>' : ''}${n & 4 ? '*' : ''}${name} | ${t0} ${t1}`;
      });
      return dfa(lines.join('\n'));
    })(),
    hints: [
      'A deterministic machine can’t guess where the end is, so it must remember the last three symbols.',
      'There are 2³ = 8 possible "last three symbols". Treat missing symbols at the start as 0s.',
      'Let state sₙ mean the last three bits read are n in binary. On bit b go to s with index (2n + b) mod 8. The final states are those with n ≥ 4.',
    ],
    explanation: 'The machine keeps a sliding window of the last three bits. Padding with 0s at the start works because a string shorter than 3 has no third-last symbol, so it should be rejected anyway. Eight states are needed; a non-deterministic FSM can do it with four (try problem B: third-last symbol, again).',
  },
  {
    ...base, id: 'A18', title: 'No three in a row', tier: 'exam',
    statement: 'Build an FSM without output that accepts the bit strings with no three consecutive equal symbols. So $0010110$ is accepted, but $10001$ and $111$ are not.',
    predicate: (w) => !s(w).includes('000') && !s(w).includes('111'),
    reference: dfa(`>*s0 | s1 s3
      *s1 | s2 s3
      *s2 | d s3
      *s3 | s1 s4
      *s4 | s1 d
      d | d d`),
    hints: [
      'Remember the last symbol and how many times in a row it has appeared (1 or 2).',
      'States: start, "one 0", "two 0s", "one 1", "two 1s", and dead.',
      'A different symbol resets the run to length 1 of that symbol. A third equal symbol goes to the dead state. Every state except dead is final.',
    ],
    explanation: 'The state stores the current run: which symbol it is and its length (1 or 2). A run of 3 is fatal. Switching symbol always starts a new run of length 1.',
  },
  {
    ...base, id: 'A19', title: 'Ends in 01 with three states', tier: 'challenge',
    statement: 'Build an FSM without output that recognises the bit strings ending in $01$, using **at most 3 states**.',
    constraints: { machineKind: 'dfa', maxStates: 3 },
    predicate: (w) => s(w).endsWith('01'),
    reference: dfa(`>s0 | s1 s0
      s1 | s1 s2
      *s2 | s1 s0`),
    hints: [
      'There is no room for a dead state, and you don’t need one: no prefix is ever hopeless.',
      'Ask: what is the longest suffix so far that could still grow into 01?',
      's₀ = "no progress", s₁ = "last symbol was 0", s₂ = "last two were 01". Every 0 goes to s₁.',
    ],
    explanation: 'Any string can still end in 01, so there is never a reason to reject permanently. The three states correspond to the three possible amounts of progress through the pattern, and that is the minimum, since λ, 0 and 01 must all be told apart.',
  },
  {
    ...base, id: 'A20', title: 'Binary multiples of 5', tier: 'challenge',
    statement: 'Build an FSM without output that accepts the **non-empty** bit strings that are multiples of $5$ when read as binary numbers (most significant bit first). For example, $101$, $1010$ and $0$ are accepted.',
    predicate: (w) => w.length > 0 && binValueMod(w, 5) === 0,
    reference: dfa(`>s | r0 r1
      *r0 | r0 r1
      r1 | r2 r3
      r2 | r4 r0
      r3 | r1 r2
      r4 | r3 r4`),
    hints: [
      'Same idea as multiples of 3: track the remainder.',
      'Reading bit b after value v gives 2v + b, so remainder k becomes (2k + b) mod 5.',
      'States r₀–r₄ plus a start state for λ. For example r₂ on 0 goes to r₄, and r₂ on 1 goes to r₀.',
    ],
    explanation: 'The remainder mod 5 is all you need, and it updates by k ↦ (2k + b) mod 5. The extra initial state rejects λ but otherwise behaves like r₀.',
  },
  {
    ...base, id: 'A21', title: 'As many 01s as 10s', tier: 'challenge',
    statement: 'Build an FSM without output that accepts the bit strings in which the number of occurrences of $01$ equals the number of occurrences of $10$. For example, $0110$ has one of each and is accepted, while $01$ is not.',
    predicate: (w) => occurrencesOf(s(w), '01') === occurrencesOf(s(w), '10'),
    reference: dfa(`>*s0 | s1 s3
      *s1 | s1 s2
      s2 | s1 s2
      *s3 | s4 s3
      s4 | s4 s3`),
    hints: [
      'Write out a few strings and count. What do the accepted ones have in common?',
      'The 01s and 10s alternate as you move along the string, so their counts differ by at most one. When are they equal?',
      'They are equal exactly when the string is λ or its first and last symbols are equal. Remember the first symbol and the current last symbol.',
    ],
    explanation: 'Every change from 0 to 1 is an occurrence of 01, and every change from 1 to 0 is an occurrence of 10. These changes alternate, so the counts are equal exactly when the string starts and ends with the same symbol (or is λ). That is easy to recognise with finitely many states, even though counting in general is not.',
  },
  {
    ...base, id: 'A22', title: 'Even blocks of a', tier: 'challenge',
    constraints: { machineKind: 'dfa', inputAlphabet: ['a', 'b'] },
    statement: 'Let $I = \\{a, b\\}$. Build an FSM without output that accepts the strings in which every maximal block of $a$’s has even length. So $aabaaaab$, $bb$ and $\\lambda$ are accepted, while $aba$ and $baaab$ are not.',
    predicate: (w) => s(w).split('b').every((blk) => blk.length % 2 === 0),
    reference: dfa(`>*s0 | s1 s0
      s1 | s0 d
      d | d d`, ['a', 'b']),
    hints: [
      'Within a block of a’s, track the parity of its length.',
      'A b ends the block. When is that allowed?',
      'States: even (final, initial), odd, dead. a swaps even and odd. b keeps "even" but sends "odd" to the dead state.',
    ],
    explanation: 'The machine checks each block as it ends. A b after an odd number of a’s breaks the rule, and so does ending the string in the "odd" state, which is why that state isn’t final.',
  },
];

// I. Is it possible? (format: possible)
export const possible: Omit<Problem, 'slug'>[] = [
  {
    id: 'I1', title: 'An FSM for matched blocks?', tier: 'exam', topic: 'fsm-without-output', format: 'possible',
    statement: 'Is there an FSM without output $M$ with $L(M) = \\{0^n1^n \\mid n \\geq 1\\}$?',
    predicate: (w) => w.length > 0 && /^0*1*$/.test(s(w)) && count(w, '0') === count(w, '1'),
    reference: {
      kind: 'possible', correct: 1,
      options: [
        { text: 'Yes: use one state for each value of $n$.' },
        { text: 'No: a machine with finitely many states can’t remember an unbounded count.' },
        { text: 'Yes, but only a non-deterministic FSM can do it.' },
        { text: 'Only if $n$ is bounded by the number of states, which is allowed.' },
      ],
    },
    hints: [
      'A machine has a fixed, finite number of states, say k.',
      'Consider the k + 1 strings λ, 0, 00, …, 0ᵏ. What does the pigeonhole principle say about where they lead?',
      'If 0ⁱ and 0ʲ (i ≠ j) lead to the same state, then 0ⁱ1ⁱ and 0ʲ1ⁱ lead to the same state too.',
    ],
    explanation: 'Suppose M has k states. Among the k + 1 prefixes 0⁰, 0¹, …, 0ᵏ, two (say 0ⁱ and 0ʲ with i ≠ j) end in the same state, by the pigeonhole principle. Then 0ⁱ1ⁱ and 0ʲ1ⁱ also end in the same state, so M accepts both or rejects both, but only the first is in the language. So no FSM recognises {0ⁿ1ⁿ | n ≥ 1}. A non-deterministic FSM doesn’t help, because the subset construction turns it into an FSM without output.',
  },
  {
    id: 'I2', title: 'An FSM for 01s and 10s?', tier: 'challenge', topic: 'fsm-without-output', format: 'possible',
    statement: 'Is there an FSM that recognises the strings over $\\{0, 1\\}$ in which the number of occurrences of $01$ equals the number of occurrences of $10$?',
    predicate: (w) => occurrencesOf(s(w), '01') === occurrencesOf(s(w), '10'),
    reference: {
      kind: 'possible', correct: 0,
      options: [
        { text: 'Yes: the condition only depends on the first and last symbols.' },
        { text: 'No: it needs to count, like $\\{0^n1^n\\}$.' },
        { text: 'No: the language isn’t closed under concatenation.' },
        { text: 'Yes, but it needs infinitely many states.' },
      ],
    },
    hints: [
      'It looks like counting, but try listing a few strings in the language.',
      'Each switch from 0 to 1 is a 01, and each switch from 1 to 0 is a 10. These switches alternate.',
      'The counts are equal exactly when the string is λ or starts and ends with the same symbol.',
    ],
    explanation: 'The occurrences of 01 and 10 alternate along the string, so their counts differ by at most one, and they are equal exactly when the first and last symbols agree (or the string is λ). A five-state FSM without output recognises that: see the problem “As many 01s as 10s”. Looking like counting doesn’t make a language non-regular.',
  },
];
