import { describe, expect, it } from 'vitest';
import { grammar, grammarToText, parseGrammar, showP } from './grammar';
import { classify } from './classify';
import { cfgWordsUpTo, earleyDerive, earleyRecognise } from './earley';
import { generateWords, searchMembership } from './bounded-search';
import { compareWithPredicate, membership, wordsUpTo } from './language';
import { applyAt, showDerivation } from './derivation';
import { dfaToGrammar, kleeneGrammarToNfa } from './conversions';
import { accepts, enumerate } from './fsm';
import { languageDifference } from './equivalence';
import type { DFA, Sym } from './types';

const w = (s: string) => [...s];
const str = (x: Sym[]) => x.join('');

describe('parser', () => {
  it('parses |, λ spellings, arrows and ⟨⟩ symbols', () => {
    const r = parseGrammar('S -> 0S1 | 01 | λ\nA → lambda\n<noun> ::= c');
    expect(r.errors.filter((e) => !e.message.includes('no non-terminal'))).toEqual([]);
    expect(r.grammar.P).toHaveLength(5);
    expect(r.grammar.P[2].rhs).toEqual([]);
    expect(r.grammar.P[4].lhs).toEqual(['⟨noun⟩']);
    expect(r.grammar.T).toEqual(['0', '1', 'c']);
    expect(r.grammar.V).toContain('⟨noun⟩');
    expect(r.lines).toEqual([1, 1, 1, 2, 3]);
  });
  it('rejects a left side with no non-terminal', () => {
    const r = parseGrammar('S -> 0\n0 -> 1');
    expect(r.errors[0]).toEqual({ line: 2, message: expect.stringContaining('no non-terminal') });
  });
  it('requires an arrow', () => {
    expect(parseGrammar('S 0S1').errors[0].message).toMatch(/arrow/);
  });
  it('honours a terminal override', () => {
    const r = parseGrammar('S -> aX', 'S', { T: ['a', 'X'] });
    expect(r.grammar.T).toEqual(['X', 'a']);
  });
  it('shows P in set notation and round-trips', () => {
    const g = grammar('S -> 0S1 | 01');
    expect(showP(g)).toBe('{S → 0S1, S → 01}');
    expect(grammarToText(g)).toBe('S -> 0S1 | 01');
  });
});

