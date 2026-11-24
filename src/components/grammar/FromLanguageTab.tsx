// Language → grammar: set-builder text, a pattern library, or (via the machine builder) an FSM.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import SymbolButtons, { lambdaShortcut } from '../SymbolButtons';
import { Link } from 'react-router';
import type { Grammar } from '../../engine/types';
import type { PredicateComparison } from '../../engine/language';
import { parseSetBuilder, texSetBuilder } from '../../engine/set-builder';
import { buildPattern, PATTERNS } from '../../engine/patterns';
import { classify, TYPE_NAMES } from '../../engine/classify';
import { machineToDoc, type MachineDoc } from '../../store/machineDoc';
import { useJob } from '../../workers/client';
import { Tex } from '../Tex';
import { Diagram } from '../machine/Diagram';
import { GrammarForm } from '../practice/GivenView';

interface SynthResult {
  error?: string;
  grammar?: Grammar;
  note?: string;
  check?: PredicateComparison;
}

function GrammarResult({ g, onUse, children }: { g: Grammar; onUse: (g: Grammar) => void; children?: ReactNode }) {
  const c = classify(g);
  return (
    <div className="stack result-card">
      <GrammarForm g={g} />
      <p className="small">This grammar is of type {c.type} ({TYPE_NAMES[c.type]}).</p>
      {children}
      <div className="row">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => onUse(g)}>Use this grammar</button>
      </div>
    </div>
  );
}

const EXAMPLES = ['{0^n 1^n | n ≥ 1}', '{0^n 1^m | m > n ≥ 0}', '{a^n b^m c^{n+m} | n, m ≥ 0}', '{0^m 1^n | m ≠ n}', '{(01)^n | n ≥ 1}', '{0^n 1^n 2^n | n ≥ 1}'];

function SetBuilderSection({ onUse }: { onUse: (g: Grammar) => void }) {
  const [text, setText] = useState(EXAMPLES[1]);
  const sbRef = useRef<HTMLInputElement>(null);
  const job = useJob<SynthResult>();
  const parsed = useMemo(() => parseSetBuilder(text), [text]);
  const r = job.result;
  return (
    <section className="stack" aria-labelledby="sb-h">
      <h3 id="sb-h" className="h-sm">From set-builder notation</h3>
      <p className="small muted">
        Strings of blocks with exponents, then conditions: <code>{'{0^n 1^m | m > n ≥ 0}'}</code>. Exponents can be
        n, 2n, n+m or n+1; conditions can use =, ≠, &lt;, ≤, &gt;, ≥ (or &gt;=, &lt;=, !=). Variables range over ℕ.
      </p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (!('error' in parsed)) void job.start({ type: 'synth', text, timeLimitMs: 10000 }).catch(() => {}); }}>
        <label className="sr-only" htmlFor="sb-text">Language in set-builder notation</label>
        <input id="sb-text" ref={sbRef} type="text" className="mono" style={{ flex: 1, minWidth: 0 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={lambdaShortcut(text, setText)} spellCheck={false} />
        <SymbolButtons target={sbRef} value={text} onChange={setText} symbols={['λ', '≥', '≤', '≠', '|']} />
        <button type="submit" className="btn btn-sm btn-primary" disabled={'error' in parsed || job.running}>Build grammar</button>
      </form>
      <div className="row xsmall">
        <span className="muted">Examples:</span>
        {EXAMPLES.map((x) => <button key={x} type="button" className="link-btn mono" onClick={() => setText(x)}>{x}</button>)}
      </div>
      {'error' in parsed ? <p className="xsmall reject">{parsed.error}</p> : <Tex display>{`L = ${texSetBuilder(parsed.sb)}`}</Tex>}
      {job.slow && <div className="row small" role="status"><span>Building and checking…</span><button type="button" className="btn btn-sm" onClick={job.cancel}>Cancel</button></div>}
      {job.error && <p className="small reject">{job.error}</p>}
      <div aria-live="polite">
        {r?.error && <p className="small reject">{r.error}</p>}
        {r?.grammar && (
          <GrammarResult g={r.grammar} onUse={onUse}>
            {r.note && <p className="xsmall muted">{r.note}</p>}
            {r.check?.kind === 'equal' && <p className="small accept">✓ L(G) agrees with L on every string up to length {r.check.checkedUpTo}.</p>}
            {r.check && r.check.kind !== 'equal' && (
              <p className="small reject">
                {r.check.kind === 'inconclusive' ? r.check.message : `✗ The grammar and L disagree on ${(r.check.word.length ? r.check.word.join('') : 'λ')}. Please report this.`}
              </p>
            )}
          </GrammarResult>
        )}
      </div>
    </section>
  );
}

