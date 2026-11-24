// The interactive part of a problem page: workspace, Check, Hints, Solution, Next.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Grammar, Machine, MachineKind } from '../../engine/types';
import { parseGrammar } from '../../engine/grammar';
import { classify } from '../../engine/classify';
import type { Problem } from '../../problems/types';
import { isGrammar, isMachine } from '../../problems/types';
import type { CheckResult, Submission } from '../../problems/checker';
import { emptyDoc, machineToDoc, type MachineDoc } from '../../store/machineDoc';
import { createMachineStore } from '../../store/machineStore';
import { readJSON, setLastVisit, writeJSON } from '../../store/persist';
import { updateProgress, useProgress } from '../../store/progress';
import { useJob } from '../../workers/client';
import { useConfirm } from '../Confirm';
import { Inline, Markdown } from '../Tex';
import MachineEditor from '../machine/MachineEditor';
import { Diagram } from '../machine/Diagram';
import StaticTable from '../machine/StaticTable';
import GrammarEditor from '../grammar/GrammarEditor';
import DerivationView from '../grammar/DerivationView';
import { TypeTab } from '../grammar/GrammarTabs';
import { GrammarForm } from './GivenView';
import { ClassifyWorkspace, DescribeWorkspace, FillTableWorkspace, PossibleWorkspace, SubsetWorkspace, TraceWorkspace } from './AnswerWorkspaces';
import { subsetConstruction } from '../../engine/nfa';
import { plainName, stateName } from '../../engine/notation';
import { problems } from '../../problems';

function kindsFor(p: Problem): MachineKind[] {
  const k = p.constraints?.machineKind ?? (isMachine(p.reference) ? p.reference.kind : 'dfa');
  return k === 'dfa-or-nfa' ? ['dfa', 'nfa'] : [k];
}

function initialDoc(p: Problem): MachineDoc {
  const kinds = kindsFor(p);
  const kind = kinds.includes('nfa') && p.topic === 'nondeterministic' ? 'nfa' : kinds[0];
  const d = emptyDoc(kind);
  const ref = isMachine(p.reference) ? p.reference : null;
  d.input = p.constraints?.inputAlphabet ?? ref?.input ?? ['0', '1'];
  d.output = p.constraints?.outputAlphabet ?? (ref?.kind === 'mealy' ? ref.output : ['0', '1']);
  return d;
}

function Solution({ p }: { p: Problem }) {
  const ref = p.reference;
  if (isMachine(ref)) {
    return (
      <div className="stack">
        <div className="diagram-frame"><Diagram doc={machineToDoc(ref)} title="Model solution" maxHeight={360} /></div>
        <details><summary>State table</summary><StaticTable m={ref} /></details>
      </div>
    );
  }
  if (isGrammar(ref)) return <GrammarForm g={ref as Grammar} />;
  switch (ref.kind) {
    case 'trace':
      return (
        <ul>
          {ref.fields.map((f) => (
            <li key={f.id}>
              <Inline text={f.label} />{' '}
              <strong>
                {f.type === 'yesno' ? (f.expected ? 'Yes' : 'No')
                  : f.type === 'set' ? (f.expected.length ? `{${f.expected.map((x) => plainName(stateName(p.given as Machine, x))).join(', ')}}` : '∅')
                  : f.type === 'state' ? plainName(stateName(p.given as Machine, f.expected)) : f.expected}
              </strong>
            </li>
          ))}
        </ul>
      );
    case 'describe':
    case 'possible':
      return <p><strong><Inline text={ref.options[ref.correct].text} /></strong></p>;
    case 'classify':
      return <TypeTab g={p.given as Grammar} />;
    case 'fill-table':
      if (ref.mode === 'table') return <StaticTable m={p.given as Machine} />;
      return <StaticTable m={subsetConstruction(p.given as NFAish).dfa} />;
  }
}

type NFAish = Extract<Machine, { kind: 'nfa' }>;

