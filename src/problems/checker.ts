// Checks a submission against a problem (SPEC §12.5). Runs in the Web Worker.
import type { DFA, Grammar, Machine, Mealy, NFA, Sym } from '../engine/types';
import type { SearchOptions } from '../engine/bounded-search';
import type { Derivation } from '../engine/derivation';
import { validate } from '../engine/fsm';
import { languageDifference, outputDifference } from '../engine/equivalence';
import { classify, TYPE_NAMES } from '../engine/classify';
import { parseGrammar, showProduction } from '../engine/grammar';
import { compareWithPredicate } from '../engine/language';
import { parseWord, showWord } from '../engine/notation';
import { subsetConstruction } from '../engine/nfa';
import { docToMachine, type MachineDoc } from '../store/machineDoc';
import { problemBySlug } from './index';
import { isGrammar, isMachine, type Problem } from './types';

export type Submission =
  | { kind: 'machine'; doc: MachineDoc }
  | { kind: 'grammar'; text: string; start: string }
  | { kind: 'answer'; values: Record<string, unknown> };

export interface SubsetRowAnswer {
  subset: string[];
  next: Record<string, string[]>;
  final: boolean;
}

export type CheckResult =
  | { kind: 'correct'; message: string }
  | { kind: 'constraint'; message: string }
  | {
    kind: 'wrong';
    message: string;
    /** A string the student can load into the simulator. */
    word?: string;
    derivation?: Derivation;
    /** Per-field (or per-cell) correctness for answer formats. */
    fields?: Record<string, boolean>;
    checkedUpTo?: number;
  }
  | { kind: 'inconclusive'; message: string; checkedUpTo?: number }
  | { kind: 'timeout' };

export function defaultCheckLength(p: Problem): number {
  if (p.constraints?.checkLength) return p.constraints.checkLength;
  const t = p.constraints?.terminals?.length ?? 2;
  return t <= 2 ? 10 : 8;
}

const bold = (w: Sym[], multi = false) => `**${showWord(w, multi)}**`;
const plain = (w: Sym[], multi = false) => showWord(w, multi);

function checkMachine(p: Problem, doc: MachineDoc): CheckResult {
  const c = p.constraints ?? {};
  const m = docToMachine(doc);
  const want = c.machineKind ?? (isMachine(p.reference) ? p.reference.kind : 'dfa');
  if (want === 'dfa' && m.kind !== 'dfa') {
    return { kind: 'constraint', message: 'This problem asks for an FSM without output (deterministic). Switch the machine type to “Without output”.' };
  }
  if (want === 'mealy' && m.kind !== 'mealy') {
    return { kind: 'constraint', message: 'This problem asks for an FSM with output. Switch the machine type to “With output”.' };
  }
  if (want === 'dfa-or-nfa' && m.kind === 'mealy') {
    return { kind: 'constraint', message: 'This problem asks for an FSM without output (deterministic or non-deterministic), not one with output.' };
  }
  const issues = validate(m).filter((i) => i.severity === 'error');
  if (issues.length) {
    const total = issues.some((i) => i.code === 'undefined-f' || i.code === 'undefined-g');
    return {
      kind: 'constraint',
      message: (total ? (m.kind === 'mealy' ? 'f or g isn’t total. ' : 'f isn’t total. ') : '') + issues[0].message + (issues.length > 1 ? ` (and ${issues.length - 1} more issue${issues.length > 2 ? 's' : ''})` : ''),
    };
  }
  if (c.maxStates !== undefined && m.states.length > c.maxStates) {
    return { kind: 'constraint', message: `Your machine has ${m.states.length} states. This problem asks for at most ${c.maxStates}.` };
  }
  if (c.exactStates !== undefined && m.states.length !== c.exactStates) {
    return { kind: 'constraint', message: `Your machine has ${m.states.length} states, but the table has ${c.exactStates}. Draw one state per row.` };
  }
  const ref = p.reference as Machine;
  const multi = m.input.some((x) => x.length > 1);
  if (m.kind === 'mealy') {
    const d = outputDifference(m, ref as Mealy);
    if (!d) return { kind: 'correct', message: 'Correct! Your machine gives the right output for every input.' };
    return {
      kind: 'wrong', word: showWord(d.word, multi),
      message: `Not quite. On input ${bold(d.word, multi)} your machine outputs ${bold(d.first)}, but it should output ${bold(d.second)}.`,
    };
  }
  const d = languageDifference(m as DFA | NFA, ref as DFA | NFA);
  if (!d) return { kind: 'correct', message: 'Correct! L(M) = L.' };
  const w = plain(d.word, multi);
  return {
    kind: 'wrong', word: w,
    message: d.acceptedBy === 'first'
      ? `Not quite. Your machine accepts ${bold(d.word, multi)}, but ${w} ∉ L.`
      : `Not quite. Your machine rejects ${bold(d.word, multi)}, but ${w} ∈ L.`,
  };
}

