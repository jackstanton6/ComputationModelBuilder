// C. FSMs with output: build (kind mealy, checked by output equivalence).
import type { Problem } from './types';
import { binValueMod, count, mealy } from './dsl';

const base = { topic: 'fsm-with-output', format: 'build-machine', constraints: { machineKind: 'mealy' } } as const;
const PAIRS = ['00', '01', '10', '11'];

export const fsmWithOutput: Omit<Problem, 'slug'>[] = [
  {
    ...base, id: 'C1', title: 'Complement each bit', tier: 'warm-up',
    statement: 'Build an FSM with output $M = (S, I, O, f, g, s_0)$ with $I = O = \\{0, 1\\}$ that outputs the complement of each input bit. For example, input $0110$ gives output $1001$.',
    transducer: (w) => w.map((b) => (b === '0' ? '1' : '0')),
    reference: mealy(`>s0 | s0/1 s0/0`),
    hints: [
      'Does the machine need to remember anything about earlier input?',
      'One state is enough.',
      'A single state s₀ with two self-loops labelled 0, 1 and 1, 0.',
    ],
    explanation: 'The output for each symbol depends only on that symbol, so no memory is needed. Edge labels are written i, o, so the loops are "0, 1" and "1, 0".',
  },
  {
    ...base, id: 'C2', title: 'One-unit delay', tier: 'standard',
    statement: 'Build an FSM with output that implements a one-unit delay: it outputs $0$ first, and then each input bit one step late. So input $10011$ gives output $01001$ (the last input bit is never output).',
    transducer: (w) => (w.length ? ['0', ...w.slice(0, -1)] : []),
    reference: mealy(`>s0 | s0/0 s1/0
      s1 | s0/1 s1/1`),
    hints: [
      'At each step the output is the previous input bit.',
      'Let the state remember the previous input bit. What should the "previous bit" be at the start?',
      'States s₀ ("previous bit 0", initial) and s₁ ("previous bit 1"). From sₖ, output k and move to the state for the bit just read.',
    ],
    explanation: 'The state stores the last bit read. Each transition outputs the stored bit and stores the new one. Starting in the "0" state makes the first output 0.',
  },
  {
    ...base, id: 'C3', title: 'Even number of 1s so far', tier: 'standard',
    statement: 'Build an FSM with output that, at each step, outputs $1$ exactly when the number of $1$s read so far (including the current symbol) is even. For example, input $0110$ gives output $1011$.',
    transducer: (w) => w.map((_, i) => (count(w.slice(0, i + 1), '1') % 2 === 0 ? '1' : '0')),
    reference: mealy(`>s0 | s0/1 s1/0
      s1 | s1/0 s0/1`),
    hints: [
      'Track the parity of the number of 1s.',
      'The output is about the parity after reading the current symbol.',
      'States "even" (initial) and "odd". The output on each edge is 1 exactly when the edge ends in "even".',
    ],
    explanation: 'This is the parity machine from FSMs without output, with the "is it final?" answer turned into an output on every transition. Each edge outputs 1 iff it leads to the even state.',
  },
  {
    ...base, id: 'C4', title: 'Three 1s in a row', tier: 'exam',
    statement: 'Build an FSM with output that outputs $1$ exactly when the last three input bits (including the current one) were all $1$, and $0$ otherwise. For example, input $0111101$ gives output $0001100$.',
    transducer: (w) => w.map((_, i) => (i >= 2 && w[i] === '1' && w[i - 1] === '1' && w[i - 2] === '1' ? '1' : '0')),
    reference: mealy(`>s0 | s0/0 s1/0
      s1 | s0/0 s2/0
      s2 | s0/0 s2/1`),
    hints: [
      'Count the current run of 1s, but you never need to count beyond 2.',
      'A 0 resets the run.',
      'States for runs of 0, 1 and "at least 2". Only the edge from the "at least 2" state on input 1 outputs 1.',
    ],
    explanation: 'The machine counts consecutive 1s, capped at 2. When the run is already at least 2 and another 1 arrives, the last three bits are 111, so it outputs 1 and stays in the same state.',
  },
  {
    ...base, id: 'C5', title: 'Serial adder', tier: 'exam',
    constraints: { machineKind: 'mealy', inputAlphabet: PAIRS, outputAlphabet: ['0', '1'] },
    statement: 'Build a serial adder. Two binary numbers $x$ and $y$ are fed in together, least significant bit first, so $I = \\{00, 01, 10, 11\\}$, where the input symbol $x_k y_k$ is the pair of $k$-th bits. With $O = \\{0, 1\\}$, the output should be the bits of $x + y$, least significant first, dropping the final carry. For example, $x = 011$, $y = 001$ (that is, 6 + 4 written LSB first) is the input $00\\ 10\\ 11$, which gives output $010$: the sum 10 is $0101$ LSB first, without its final bit.',
    transducer: (w) => {
      let c = 0;
      return w.map((p) => {
        const t = Number(p[0]) + Number(p[1]) + c;
        c = t >> 1;
        return String(t & 1);
      });
    },
    reference: mealy(`>s0 | s0/0 s0/1 s0/1 s1/0
      s1 | s0/1 s1/0 s1/0 s1/1`, PAIRS, ['0', '1']),
    hints: [
      'What must the machine remember between one column of the addition and the next?',
      'The carry: 0 or 1. Use one state for each.',
      'In carry state c, on input xy output (x + y + c) mod 2 and go to the carry state ⌊(x + y + c)/2⌋.',
    ],
    explanation: 'Column addition only needs the carry from the previous column, so two states suffice. This is the classic example of an FSM with output in Rosen-style courses, and a good reminder that input symbols can be pairs.',
  },
  {
    ...base, id: 'C6', title: 'Two-unit delay', tier: 'challenge',
    statement: 'Build an FSM with output that implements a two-unit delay: it outputs $00$ first, and then the input with its last two bits removed. So input $10110$ gives output $00101$.',
    transducer: (w) => ['0', '0', ...w].slice(0, w.length),
    reference: mealy(`>s0 | s0/0 s1/0
      s1 | s2/0 s3/0
      s2 | s0/1 s1/1
      s3 | s2/1 s3/1`),
    hints: [
      'The machine must remember the last two input bits.',
      'Four states, one per pair of bits; the start state stands for "00".',
      'In state "ab" (second-last a, last b), on input c output a and move to state "bc".',
    ],
    explanation: 'Each state is a two-bit buffer. Every step outputs the older bit and shifts the new bit in. Pretending the buffer starts as 00 produces the two leading 0s.',
  },
  {
    ...base, id: 'C7', title: 'Divisible by 3 so far', tier: 'challenge',
    statement: 'Build an FSM with output that, after each input bit, outputs $1$ exactly when the input read so far, as a binary number (most significant bit first), is divisible by $3$. For example, input $1100$ gives output $0111$ (1, 3, 6 and 12).',
    transducer: (w) => w.map((_, i) => (binValueMod(w.slice(0, i + 1), 3) === 0 ? '1' : '0')),
    reference: mealy(`>s0 | s0/1 s1/0
      s1 | s2/0 s0/1
      s2 | s1/0 s2/0`),
    hints: [
      'Track the value mod 3.',
      'Reading bit b turns remainder k into (2k + b) mod 3.',
      'Three states for the remainders. Each edge outputs 1 exactly when it leads to the remainder-0 state.',
    ],
    explanation: 'This combines the divisibility FSM with the idea of turning "is the new state final?" into an output. Unlike the FSM without output version, no extra start state is needed: there is no output for λ, so nothing has to be said about it.',
  },
];
