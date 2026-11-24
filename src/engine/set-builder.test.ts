import { describe, expect, it } from 'vitest';
import { languageUpTo, parseSetBuilder, predicateOf, synthesizeGrammar, terminalsOf, texSetBuilder, type SetBuilder } from './set-builder';
import { compareWithPredicate } from './language';
import { classify } from './classify';

const sb = (t: string): SetBuilder => {
  const r = parseSetBuilder(t);
  if ('error' in r) throw new Error(r.error);
  return r.sb;
};
const words = (t: string, n: number) => languageUpTo(sb(t), n).map((w) => w.join('')).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));

describe('set-builder parsing and enumeration', () => {
  it('parses blocks, exponents and conditions', () => {
    expect(words('{0^n 1^n | n ≥ 1}', 6)).toEqual(['01', '0011', '000111']);
    expect(words('{0^n1 | n >= 0}', 3)).toEqual(['1', '01', '001']);
    expect(words('\\{a^n b^m c^{n+m} \\mid n, m \\geq 0\\}', 4)).toEqual(['', 'ac', 'bc', 'aacc', 'abcc', 'bbcc']);
    expect(words('{(01)^n | n ≥ 1}', 4)).toEqual(['01', '0101']);
    expect(words('{0^m 1^n | m ≠ n}', 2)).toEqual(['0', '1', '00', '11']);
    expect(words('{0^n 1^m | m > n ≥ 0}', 3)).toEqual(['1', '11', '011', '111']);
    expect(words('{λ}', 3)).toEqual(['']);
  });
  it('reports readable errors', () => {
    expect(parseSetBuilder('{0^n | m ≥ 1}')).toEqual({ error: 'm appears in a condition but not in an exponent.' });
    expect('error' in parseSetBuilder('{0^ | n ≥ 1}')).toBe(true);
    expect('error' in parseSetBuilder('{0^n 1^n | n ?? 1}')).toBe(true);
  });
  it('prints KaTeX', () => {
    expect(texSetBuilder(sb('{0^n 1^m | m > n ≥ 0}'))).toBe('\\{0^{n}1^{m} \\mid m > n,\\ n \\geq 0\\}');
    expect(texSetBuilder(sb('{a^n b^m c^{n+m} | n, m ≥ 0}'))).toBe('\\{a^{n}b^{m}c^{n+m} \\mid n, m \\geq 0\\}');
  });
});

const CASES = [
  '{0^n 1^n | n ≥ 1}',
  '{0^n 1 | n ≥ 0}',
  '{0^n 1^n | n ≥ 0}',
  '{0^m 1^n | m ≠ n}',
  '{a^n b^m c^{n+m} | n, m ≥ 0}',
  '{0^n 1^m | m > n ≥ 0}',
  '{0^n 1^m | m ≥ n}',
  '{0^{2n} 1^n | n ≥ 1}',
  '{(01)^n | n ≥ 0}',
  '{0^n 1^m 2^m 3^n | n, m ≥ 1}',
  '{0^n 1^{n+1} | n ≥ 0}',
  '{0 1^n 0 | n ≥ 2}',
  '{0^n 1^m | n ≥ 2, m ≥ 1}',
  '{0^n | n ≤ 3}',
  '{0^n 1^n 2^n | n ≥ 1}',
  '{a^n b^n c^n | n ≥ 0}',
  '{0^n 1^m 0^n | n ≥ 1, m ≥ 0}',
  '{0^n 1^m | n ≠ 2}',
];

describe('grammar synthesis', () => {
  it.each(CASES)('%s', (text) => {
    const s = sb(text);
    const r = synthesizeGrammar(s);
    if ('error' in r) throw new Error(r.error);
    const T = terminalsOf(s);
    const n = T.length <= 2 ? 10 : 9;
    expect(compareWithPredicate(r.grammar, predicateOf(s, n), T, n)).toEqual({ kind: 'equal', checkedUpTo: n });
  });
  it('gives context-free grammars for nested languages and type 1 for xⁿyⁿzⁿ', () => {
    const g1 = synthesizeGrammar(sb('{a^n b^m c^{n+m} | n, m ≥ 0}'));
    expect('grammar' in g1 && classify(g1.grammar).type).toBe(2);
    const g2 = synthesizeGrammar(sb('{0^n 1^n 2^n | n ≥ 1}'));
    expect('grammar' in g2 && classify(g2.grammar).type).toBe(1);
  });
  it('refuses crossing dependencies', () => {
    const r = synthesizeGrammar(sb('{0^n 1^m 2^n 3^m | n, m ≥ 1}'));
    expect('error' in r && r.error).toMatch(/cross/);
  });
});
