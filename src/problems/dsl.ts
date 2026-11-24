// Compact notation for writing machines in the problem catalogue.
//
//   dfa(`>s0 | s1 s0
//        s1  | s1 s2
//        *s2 | s1 s0`)              columns follow the input alphabet order
//   nfa(`>s0 | s0 s0,s1
//        s1  | - s2`)               "-" is ∅, sets are comma-separated
//   mealy(`>s0 | s0/0 s1/0
//          s1  | s0/1 s1/1`)        target/output
import type { DFA, Mealy, NFA, StateId, Sym } from '../engine/types';

const BIN = ['0', '1'];

interface Row {
  name: StateId;
  start: boolean;
  accepting: boolean;
  cells: string[];
}

function rows(spec: string): Row[] {
  return spec.trim().split('\n').map((line) => {
    const [head, body] = line.split('|').map((s) => s.trim());
    const start = head.includes('>');
    const accepting = head.includes('*');
    const name = head.replace(/[>*]/g, '').trim();
    return { name, start, accepting, cells: body.split(/\s+/) };
  });
}

export function dfa(spec: string, input: Sym[] = BIN): DFA {
  const r = rows(spec);
  const delta: DFA['delta'] = {};
  for (const row of r) delta[row.name] = Object.fromEntries(input.map((i, k) => [i, row.cells[k]]));
  return {
    kind: 'dfa', states: r.map((x) => x.name), input, start: r.find((x) => x.start)?.name ?? r[0].name,
    accepting: r.filter((x) => x.accepting).map((x) => x.name), delta,
  };
}

export function nfa(spec: string, input: Sym[] = BIN): NFA {
  const r = rows(spec);
  const delta: NFA['delta'] = {};
  for (const row of r) {
    delta[row.name] = Object.fromEntries(input.map((i, k) => [i, row.cells[k] === '-' ? [] : row.cells[k].split(',')]));
  }
  return {
    kind: 'nfa', states: r.map((x) => x.name), input, start: r.find((x) => x.start)?.name ?? r[0].name,
    accepting: r.filter((x) => x.accepting).map((x) => x.name), delta,
  };
}

export function mealy(spec: string, input: Sym[] = BIN, output: Sym[] = BIN): Mealy {
  const r = rows(spec);
  const delta: Mealy['delta'] = {};
  const out: Mealy['out'] = {};
  for (const row of r) {
    delta[row.name] = {};
    out[row.name] = {};
    input.forEach((i, k) => {
      const [t, o] = row.cells[k].split('/');
      delta[row.name][i] = t;
      out[row.name][i] = o;
    });
  }
  return { kind: 'mealy', states: r.map((x) => x.name), input, output, start: r.find((x) => x.start)?.name ?? r[0].name, delta, out };
}

// Predicate helpers.
export const s = (w: Sym[]) => w.join('');
export const count = (w: Sym[], c: Sym) => w.filter((x) => x === c).length;
export const occurrencesOf = (str: string, sub: string) => {
  let n = 0;
  for (let i = 0; i + sub.length <= str.length; i++) if (str.slice(i, i + sub.length) === sub) n++;
  return n;
};
/** Value of a bit string read MSB first. */
export const binValueMod = (w: Sym[], m: number) => w.reduce((v, b) => (2 * v + Number(b)) % m, 0);
