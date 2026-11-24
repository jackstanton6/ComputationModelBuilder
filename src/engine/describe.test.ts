import { describe, expect, it } from 'vitest';
import { guessLanguage } from './describe';
import { grammar } from './grammar';
import { wordsUpTo } from './language';

const guess = (text: string, n = 8) => {
  const g = grammar(text);
  return guessLanguage(wordsUpTo(g, n).words, g.T, n)?.tex ?? null;
};

describe('guessing L(G)', () => {
  it('recognises block languages', () => {
    expect(guess('S -> 0S1 | 01')).toBe('\\{0^{n}1^{n} \\mid n \\geq 1\\}');
    expect(guess('S -> 0S | 1')).toBe('\\{0^{n}1 \\mid n \\geq 0\\}');
    expect(guess('S -> aSc | B\nB -> bBc | λ')).toBe('\\{a^{n}b^{m}c^{n+m} \\mid n, m \\geq 0\\}');
    expect(guess('S -> 0A | 1B\nA -> 0A | 2\nB -> 1B | 2')).toBe('\\{0^{n}2 \\mid n \\geq 1\\} \\cup \\{1^{n}2 \\mid n \\geq 1\\}');
    expect(guess('S -> 0S1 | A | B\nA -> 0A | 0\nB -> 1B | 1')).toBe('\\{0^{n}1^{m} \\mid n \\neq m,\\ n, m \\geq 0\\}');
    expect(guess('S -> S0 | 1')).toBe('\\{10^{n} \\mid n \\geq 0\\}');
  });
  it('recognises common families', () => {
    expect(guess('S -> 0S | 1S | 0A\nA -> 1')).toBe('\\{w \\in \\{0, 1\\}^\\star \\mid w \\text{ ends in } 01\\}');
    expect(guess('S -> 0S0 | 1S1 | 0 | 1 | λ')).toBe('\\{w \\in \\{0, 1\\}^\\star \\mid w \\text{ is a palindrome}\\}');
    expect(guess('S -> 0S1S | 1S0S | λ')).toBe('\\{w \\in \\{0, 1\\}^\\star \\mid w \\text{ has as many } 0\\text{s as } 1\\text{s}\\}');
    expect(guess('S -> 0S | 1S | λ')).toBe('\\{0, 1\\}^\\star');
    expect(guess('S -> 01 | 10')).toBe('\\{01, 10\\}');
  });
});