describe('classifier (course table)', () => {
  const type = (t: string) => classify(grammar(t)).type;
  it('classifies the standard examples', () => {
    expect(type('S -> 0A | 1\nA -> 1A | 0')).toBe(3);
    expect(type('S -> 0S1 | 01')).toBe(2);
    expect(type('S -> aSBC | aBC\nCB -> BC\naB -> ab\nbB -> bb\nbC -> bc\ncC -> cc')).toBe(0); // CB → BC isn't lAr → lwr
    expect(type('S -> aBC\naB -> ab\nbC -> bc')).toBe(1);
    expect(type('S -> AB\nAB -> B\nB -> 1')).toBe(0);
  });
  it('gets the λ nuances right', () => {
    const c1 = classify(grammar('S -> 0S1 | λ'));
    expect(c1.type).toBe(2);
    expect(c1.checks[1].ok).toBe(false);
    expect(c1.checks[1].reason).toBe('S → λ fails type 1 because S appears on the right-hand side of S → 0S1.');
    expect(c1.notes.join(' ')).toMatch(/aren't nested/);
    const c2 = classify(grammar('S -> 0S | λ'));
    expect(c2.type).toBe(3);
    expect(c2.checks[1].ok).toBe(false);
    // S → λ with S on no right side is fine for type 1.
    expect(classify(grammar('S -> 0A | λ\nA -> 0A | 1')).checks[1].ok).toBe(true);
  });
  it('treats left-linear rules as not type 3', () => {
    const c = classify(grammar('S -> S0 | 1'));
    expect(c.type).toBe(2);
    expect(c.checks[3].reason).toMatch(/left-linear/);
    expect(c.notes.join(' ')).toMatch(/grammar, not the language/);
  });
  it('accepts context in type 1 (lAr → lwr)', () => {
    expect(classify(grammar('S -> aSb | ab\naSb -> aab')).checks[1].ok).toBe(true);
    expect(classify(grammar('S -> 0A\n0A -> 01')).checks[1].ok).toBe(true);
    expect(classify(grammar('S -> 0A\n0A -> 1A')).checks[1].ok).toBe(false);
  });
});

describe('Earley', () => {
  const g = grammar('S -> 0S1 | λ');
  it('recognises with λ-productions', () => {
    expect(earleyRecognise(g, [])).toBe(true);
    expect(earleyRecognise(g, w('0011'))).toBe(true);
    expect(earleyRecognise(g, w('001'))).toBe(false);
  });
  it('handles left recursion and returns a leftmost derivation', () => {
    const lr = grammar('S -> S0 | 1');
    expect(earleyRecognise(lr, w('1000'))).toBe(true);
    const d = earleyDerive(lr, w('100'))!;
    expect(showDerivation(d)).toBe('S ⇒ S0 ⇒ S00 ⇒ 100');
  });
  it('handles ambiguous grammars with λ cycles', () => {
    const bal = grammar('S -> SS | 0S1 | λ');
    const d = earleyDerive(bal, w('0101'))!;
    expect(d.forms[d.forms.length - 1].join('')).toBe('0101');
    for (let k = 0; k < d.steps.length; k++) {
      expect(applyAt(d.forms[k], d.steps[k].prod, d.steps[k].pos)).toEqual(d.forms[k + 1]);
    }
    expect(earleyRecognise(bal, w('0110'))).toBe(false);
  });
  it('lists words in shortlex', () => {
    const { words } = cfgWordsUpTo(grammar('S -> 0S1 | 01'), 6);
    expect(words.map(str)).toEqual(['01', '0011', '000111']);
  });
});

describe('bounded search', () => {
  const abc = grammar('S -> 0SBC | 0BC\nCB -> HB\nHB -> HK\nHK -> BK\nBK -> BC\n0B -> 01\n1B -> 11\n1C -> 12\n2C -> 22');
  it('decides membership exactly for non-contracting grammars', () => {
    expect(classify(abc).type).toBe(1);
    expect(searchMembership(abc, w('012')).derivation).not.toBeNull();
    expect(searchMembership(abc, w('001122')).derivation).not.toBeNull();
    const r = searchMembership(abc, w('0112'));
    expect(r.derivation).toBeNull();
    expect(r.exact).toBe(true);
  });
  it('generates 0ⁿ1ⁿ2ⁿ', () => {
    const r = generateWords(abc, 9);
    expect(r.complete).toBe(true);
    expect(r.words.map(str)).toEqual(['012', '001122', '000111222']);
  });
  it('reports the search limit for type 0', () => {
    const g = grammar('S -> SA | 0\nA0 -> 0\nA -> AA');
    const r = membership(g, w('1'), { nodeCap: 500 });
    expect(r.member).toBeNull();
  });
});

describe('language comparison', () => {
  it('finds over- and under-generation', () => {
    const target = (x: Sym[]) => x.length >= 2 && x.slice(-2).join('') === '01';
    const good = grammar('S -> 0S | 1S | 0A\nA -> 1');
    expect(compareWithPredicate(good, target, ['0', '1'], 10).kind).toBe('equal');
    const over = compareWithPredicate(grammar('S -> 0S | 1S | 0A | 1\nA -> 1'), target, ['0', '1'], 10);
    expect(over.kind).toBe('over');
    if (over.kind === 'over') expect(str(over.word)).toBe('1');
    const under = compareWithPredicate(grammar('S -> 0A\nA -> 1'), target, ['0', '1'], 10);
    expect(under.kind).toBe('under');
    if (under.kind === 'under') expect(str(under.word)).toBe('001');
  });
  it('lists words for non-CF grammars', () => {
    const r = wordsUpTo(grammar('S -> 0A\n0A -> 01 | 0A1\n'), 4);
    expect(r.words.map(str)).toEqual(['01', '011', '0111']);
  });
});

describe('conversions', () => {
  it("Kleene's construction gives an equivalent NFA", () => {
    const g = grammar('S -> 0S | 1A | λ\nA -> 1A | 1 | 0');
    const m = kleeneGrammarToNfa(g);
    expect(m.states).toEqual(['s_S', 's_A', 's_F']);
    expect(m.accepting).toContain('s_S');
    for (const x of enumerate(['0', '1'], 8)) {
      expect(accepts(m, x)).toBe(earleyRecognise(g, x));
    }
  });
  it('converts an FSM without output to a regular grammar', () => {
    const m: DFA = {
      kind: 'dfa', states: ['s0', 's1'], input: ['0', '1'], start: 's0', accepting: ['s0'],
      delta: { s0: { 0: 's0', 1: 's1' }, s1: { 0: 's1', 1: 's0' } },
    };
    const g = dfaToGrammar(m);
    expect(classify(g).checks[3].ok).toBe(true);
    expect(g.P[0]).toEqual({ lhs: ['S'], rhs: [] });
    for (const x of enumerate(['0', '1'], 8)) expect(earleyRecognise(g, x)).toBe(accepts(m, x));
    expect(languageDifference(kleeneGrammarToNfa(g), m)).toBeNull();
  });
});
