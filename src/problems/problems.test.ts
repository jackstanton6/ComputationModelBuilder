// Verification of every practice problem (CLAUDE.md non-negotiable 4): each reference solution
// is checked against the problem's language predicate for all strings up to length 12, or up to
// ~5,000 strings for larger alphabets.
import { describe, expect, it } from 'vitest';
import type { DFA, Grammar, Machine, Mealy, NFA, Sym } from '../engine/types';
import { accepts, enumerate, hasErrors, runDeterministic, runNondeterministic, transduce, validate } from '../engine/fsm';
import { classify } from '../engine/classify';
import { compareWithPredicate } from '../engine/language';
import { earleyRecognise } from '../engine/earley';
import { grammarToText, isContextFree } from '../engine/grammar';
import { subsetConstruction } from '../engine/nfa';
import { generateWords } from '../engine/bounded-search';
import { machineToDoc } from '../store/machineDoc';
import { problems } from './index';
import { PROBLEM_COUNT } from './count';
import { checkSubmission, defaultCheckLength } from './checker';
import { isMachine, type AnswerKey, type Problem } from './types';

/** Largest n such that all words up to length n number at most 5000 (but at least 12 for |A| ≤ 2). */
function checkLengthFor(size: number): number {
  if (size <= 2) return 12;
  let n = 0;
  let total = 1;
  while (total + size ** (n + 1) <= 5000) {
    n++;
    total += size ** n;
  }
  return n;
}

const word = (w: Sym[]) => (w.length ? w.join(' ') : 'λ');

function languageOf(x: Machine | Grammar): (w: Sym[]) => boolean {
  if (isMachine(x)) return (w) => accepts(x as DFA | NFA, w);
  const g = x as Grammar;
  if (isContextFree(g)) return (w) => earleyRecognise(g, w);
  const words = new Set(generateWords(g, 10).words.map((w) => w.join(',')));
  return (w) => words.has(w.join(','));
}

const FORBIDDEN = /δ|ε|Σ|q₀|q_0|\\delta|\\epsilon|\\varepsilon|\\Sigma|\bDFA\b|\bNFA\b/;

function allText(p: Problem): string {
  const ref = p.reference as AnswerKey;
  const opts = 'kind' in ref && (ref.kind === 'describe' || ref.kind === 'possible') ? ref.options.map((o) => o.text).join(' ') : '';
  const fields = 'kind' in ref && ref.kind === 'trace' ? ref.fields.map((f) => f.label).join(' ') : '';
  return [p.title, p.statement, ...p.hints, p.explanation, opts, fields].join(' ');
}

describe('catalogue', () => {
  it('has about 70 problems with unique slugs and ids', () => {
    expect(problems.length).toBe(PROBLEM_COUNT);
    expect(new Set(problems.map((p) => p.slug)).size).toBe(problems.length);
    expect(new Set(problems.map((p) => p.id)).size).toBe(problems.length);
  });
  it('keeps the four tiers roughly balanced', () => {
    const counts = new Map<string, number>();
    for (const p of problems) counts.set(p.tier, (counts.get(p.tier) ?? 0) + 1);
    for (const t of ['warm-up', 'standard', 'exam', 'challenge']) expect(counts.get(t)).toBeGreaterThanOrEqual(12);
  });
});

