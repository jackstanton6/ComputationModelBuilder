import { describe, expect, it } from 'vitest';
import { buildPattern, PATTERNS } from './patterns';
import { compareWithPredicate } from './language';
import { classify } from './classify';
import { accepts, enumerate } from './fsm';

const CASES: [string, string[], Record<string, string>][] = [
  ['starts', ['0', '1'], { w: '01' }],
  ['ends', ['0', '1'], { w: '011' }],
  ['contains', ['0', '1'], { w: '0101' }],
  ['avoids', ['a', 'b'], { w: 'aa' }],
  ['len-eq', ['0', '1'], { k: '3' }],
  ['len-ge', ['0', '1', '2'], { k: '2' }],
  ['len-mod', ['0', '1'], { k: '3', r: '1' }],
  ['count-mod', ['a', 'b', 'c'], { a: 'b', k: '2', r: '1' }],
  ['palindromes', ['0', '1'], {}],
  ['equal', ['a', 'b'], { a: 'a', b: 'b' }],
  ['balanced', ['0', '1'], { a: '0', b: '1' }],
];

describe('pattern library', () => {
  it('covers every pattern', () => {
    expect(new Set(CASES.map((c) => c[0]))).toEqual(new Set(PATTERNS.map((p) => p.id)));
  });
  it.each(CASES)('%s %j %j', (id, I, params) => {
    const r = buildPattern(id, I, params);
    if ('error' in r) throw new Error(r.error);
    const n = I.length <= 2 ? 10 : 7;
    expect(compareWithPredicate(r.grammar, r.predicate, I, n)).toEqual({ kind: 'equal', checkedUpTo: n });
    if (r.dfa) {
      expect(classify(r.grammar).checks[3].ok).toBe(true);
      for (const w of enumerate(I, n)) expect(accepts(r.dfa, w)).toBe(r.predicate(w));
    }
  });
  it('validates parameters', () => {
    expect(buildPattern('ends', ['0', '1'], { w: '012' })).toEqual({ error: '“2” isn’t in the alphabet.' });
    expect('error' in buildPattern('equal', ['0', '1', '2'], { a: '0', b: '1' })).toBe(true);
  });
});
