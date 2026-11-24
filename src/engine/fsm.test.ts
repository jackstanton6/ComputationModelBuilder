import { describe, expect, it } from 'vitest';
import type { DFA, Mealy, NFA } from './types';
import {
  accepts, acceptedUpTo, completeWithDeadState, countWords, dfaToNfa, enumerate, minimise,
  runDeterministic, runNondeterministic, transduce, validate,
} from './fsm';
import { subsetConstruction, renameSequential } from './nfa';
import { languageDifference, outputDifference } from './equivalence';
import { labelParts, parseWord, plainName, showWord, texName } from './notation';

// Ends in 01.
const ends01: DFA = {
  kind: 'dfa', states: ['s0', 's1', 's2'], input: ['0', '1'], start: 's0', accepting: ['s2'],
  delta: { s0: { 0: 's1', 1: 's0' }, s1: { 0: 's1', 1: 's2' }, s2: { 0: 's1', 1: 's0' } },
};

// Third-last symbol is 1.
const thirdLast: NFA = {
  kind: 'nfa', states: ['s0', 's1', 's2', 's3'], input: ['0', '1'], start: 's0', accepting: ['s3'],
  delta: { s0: { 0: ['s0'], 1: ['s0', 's1'] }, s1: { 0: ['s2'], 1: ['s2'] }, s2: { 0: ['s3'], 1: ['s3'] }, s3: { 0: [], 1: [] } },
};

const delay: Mealy = {
  kind: 'mealy', states: ['s0', 's1'], input: ['0', '1'], output: ['0', '1'], start: 's0',
  delta: { s0: { 0: 's0', 1: 's1' }, s1: { 0: 's0', 1: 's1' } },
  out: { s0: { 0: '0', 1: '0' }, s1: { 0: '1', 1: '1' } },
};

const w = (s: string) => [...s];

