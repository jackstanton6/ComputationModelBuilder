import { describe, expect, it } from 'vitest';
import { parseTuple, tupleOf, grammar } from './grammar';

describe('G = (V, T, S, P) fields', () => {
  it('parses set notation', () => {
    const r = parseTuple({ V: 'V = {S, A, 0, 1}', T: 'T={0, 1}', S: 'S', P: 'P = {S → 0A, A → 1A, A → λ}' });
    expect(r.errors).toEqual([]);
    expect(r.parsed.grammar.P).toHaveLength(3);
    expect(r.parsed.grammar.T).toEqual(['0', '1']);
  });
  it('checks T ⊆ V, S ∈ V and symbols of P', () => {
    const r = parseTuple({ V: '{S, 0}', T: '{0, 1}', S: 'S', P: '{S → 0S1, S → λ}' });
    expect(r.errors.map((e) => e.message)).toEqual(expect.arrayContaining(['1 is in T but not in V (T ⊆ V).', '1 appears in P but isn’t in V.']));
    expect(parseTuple({ V: '{A, 0}', T: '{0}', S: 'S', P: '{A → 0}' }).errors.some((e) => e.field === 'S')).toBe(true);
  });
  it('allows lowercase non-terminals when T is explicit', () => {
    const r = parseTuple({ V: '{S, ⟨noun⟩, x, cat, dog}', T: '{cat, dog}', S: 'S', P: '{S → ⟨noun⟩}' });
    expect(r.errors.filter((e) => e.field === 'V')).toHaveLength(2);
  });
  it('round-trips', () => {
    const g = grammar('S -> 0S1 | λ');
    const r = parseTuple(tupleOf(g));
    expect(r.errors).toEqual([]);
    expect(r.parsed.grammar.P).toEqual(g.P);
  });
});