function PatternSection({ onUse, onOpenMachine }: { onUse: (g: Grammar) => void; onOpenMachine: (doc: MachineDoc) => void }) {
  const [alphabet, setAlphabet] = useState('0, 1');
  const [id, setId] = useState('ends');
  const def = PATTERNS.find((p) => p.id === id)!;
  const [params, setParams] = useState<Record<string, string>>({});
  const I = alphabet.split(/[\s,]+/).filter(Boolean);
  const value = (name: string, fallback: string) => params[`${id}:${name}`] ?? fallback;
  const vals = Object.fromEntries(def.params.map((p) => [p.name, value(p.name, p.kind === 'symbol' ? I[0] ?? p.default : p.kind === 'symbol2' ? I[1] ?? p.default : p.default)]));
  const r = useMemo(() => buildPattern(id, I, vals), [id, alphabet, JSON.stringify(vals)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="stack" aria-labelledby="pat-h">
      <h3 id="pat-h" className="h-sm">From a pattern</h3>
      <p className="small muted">Regular patterns are built as a minimal FSM without output and converted to a regular (type 3) grammar.</p>
      <div className="pattern-form">
        <label className="field">
          <span>Alphabet T</span>
          <input type="text" className="mono" value={alphabet} onChange={(e) => setAlphabet(e.target.value)} />
        </label>
        <label className="field">
          <span>Pattern</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.regular ? '' : ' (not regular)'}</option>)}
          </select>
        </label>
        {def.params.map((p) => (
          <label key={p.name} className="field">
            <span className="math">{p.label}</span>
            {p.kind === 'symbol' || p.kind === 'symbol2' ? (
              <select value={vals[p.name]} onChange={(e) => setParams((x) => ({ ...x, [`${id}:${p.name}`]: e.target.value }))}>
                {I.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <input type={p.kind === 'number' ? 'number' : 'text'} className="mono" value={vals[p.name]} onChange={(e) => setParams((x) => ({ ...x, [`${id}:${p.name}`]: e.target.value }))} style={{ width: p.kind === 'number' ? '5em' : '8em' }} />
            )}
          </label>
        ))}
      </div>
      <div aria-live="polite">
        {'error' in r ? <p className="xsmall reject">{r.error}</p> : (
          <>
            <Tex display>{`L = ${r.tex}`}</Tex>
            <GrammarResult g={r.grammar} onUse={onUse}>
              {r.dfa && (
                <details>
                  <summary>The FSM it came from ({r.dfa.states.length} state{r.dfa.states.length === 1 ? '' : 's'})</summary>
                  <div className="diagram-frame"><Diagram doc={machineToDoc(r.dfa)} title="Minimal FSM without output for the pattern" maxHeight={260} /></div>
                  <button type="button" className="btn btn-sm" onClick={() => onOpenMachine(machineToDoc(r.dfa!))}>Open the FSM in the machine builder</button>
                </details>
              )}
            </GrammarResult>
          </>
        )}
      </div>
    </section>
  );
}

export default function FromLanguageTab({ onUse, onOpenMachine }: { onUse: (g: Grammar) => void; onOpenMachine: (doc: MachineDoc) => void }) {
  return (
    <div className="stack from-language">
      <p className="small">Describe a language L and get a grammar G with L(G) = L. Each grammar is checked against L on short strings.</p>
      <SetBuilderSection onUse={onUse} />
      <PatternSection onUse={onUse} onOpenMachine={onOpenMachine} />
      <section className="stack" aria-labelledby="fsm-h">
        <h3 id="fsm-h" className="h-sm">From an FSM</h3>
        <p className="small">
          Draw an FSM without output in the <Link to="/machines/">machine builder</Link>, then use
          Convert → “Open in the grammar workbench”. It applies the course construction: one non-terminal per
          state, X → aY for each f(s_X, a) = s_Y, and X → a when s_Y is final.
        </p>
      </section>
    </div>
  );
}