function checkGrammar(p: Problem, text: string, start: string, opts: SearchOptions): CheckResult {
  const c = p.constraints ?? {};
  const parsed = parseGrammar(text, start || 'S');
  if (parsed.errors.length) {
    const e = parsed.errors[0];
    return { kind: 'constraint', message: `${e.line > 0 ? `Line ${e.line}: ` : ''}${e.message}` };
  }
  const g = parsed.grammar;
  if (c.requiredGrammarType !== undefined) {
    const cl = classify(g);
    const k = c.requiredGrammarType;
    const chk = cl.checks[k];
    if (!chk.ok) {
      const name = TYPE_NAMES[k] === 'regular' ? 'a regular (type 3)' : `a ${TYPE_NAMES[k]} (type ${k})`;
      return {
        kind: 'constraint',
        message: `Your grammar is type ${cl.type}, but this problem needs ${name} grammar. ${chk.reason ?? (chk.offending ? `The production ${showProduction(chk.offending)} doesn’t fit.` : '')}`,
      };
    }
  }
  const T = c.terminals ?? ['0', '1'];
  const n = defaultCheckLength(p);
  const r = compareWithPredicate(g, p.predicate!, T, n, opts);
  const note = n;
  if (r.kind === 'equal') return { kind: 'correct', message: 'Correct! L(G) agrees with L on every string checked.' };
  if (r.kind === 'over') {
    return { kind: 'wrong', message: `Not quite. Your grammar generates ${bold(r.word)}, but ${plain(r.word)} ∉ L.`, derivation: r.derivation ?? undefined, checkedUpTo: note };
  }
  if (r.kind === 'under') {
    return { kind: 'wrong', message: `Not quite. Your grammar doesn’t generate ${bold(r.word)}, which is in L.`, checkedUpTo: note };
  }
  return { kind: 'inconclusive', message: r.message, checkedUpTo: note };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function alphabetOf(p: Problem): Sym[] {
  if (isMachine(p.given)) return p.given.input;
  if (isGrammar(p.given)) return (p.given as Grammar).T;
  return ['0', '1'];
}

function checkAnswer(p: Problem, values: Record<string, unknown>): CheckResult {
  const ref = p.reference;
  if (!('kind' in ref)) return { kind: 'constraint', message: 'Nothing to check.' };
  switch (ref.kind) {
    case 'trace': {
      const fields: Record<string, boolean> = {};
      for (const f of ref.fields) {
        const v = values[f.id];
        if (f.type === 'set') fields[f.id] = Array.isArray(v) && sameSet(v as string[], f.expected);
        else if (f.type === 'yesno') fields[f.id] = v === f.expected;
        else if (f.type === 'word') fields[f.id] = typeof v === 'string' && v.replace(/\s+/g, '') === f.expected;
        else fields[f.id] = v === f.expected;
      }
      const wrong = Object.values(fields).filter((x) => !x).length;
      if (wrong === 0) return { kind: 'correct', message: 'Correct! Every answer matches.' };
      return { kind: 'wrong', fields, message: `Not quite: ${wrong} of ${ref.fields.length} answer${ref.fields.length === 1 ? ' is' : 's are'} wrong (marked ✗). Try tracing again one symbol at a time.` };
    }
    case 'describe': {
      const alpha = alphabetOf(p);
      const choice = values.choice;
      const fields: Record<string, boolean> = { choice: choice === ref.correct };
      const msgs: string[] = [];
      if (choice === undefined) msgs.push('Choose a description.');
      else if (!fields.choice) msgs.push('That description doesn’t match the language.');
      for (const [key, want] of [['inL', true], ['notInL', false]] as const) {
        const text = String(values[key] ?? '');
        const pw = parseWord(text, alpha, isGrammar(p.given) ? 'T' : 'I');
        if (pw.error) {
          fields[key] = false;
          msgs.push(pw.error);
          continue;
        }
        const inL = p.predicate!(pw.word);
        fields[key] = inL === want;
        if (!fields[key]) msgs.push(want ? `${plain(pw.word)} isn’t in the language.` : `${plain(pw.word)} is in the language.`);
      }
      if (msgs.length === 0) return { kind: 'correct', message: 'Correct! Right description, and both strings check out.' };
      return { kind: 'wrong', fields, message: `Not quite. ${msgs.join(' ')}` };
    }
    case 'classify': {
      if (values.type === ref.type) return { kind: 'correct', message: `Correct! G is of type ${ref.type} (${TYPE_NAMES[ref.type]}).` };
      if (values.type === undefined) return { kind: 'constraint', message: 'Choose a type.' };
      return { kind: 'wrong', message: `Not quite. Check type ${values.type} against every production, and the larger types too. The breakdown below shows which checks pass.` };
    }
    case 'possible': {
      if (values.choice === ref.correct) return { kind: 'correct', message: 'Correct!' };
      if (values.choice === undefined) return { kind: 'constraint', message: 'Choose an answer.' };
      return { kind: 'wrong', message: 'Not quite. Think about what a machine with finitely many states can remember.' };
    }
    case 'fill-table': {
      const m = p.given as Machine;
      if (ref.mode === 'table') {
        const fields: Record<string, boolean> = {};
        for (const s of m.states) {
          for (const i of m.input) {
            fields[`f:${s}:${i}`] = values[`f:${s}:${i}`] === (m.delta[s][i] as string);
            if (m.kind === 'mealy') fields[`g:${s}:${i}`] = values[`g:${s}:${i}`] === m.out[s][i];
          }
        }
        const wrong = Object.values(fields).filter((x) => !x).length;
        if (wrong === 0) return { kind: 'correct', message: 'Correct! The table matches the diagram.' };
        return { kind: 'wrong', fields, message: `Not quite: ${wrong} cell${wrong === 1 ? ' is' : 's are'} wrong or empty (highlighted).` };
      }
      return checkSubsetTable(m as NFA, (values.rows as SubsetRowAnswer[] | undefined) ?? []);
    }
    default:
      return { kind: 'constraint', message: 'Nothing to check.' };
  }
}

function checkSubsetTable(m: NFA, rows: SubsetRowAnswer[]): CheckResult {
  const truth = subsetConstruction(m).rows;
  const key = (ids: string[]) => [...ids].sort().join(',');
  const truthBy = new Map(truth.map((r) => [key(r.subset), r]));
  const fields: Record<string, boolean> = {};
  const seen = new Set<string>();
  const msgs: string[] = [];
  const setText = (ids: string[]) => (ids.length ? `{${ids.map((x) => x.replace(/^s(\d+)$/, (_, d) => 's' + [...d].map((c: string) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]).join(''))).join(', ')}}` : '∅');
  rows.forEach((r, idx) => {
    const k = key(r.subset);
    const t = truthBy.get(k);
    if (!t) {
      fields[`row:${idx}`] = false;
      msgs.push(`${setText(r.subset)} isn’t a reachable subset.`);
      return;
    }
    if (seen.has(k)) {
      fields[`row:${idx}`] = false;
      msgs.push(`${setText(r.subset)} appears twice.`);
      return;
    }
    seen.add(k);
    let ok = true;
    for (const i of m.input) {
      const cell = sameSet(r.next[i] ?? [], t.next[i]);
      fields[`cell:${idx}:${i}`] = cell;
      if (!cell) ok = false;
    }
    fields[`final:${idx}`] = r.final === t.final;
    if (r.final !== t.final) ok = false;
    fields[`row:${idx}`] = ok;
    if (!ok) msgs.push(`The row for ${setText(r.subset)} has a mistake.`);
  });
  const missing = truth.filter((t) => !seen.has(key(t.subset)));
  if (missing.length) msgs.push(`${missing.length} reachable subset${missing.length === 1 ? ' is' : 's are'} missing${missing.length === 1 ? '' : ''}. Every subset that appears in a cell needs its own row.`);
  if (msgs.length === 0) return { kind: 'correct', message: `Correct! All ${truth.length} reachable subsets are right.` };
  return { kind: 'wrong', fields, message: `Not quite. ${msgs.slice(0, 3).join(' ')}` };
}

export function checkSubmission(slug: string, submission: unknown, opts: SearchOptions = {}): CheckResult {
  const p = problemBySlug(slug);
  if (!p) throw new Error(`Unknown problem ${slug}`);
  const sub = submission as Submission;
  if (sub.kind === 'machine') return checkMachine(p, sub.doc);
  if (sub.kind === 'grammar') return checkGrammar(p, sub.text, sub.start, opts);
  return checkAnswer(p, sub.values);
}