describe.each(problems.map((p) => [`${p.id} ${p.title}`, p] as const))('%s', (_name, p) => {
  it('is well-formed and uses course notation', () => {
    expect(p.hints).toHaveLength(3);
    p.hints.forEach((h) => expect(h.length).toBeGreaterThan(10));
    expect(p.explanation.length).toBeGreaterThan(40);
    expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(allText(p)).not.toMatch(FORBIDDEN);
    if (p.given && isMachine(p.given)) expect(hasErrors(validate(p.given as Machine))).toBe(false);
  });

  if (p.format === 'build-machine') {
    it('reference machine satisfies the constraints and matches the target', () => {
      const ref = p.reference as Machine;
      expect(hasErrors(validate(ref))).toBe(false);
      const c = p.constraints ?? {};
      if (c.maxStates) expect(ref.states.length).toBeLessThanOrEqual(c.maxStates);
      if (c.exactStates) expect(ref.states.length).toBe(c.exactStates);
      if (c.machineKind === 'dfa') expect(ref.kind).toBe('dfa');
      const n = checkLengthFor(ref.input.length);
      if (ref.kind === 'mealy') {
        for (const w of enumerate(ref.input, n)) expect(transduce(ref, w), word(w)).toEqual(p.transducer!(w));
      } else {
        for (const w of enumerate(ref.input, n)) expect(accepts(ref, w), word(w)).toBe(p.predicate!(w));
      }
      const res = checkSubmission(p.slug, { kind: 'machine', doc: machineToDoc(ref) });
      expect(res.kind).toBe('correct');
    });
  }

  if (p.format === 'build-grammar') {
    it('reference grammar has the required type and matches the predicate', () => {
      const g = p.reference as Grammar;
      const c = p.constraints ?? {};
      if (c.requiredGrammarType !== undefined) expect(classify(g).checks[c.requiredGrammarType].ok).toBe(true);
      const T = c.terminals ?? ['0', '1'];
      const n = Math.max(checkLengthFor(T.length), defaultCheckLength(p));
      expect(compareWithPredicate(g, p.predicate!, T, n)).toEqual({ kind: 'equal', checkedUpTo: n });
      const res = checkSubmission(p.slug, { kind: 'grammar', text: grammarToText(g), start: g.S });
      expect(res.kind).toBe('correct');
    });
  }

  if (p.format === 'trace') {
    it('answer key agrees with the engine', () => {
      const m = p.given as Machine;
      const ref = p.reference as Extract<AnswerKey, { kind: 'trace' }>;
      for (const f of ref.fields) {
        const m1 = /\$f\(s_0, (\d+)\)/.exec(f.label);
        const m2 = /\$(\d+)/.exec(f.label);
        if (f.type === 'state') {
          expect(runDeterministic(m as DFA, [...m1![1]]).final).toBe(f.expected);
        } else if (f.type === 'set') {
          expect(runNondeterministic(m as NFA, [...m1![1]]).final.sort()).toEqual([...f.expected].sort());
        } else if (f.type === 'word') {
          expect(transduce(m as Mealy, [...m2![1]]).join('')).toBe(f.expected);
        } else {
          const x = [...m2![1]];
          expect(m.kind === 'nfa' ? runNondeterministic(m, x).accepted : runDeterministic(m as DFA, x).accepted).toBe(f.expected);
        }
      }
      const values = Object.fromEntries(ref.fields.map((f) => [f.id, f.expected]));
      expect(checkSubmission(p.slug, { kind: 'answer', values }).kind).toBe('correct');
    });
  }

  if (p.format === 'describe-language') {
    it('exactly the marked option matches the given language', () => {
      const ref = p.reference as Extract<AnswerKey, { kind: 'describe' }>;
      const lang = languageOf(p.given!);
      const alpha = isMachine(p.given) ? (p.given as Machine).input : (p.given as Grammar).T;
      const n = checkLengthFor(alpha.length);
      const words = [...enumerate(alpha, n)];
      for (const w of words) expect(p.predicate!(w), word(w)).toBe(lang(w));
      ref.options.forEach((o, i) => {
        const agrees = words.every((w) => o.predicate!(w) === lang(w));
        expect(agrees, `option ${i}: ${o.text}`).toBe(i === ref.correct);
      });
      const inL = words.find((w) => lang(w))!;
      const notInL = words.find((w) => !lang(w))!;
      const res = checkSubmission(p.slug, { kind: 'answer', values: { choice: ref.correct, inL: inL.join(''), notInL: notInL.join('') || 'λ' } });
      expect(res.kind).toBe('correct');
    });
  }

  if (p.format === 'classify-grammar') {
    it('stated type is the classifier’s largest type', () => {
      const ref = p.reference as Extract<AnswerKey, { kind: 'classify' }>;
      expect(classify(p.given as Grammar).type).toBe(ref.type);
      expect(checkSubmission(p.slug, { kind: 'answer', values: { type: ref.type } }).kind).toBe('correct');
      expect(checkSubmission(p.slug, { kind: 'answer', values: { type: (ref.type + 1) % 4 } }).kind).toBe('wrong');
    });
  }

  if (p.format === 'fill-table') {
    it('accepts the true table and rejects a wrong one', () => {
      const ref = p.reference as Extract<AnswerKey, { kind: 'fill-table' }>;
      const m = p.given as Machine;
      if (ref.mode === 'table') {
        const values: Record<string, string> = {};
        for (const s of m.states) {
          for (const i of m.input) {
            values[`f:${s}:${i}`] = m.delta[s][i] as string;
            if (m.kind === 'mealy') values[`g:${s}:${i}`] = m.out[s][i];
          }
        }
        expect(checkSubmission(p.slug, { kind: 'answer', values }).kind).toBe('correct');
        const k = `f:${m.states[0]}:${m.input[0]}`;
        values[k] = m.states.find((s) => s !== values[k])!;
        expect(checkSubmission(p.slug, { kind: 'answer', values }).kind).toBe('wrong');
      } else {
        const rows = subsetConstruction(m as NFA).rows.map((r) => ({ subset: r.subset, next: r.next, final: r.final })).reverse();
        expect(checkSubmission(p.slug, { kind: 'answer', values: { rows } }).kind).toBe('correct');
        expect(checkSubmission(p.slug, { kind: 'answer', values: { rows: rows.slice(1) } }).kind).toBe('wrong');
      }
    });
  }

  if (p.format === 'possible') {
    it('answer is consistent with the language', () => {
      const ref = p.reference as Extract<AnswerKey, { kind: 'possible' }>;
      expect(checkSubmission(p.slug, { kind: 'answer', values: { choice: ref.correct } }).kind).toBe('correct');
      if (ref.correct === 0) {
        // Yes: some machine in the catalogue recognises it.
        const witness = problems.find((q) => q.format === 'build-machine' && q.id !== p.id
          && [...enumerate(['0', '1'], 10)].every((w) => q.predicate?.(w) === p.predicate!(w)));
        expect(witness).toBeDefined();
        for (const w of enumerate(['0', '1'], 12)) expect(accepts(witness!.reference as DFA, w)).toBe(p.predicate!(w));
      } else {
        // No: sanity check that no FSM without output with at most 3 states agrees up to length 8.
        const words = [...enumerate(['0', '1'], 8)];
        let found = false;
        const S = ['a', 'b', 'c'];
        for (let k = 1; k <= 3 && !found; k++) {
          const st = S.slice(0, k);
          const choices = k ** (2 * k) * 2 ** k;
          for (let code = 0; code < choices && !found; code++) {
            let c = code;
            const delta: DFA['delta'] = {};
            for (const s of st) {
              delta[s] = {};
              for (const i of ['0', '1']) {
                delta[s][i] = st[c % k];
                c = Math.floor(c / k);
              }
            }
            const acc = st.filter(() => {
              const b = c % 2;
              c = Math.floor(c / 2);
              return b === 1;
            });
            const m: DFA = { kind: 'dfa', states: st, input: ['0', '1'], start: 'a', accepting: acc, delta };
            if (words.every((w) => accepts(m, w) === p.predicate!(w))) found = true;
          }
        }
        expect(found).toBe(false);
      }
    });
  }
});