describe('notation', () => {
  it('names states with subscripts', () => {
    expect(plainName('s0')).toBe('s₀');
    expect(plainName('s12')).toBe('s₁₂');
    expect(plainName('{s0,s1}')).toBe('{s₀, s₁}');
    expect(texName('s0')).toBe('s_{0}');
    expect(texName('s_A')).toBe('s_{A}');
    expect(labelParts('∅')).toEqual([{ text: '∅' }]);
  });
  it('parses words with λ and multi-character symbols', () => {
    expect(parseWord('λ', ['0', '1']).word).toEqual([]);
    expect(parseWord('lambda', ['0', '1']).word).toEqual([]);
    expect(parseWord('0 1 1', ['0', '1']).word).toEqual(['0', '1', '1']);
    expect(parseWord('00 11', ['00', '01', '10', '11']).word).toEqual(['00', '11']);
    expect(parseWord('012', ['0', '1']).error).toMatch(/isn't in I/);
    expect(showWord([])).toBe('λ');
  });
});

describe('validation', () => {
  it('reports a partial f and missing s0', () => {
    const m: DFA = { ...ends01, start: null, delta: { ...ends01.delta, s2: { 0: 's1' } } };
    const issues = validate(m);
    expect(issues.some((i) => i.code === 'no-initial' && i.message === 'No initial state s₀.')).toBe(true);
    const f = issues.find((i) => i.code === 'undefined-f')!;
    expect(f.message).toContain('f(s₂, 1) is undefined');
  });
  it('allows ∅ in non-deterministic machines', () => {
    expect(validate(thirdLast).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('reports undefined g and unreachable states', () => {
    const m: Mealy = { ...delay, states: [...delay.states, 's2'], delta: { ...delay.delta, s2: { 0: 's2', 1: 's2' } }, out: { ...delay.out, s2: { 0: '0' } } };
    const issues = validate(m);
    expect(issues.some((i) => i.code === 'undefined-g' && i.message.startsWith('g(s₂, 1) is undefined'))).toBe(true);
    expect(issues.some((i) => i.code === 'unreachable' && i.severity === 'warning')).toBe(true);
  });
  it('completes with a dead state', () => {
    const m: DFA = { ...ends01, delta: { s0: { 0: 's1' }, s1: { 1: 's2' }, s2: {} } };
    const { machine, dead } = completeWithDeadState(m);
    expect(dead).toBe('d');
    expect(validate(machine).filter((i) => i.severity === 'error')).toEqual([]);
    expect(accepts(machine, w('01'))).toBe(true);
    expect(accepts(machine, w('1'))).toBe(false);
    expect(machine.accepting).not.toContain('d');
  });
});

describe('runs', () => {
  it('runs an FSM without output', () => {
    const r = runDeterministic(ends01, w('1101'));
    expect(r.final).toBe('s2');
    expect(r.accepted).toBe(true);
    expect(r.steps).toHaveLength(4);
    expect(runDeterministic(ends01, []).final).toBe('s0');
  });
  it('runs a non-deterministic FSM with set semantics', () => {
    const r = runNondeterministic(thirdLast, w('100'));
    expect(r.final).toEqual(['s0', 's3']);
    expect(r.accepted).toBe(true);
    expect(runNondeterministic(thirdLast, w('000')).accepted).toBe(false);
  });
  it('runs an FSM with output', () => {
    expect(transduce(delay, w('10011')).join('')).toBe('01001');
  });
  it('enumerates shortlex', () => {
    const all = [...enumerate(['0', '1'], 2)].map((x) => showWord(x));
    expect(all).toEqual(['λ', '0', '1', '00', '01', '10', '11']);
    expect(countWords(2, 3)).toBe(15);
  });
  it('lists accepted strings up to n', () => {
    const { words } = acceptedUpTo(ends01, 3);
    expect(words.map((x) => x.join(''))).toEqual(['01', '001', '101']);
  });
});

describe('subset construction', () => {
  it('builds only reachable subsets', () => {
    const { rows, dfa } = subsetConstruction(thirdLast);
    expect(rows.length).toBe(8);
    expect(languageDifference(dfa, thirdLast)).toBeNull();
    expect(renameSequential(dfa).dfa.states[0]).toBe('s0');
  });
  it('includes ∅ when reached', () => {
    const m: NFA = { kind: 'nfa', states: ['a'], input: ['0', '1'], start: 'a', accepting: ['a'], delta: { a: { 0: ['a'], 1: [] } } };
    const { dfa } = subsetConstruction(m);
    expect(dfa.states).toContain('{}');
    expect(dfa.names!['{}']).toBe('∅');
  });

  // Property test: random NFAs, subset construction is equivalent (checked by brute force too).
  it('is equivalent to its input on random machines', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 150; trial++) {
      const k = 1 + Math.floor(rand() * 5);
      const states = Array.from({ length: k }, (_, i) => `s${i}`);
      const delta: NFA['delta'] = {};
      for (const s of states) {
        delta[s] = {};
        for (const a of ['0', '1']) delta[s][a] = states.filter(() => rand() < 0.35);
      }
      const m: NFA = { kind: 'nfa', states, input: ['0', '1'], start: 's0', accepting: states.filter(() => rand() < 0.4), delta };
      const { dfa } = subsetConstruction(m);
      for (const x of enumerate(['0', '1'], 7)) expect(accepts(dfa, x)).toBe(accepts(m, x));
      expect(languageDifference(dfa, m)).toBeNull();
    }
  });
});

describe('equivalence', () => {
  it('finds the shortest, lexicographically least counterexample', () => {
    // Ends in 1 vs ends in 01.
    const ends1: DFA = { kind: 'dfa', states: ['a', 'b'], input: ['0', '1'], start: 'a', accepting: ['b'], delta: { a: { 0: 'a', 1: 'b' }, b: { 0: 'a', 1: 'b' } } };
    expect(languageDifference(ends1, ends01)).toEqual({ word: ['1'], acceptedBy: 'first' });
    expect(languageDifference(ends01, dfaToNfa(ends01))).toBeNull();
  });
  it('compares machines with output', () => {
    const complement: Mealy = { kind: 'mealy', states: ['s0'], input: ['0', '1'], output: ['0', '1'], start: 's0', delta: { s0: { 0: 's0', 1: 's0' } }, out: { s0: { 0: '1', 1: '0' } } };
    const d = outputDifference(delay, complement)!;
    expect(d.word).toEqual(['0']);
    expect(d.first).toEqual(['0']);
    expect(d.second).toEqual(['1']);
    expect(outputDifference(delay, delay)).toBeNull();
  });
});

describe('minimise', () => {
  it('merges equivalent states and keeps the language', () => {
    const m: DFA = {
      kind: 'dfa', states: ['s0', 's1', 's2', 's3'], input: ['0', '1'], start: 's0', accepting: ['s1', 's2'],
      delta: { s0: { 0: 's1', 1: 's2' }, s1: { 0: 's1', 1: 's1' }, s2: { 0: 's2', 1: 's2' }, s3: { 0: 's0', 1: 's0' } },
    };
    const r = minimise(m);
    expect(r.removedUnreachable).toEqual(['s3']);
    expect(r.dfa.states.length).toBe(2);
    expect(r.dfa.names!['{s1,s2}']).toBe('{s1,s2}');
    expect(languageDifference(r.dfa, m)).toBeNull();
    expect(minimise(ends01).alreadyMinimal).toBe(true);
  });
});