export default function ProblemPlayer({ p }: { p: Problem }) {
  const confirm = useConfirm();
  const progress = useProgress()[p.slug] ?? {};
  const wsKey = `ws:${p.slug}`;
  const isMachineFmt = p.format === 'build-machine';
  const isGrammarFmt = p.format === 'build-grammar';
  const [values, setValues] = useState<Record<string, unknown>>(() => (isMachineFmt ? {} : readJSON(wsKey, {})));
  const [grammarText, setGrammarText] = useState<{ text: string; start: string }>(() => readJSON(wsKey, { text: p.starter ?? '', start: 'S' }));
  const store = useMemo(() => (isMachineFmt ? createMachineStore(readJSON<MachineDoc | null>(wsKey, null) ?? initialDoc(p)) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const job = useJob<CheckResult>();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [pulse, setPulse] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLastVisit({ path: `/practice/${p.slug}/`, label: p.title }), [p.slug, p.title]);

  useEffect(() => {
    if (!store) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = store.subscribe((s, prev) => {
      if (s.doc === prev.doc) return;
      clearTimeout(t);
      t = setTimeout(() => writeJSON(wsKey, s.doc), 250);
    });
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, [store, wsKey]);

  useEffect(() => {
    if (!isMachineFmt && !isGrammarFmt) writeJSON(wsKey, values);
  }, [values, wsKey, isMachineFmt, isGrammarFmt]);
  useEffect(() => {
    if (isGrammarFmt) writeJSON(wsKey, grammarText);
  }, [grammarText, wsKey, isGrammarFmt]);

  const set = (k: string, v: unknown) => {
    setValues((x) => ({ ...x, [k]: v }));
    setResult(null);
  };

  const submission = (): Submission => {
    if (store) return { kind: 'machine', doc: store.getState().doc };
    if (isGrammarFmt) return { kind: 'grammar', ...grammarText };
    return { kind: 'answer', values };
  };

  const check = async () => {
    try {
      const r = await job.start({ type: 'check', slug: p.slug, submission: submission(), timeLimitMs: 10000 });
      setResult(r);
      updateProgress(p.slug, (x) => ({
        ...x,
        attempted: true,
        ...(r.kind === 'correct' && !x.solved ? { solved: true, solvedAfterViewing: !!x.viewed } : {}),
      }));
      if (r.kind === 'correct') setPulse((n) => n + 1);
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } catch {
      /* cancelled or errored; job.error shows */
    }
  };

  const hintCount = progress.hints ?? 0;
  const canSeeSolution = !!progress.attempted || !!progress.viewed;
  const openSolution = async () => {
    if (!canSeeSolution) {
      const ok = await confirm({ title: 'Show the solution?', body: 'You haven’t pressed Check yet. The problem will be marked “Viewed solution”, and solving it afterwards counts as solved after viewing.', confirmLabel: 'Show solution', cancelLabel: 'Keep trying' });
      if (!ok) return;
    }
    updateProgress(p.slug, (x) => ({ ...x, viewed: true }));
    setShowSolution(true);
  };

  const idx = problems.findIndex((q) => q.slug === p.slug);
  const next = problems[idx + 1];
  const grammarParsed = isGrammarFmt ? parseGrammar(grammarText.text, grammarText.start || 'S') : null;
  const solved = result?.kind === 'correct' || !!progress.solved;

  return (
    <div className="stack">
      <section className="workspace" aria-label="Your answer">
        {store && (
          <MachineEditor
            store={store}
            className="embedded"
            options={{ kinds: kindsFor(p), lockAlphabet: true }}
            tabs={['test', 'table', 'definition', 'export']}
            fileBase={p.slug}
          />
        )}
        {isGrammarFmt && grammarParsed && (
          <div className="stack" style={{ maxWidth: 720 }}>
            <GrammarEditor id={`g-${p.slug}`} value={grammarText.text} onChange={(text) => { setGrammarText((g) => ({ ...g, text })); setResult(null); }} errors={grammarParsed.errors} rows={6} />
            <div className="row">
              <label className="small" htmlFor={`start-${p.slug}`}>Start symbol</label>
              <input id={`start-${p.slug}`} type="text" size={4} className="mono" value={grammarText.start} onChange={(e) => setGrammarText((g) => ({ ...g, start: e.target.value.trim() }))} />
              {grammarParsed.errors.length === 0 && grammarParsed.grammar.P.length > 0 && (
                <span className="small muted">Your grammar is type {classify(grammarParsed.grammar).type}.</span>
              )}
            </div>
            {grammarParsed.errors.length === 0 && grammarParsed.grammar.P.length > 0 && <GrammarForm g={grammarParsed.grammar} />}
          </div>
        )}
        {p.format === 'trace' && <TraceWorkspace p={p} values={values} set={set} fields={result?.kind === 'wrong' ? result.fields : undefined} />}
        {p.format === 'describe-language' && <DescribeWorkspace p={p} values={values} set={set} fields={result?.kind === 'wrong' ? result.fields : undefined} />}
        {p.format === 'classify-grammar' && <ClassifyWorkspace p={p} values={values} set={set} fields={undefined} />}
        {p.format === 'possible' && <PossibleWorkspace p={p} values={values} set={set} fields={undefined} />}
        {p.format === 'fill-table' && ('kind' in p.reference && p.reference.kind === 'fill-table' && p.reference.mode === 'subset'
          ? <SubsetWorkspace p={p} values={values} set={set} fields={result?.kind === 'wrong' ? result.fields : undefined} />
          : <FillTableWorkspace p={p} values={values} set={set} fields={result?.kind === 'wrong' ? result.fields : undefined} />)}
      </section>

      <div ref={feedbackRef} tabIndex={-1} aria-live="polite" className="feedback-region">
        {job.slow && (
          <div className="row small" role="status">
            <span>Checking{job.progress ? ` (${job.progress.toLocaleString('en-AU')} forms explored)` : ''}…</span>
            <button type="button" className="btn btn-sm" onClick={job.cancel}>Cancel</button>
          </div>
        )}
        {job.error && <div className="feedback bad"><p>{job.error}</p></div>}
        {result && (
          <div className={`feedback ${result.kind === 'correct' ? 'ok' : result.kind === 'wrong' || result.kind === 'constraint' ? 'bad' : ''}`}>
            <h3 className={result.kind === 'correct' ? 'accept' : result.kind === 'inconclusive' || result.kind === 'timeout' ? '' : 'reject'}> {/* turtleneck: ✓/✗ are text marks required by SPEC §8.3 so colour isn't the only signal */}
              {result.kind === 'correct' ? '✓ ' : result.kind === 'wrong' || result.kind === 'constraint' ? '✗ ' : ''}
              {result.kind === 'timeout' ? 'The check took too long' : result.kind === 'inconclusive' ? 'Inconclusive' : result.kind === 'correct' ? 'Correct!' : 'Not yet'}
            </h3>
            {result.kind === 'timeout' && <p>The check took more than 10 seconds and was stopped. Try a simpler grammar, or one whose productions never shrink the string.</p>}
            {'message' in result && <p><Inline text={result.message.replace(/^Correct! /, '')} /></p>}
            {result.kind === 'wrong' && result.word !== undefined && store && (
              <button type="button" className="btn btn-sm" onClick={() => store.getState().requestTrace(result.word!)}>Trace this string</button>
            )}
            {result.kind === 'wrong' && result.derivation && (
              <details open><summary>Derivation of that string</summary><DerivationView d={result.derivation} /></details>
            )}
            {isGrammarFmt && result.kind !== 'constraint' && result.kind !== 'timeout' && (
              <p className="xsmall muted">Checked against every string up to length {'checkedUpTo' in result && result.checkedUpTo ? result.checkedUpTo : 10}. Passing is strong evidence, not a proof.</p>
            )}
            {p.format === 'classify-grammar' && result.kind !== 'constraint' && <TypeTab g={p.given as Grammar} />}
          </div>
        )}
        {(solved || showSolution) && (
          <div className="feedback">
            <h3>Key idea</h3>
            <Markdown text={p.explanation} />
          </div>
        )}
      </div>

      {hintCount > 0 && (
        <section aria-label="Hints">
          <h3 className="h-sm">Hints</h3>
          <ol className="hints">{p.hints.slice(0, hintCount).map((h, i) => <li key={i}><Inline text={h} /></li>)}</ol>
        </section>
      )}

      {showSolution && (
        <section className="feedback" aria-label="Solution">
          <h3>Model solution</h3>
          <Solution p={p} />
        </section>
      )}

      <div className="check-bar">
        <button type="button" className={`btn btn-primary${pulse ? ' btn-pulse' : ''}`} key={pulse} onClick={() => void check()} disabled={job.running}>
          {job.running ? 'Checking…' : 'Check'}
        </button>
        <button type="button" className="btn" disabled={hintCount >= 3} onClick={() => updateProgress(p.slug, (x) => ({ ...x, hints: Math.min(3, (x.hints ?? 0) + 1) }))}>
          Hint ({hintCount}/3)
        </button>
        {!showSolution && (
          <button type="button" className="btn" onClick={() => void openSolution()}>
            {canSeeSolution ? 'Show solution' : 'I’m stuck — show solution'}
          </button>
        )}
        <span className="spacer" />
        {next ? <Link className="btn" to={`/practice/${next.slug}/`}>Next problem →</Link> : <Link className="btn" to="/practice/">All problems</Link>}
      </div>
    </div>
  );
}
