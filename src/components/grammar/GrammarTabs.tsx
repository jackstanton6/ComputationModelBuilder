// Grammar workbench tabs: Type · Words · Derive · Test · Convert · Export.
import { useMemo, useRef, useState } from 'react';
import SymbolButtons, { lambdaShortcut } from '../SymbolButtons';
import type { Grammar, Production, Sym } from '../../engine/types';
import { classify, TYPE_NAMES, type GrammarType } from '../../engine/classify';
import { isContextFree, nonTerminals, showProduction, showSyms, tokenise } from '../../engine/grammar';
import { applyAt, occurrences, showDerivation, type Derivation } from '../../engine/derivation';
import { kleeneGrammarToNfa } from '../../engine/conversions';
import { derivationLatex, grammarLatex } from '../../engine/latex';
import type { Membership } from '../../engine/language';
import { machineToDoc } from '../../store/machineDoc';
import { useJob } from '../../workers/client';
import { Diagram } from '../machine/Diagram';
import { CopyBlock } from '../CopyBlock';
import DerivationView, { FormText } from './DerivationView';

export function TypeTab({ g }: { g: Grammar }) {
  const c = useMemo(() => classify(g), [g]);
  const order: GrammarType[] = [3, 2, 1, 0];
  return (
    <div className="stack">
      <p className="type-result" aria-live="polite">G is of <strong>type {c.type}</strong> ({TYPE_NAMES[c.type]}).</p>
      <ul className="checklist" aria-label="Per-type checklist">
        {order.map((k) => {
          const ch = c.checks[k];
          return (
            <li key={k}>
              <span className={ch.ok ? 'accept' : 'reject'} aria-hidden="true">{ch.ok ? '✓' : '✗'}</span>
              <div>
                <strong>Type {k}</strong> <span className="muted">({TYPE_NAMES[k]})</span>
                <span className="sr-only">{ch.ok ? ' passes' : ' fails'}</span>
                {!ch.ok && ch.reason && <div className="small">{ch.reason}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      {c.notes.map((n, i) => <p key={i} className="small muted">{n}</p>)}
      <details>
        <summary>The course’s table</summary>
        <table className="type-table">
          <thead><tr><th>Type</th><th>Restrictions on w₁ → w₂</th></tr></thead>
          <tbody>
            <tr><td>0</td><td>No restrictions beyond the grammar definition</td></tr>
            <tr><td>1</td><td>w₁ = lAr, w₂ = lwr with A ∈ N, l, r, w ∈ V⋆, w ≠ λ; or w₁ = S, w₂ = λ if S is on no right-hand side</td></tr>
            <tr><td>2</td><td>w₁ = A with A ∈ N</td></tr>
            <tr><td>3</td><td>w₁ = A and w₂ = aB or w₂ = a (A, B ∈ N, a ∈ T); or w₁ = S, w₂ = λ</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Progress({ job, label }: { job: { slow: boolean; progress: number; cancel: () => void }; label: string }) {
  if (!job.slow) return null;
  return (
    <div className="row small" role="status">
      <span>{label}{job.progress ? ` (${job.progress.toLocaleString('en-AU')} forms explored)` : ''}…</span>
      <button type="button" className="btn btn-sm" onClick={job.cancel}>Cancel</button>
    </div>
  );
}

function WordDerivation({ g, word }: { g: Grammar; word: Sym[] }) {
  const job = useJob<Membership>();
  const [asked, setAsked] = useState(false);
  return (
    <details onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && !asked) {
        setAsked(true);
        void job.start({ type: 'membership', grammar: g, word, timeLimitMs: 10000 });
      }
    }}>
      <summary className="mono">{showSyms(word)}</summary>
      <Progress job={job} label="Searching" />
      {job.result?.derivation && <DerivationView d={job.result.derivation} />}
      {job.error && <p className="small reject">{job.error}</p>}
    </details>
  );
}

export function WordsTab({ g }: { g: Grammar }) {
  const [n, setN] = useState(6);
  const job = useJob<{ words: Sym[][]; complete: boolean }>();
  const run = () => void job.start({ type: 'words', grammar: g, n, timeLimitMs: 10000 });
  const cf = isContextFree(g);
  return (
    <div className="stack">
      <form className="row" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label className="row small">
          Words of L(G) up to length n =
          <input type="number" min={0} max={12} value={n} onChange={(e) => setN(Math.max(0, Math.min(12, Number(e.target.value) || 0)))} style={{ width: '5em' }} />
        </label>
        <button type="submit" className="btn btn-sm btn-primary" disabled={job.running}>List words</button>
      </form>
      <p className="xsmall muted">{cf ? 'Uses an Earley parser over T⋆, so the list is exact.' : 'Uses a bounded search over sentential forms.'}</p>
      <Progress job={job} label="Listing" />
      {job.error && <p className="small reject">{job.error}</p>}
      {job.result && (
        <>
          <p className="small" aria-live="polite">
            {job.result.words.length} word{job.result.words.length === 1 ? '' : 's'} of length ≤ {n}, in shortlex order.
            {!job.result.complete && <span className="reject"> The search limit was hit, so some words may be missing.</span>}
          </p>
          <ul className="test-list">
            {job.result.words.slice(0, 500).map((w) => <li key={w.join(' ')}><WordDerivation g={g} word={w} /></li>)}
          </ul>
          {job.result.words.length > 500 && <p className="xsmall muted">Showing the first 500.</p>}
        </>
      )}
    </div>
  );
}

export function DeriveTab({ g, derivation, setDerivation }: { g: Grammar; derivation: Derivation; setDerivation: (d: Derivation) => void }) {
  const cf = isContextFree(g);
  const [leftmost, setLeftmost] = useState(false);
  const [pending, setPending] = useState<Production | null>(null);
  const N = useMemo(() => new Set(nonTerminals(g)), [g]);
  const form = derivation.forms[derivation.forms.length - 1];
  const leftmostPos = form.findIndex((s) => N.has(s));
  const placesFor = (p: Production) => {
    const occ = occurrences(form, p.lhs);
    return leftmost && cf ? occ.filter((i) => i === leftmostPos) : occ;
  };
  const apply = (p: Production, pos: number) => {
    setDerivation({ forms: [...derivation.forms, applyAt(form, p, pos)], steps: [...derivation.steps, { prod: p, pos }] });
    setPending(null);
  };
  const choose = (p: Production) => {
    const places = placesFor(p);
    if (places.length === 1) apply(p, places[0]);
    else setPending(p);
  };
  const applicable = g.P.filter((p) => placesFor(p).length > 0);
  const done = form.every((s) => !N.has(s));
  // Positions covered by some applicable occurrence.
  const covered = new Set<number>();
  for (const p of applicable) for (const i of placesFor(p)) for (let j = 0; j < p.lhs.length; j++) covered.add(i + j);
  const pendingPlaces = pending ? placesFor(pending) : [];

  return (
    <div className="stack">
      <DerivationView d={derivation} />
      <div className="small">
        <span className="muted">Current form: </span>
        <span className="mono">
          {form.length === 0 ? 'λ' : form.map((s, i) => {
            const start = pendingPlaces.includes(i);
            if (start && pending) {
              return (
                <button key={i} type="button" className="occurrence" onClick={() => apply(pending, i)} aria-label={`Apply ${showProduction(pending)} at position ${i + 1}`}>
                  {form.slice(i, i + pending.lhs.length).join('')}
                </button>
              );
            }
            if (pending && pendingPlaces.some((p) => i > p && i < p + pending.lhs.length)) return null;
            return <span key={i} style={covered.has(i) ? { textDecoration: 'underline dotted var(--accent)', textUnderlineOffset: 3 } : undefined}>{s}</span>;
          })}
        </span>
      </div>
      {pending && <p className="xsmall muted">Choose where to apply {showProduction(pending)} (dashed boxes).</p>}
      {done ? (
        <p className="result accept btn-pulse" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius)' }} key={derivation.forms.length} aria-live="polite">
          ✓ Derived a word in L(G): {form.length ? form.join('') : 'λ'}
        </p>
      ) : (
        <div className="prod-chips" role="group" aria-label="Productions">
          {g.P.map((p, i) => (
            <button key={i} type="button" className="btn btn-sm" aria-pressed={pending === p} disabled={placesFor(p).length === 0} onClick={() => choose(p)}>
              {showProduction(p)}
            </button>
          ))}
        </div>
      )}
      {!done && applicable.length === 0 && <p className="small reject">No production applies to this form. Undo a step or reset.</p>}
      <div className="row">
        <button type="button" className="btn btn-sm" disabled={derivation.steps.length === 0} onClick={() => setDerivation({ forms: derivation.forms.slice(0, -1), steps: derivation.steps.slice(0, -1) })}>Undo step</button>
        <button type="button" className="btn btn-sm" onClick={() => { setDerivation({ forms: [[g.S]], steps: [] }); setPending(null); }}>Reset</button>
        <button type="button" className="btn btn-sm" disabled={done || applicable.length === 0} onClick={() => {
          const options = applicable.flatMap((p) => placesFor(p).map((pos) => ({ p, pos })));
          const pick = options[Math.floor(Math.random() * options.length)];
          apply(pick.p, pick.pos);
        }}>Random step</button>
        <label className="check small" title={cf ? 'Only offer the leftmost non-terminal' : 'Only for context-free grammars'}>
          <input type="checkbox" checked={leftmost && cf} disabled={!cf} onChange={(e) => setLeftmost(e.target.checked)} />
          Leftmost
        </label>
      </div>
    </div>
  );
}

function parseTerminalString(text: string, g: Grammar): { word: Sym[]; error?: string } {
  const t = tokenise(text);
  if (t.error) return { word: [], error: t.error };
  const bad = t.syms.find((s) => !g.T.includes(s));
  if (bad) return { word: t.syms, error: `“${bad}” isn't in T = {${g.T.join(', ')}}.` };
  return { word: t.syms };
}

export function TestTabG({ g }: { g: Grammar }) {
  const [text, setText] = useState('');
  const [batch, setBatch] = useState('');
  const wRef = useRef<HTMLInputElement>(null);
  const job = useJob<Membership & { timedOut?: boolean }>();
  const [asked, setAsked] = useState<string | null>(null);
  const parsed = parseTerminalString(text, g);
  const run = () => {
    if (parsed.error) return;
    setAsked(text);
    void job.start({ type: 'membership', grammar: g, word: parsed.word, timeLimitMs: 10000 });
  };
  const r = job.result;
  const w = asked !== null ? (asked.trim() === '' ? 'λ' : parseTerminalString(asked, g).word.join('')) : '';
  return (
    <div className="stack">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label className="field">
          <span>Is w ∈ L(G)? Enter w ∈ T⋆</span>
          <div className="row">
            <input ref={wRef} type="text" className="mono" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={lambdaShortcut(text, setText)} placeholder="e.g. 0011 (empty means λ)" spellCheck={false} />
            <SymbolButtons target={wRef} value={text} onChange={setText} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!!parsed.error || job.running}>Test</button>
          </div>
        </label>
        {parsed.error && <p className="xsmall reject">{parsed.error}</p>}
      </form>
      <Progress job={job} label="Searching" />
      {job.error && <p className="small reject">{job.error}</p>}
      <div aria-live="polite">
        {r && asked !== null && (
          r.member === true ? (
            <div className="stack">
              <p className="result accept">✓ {w} ∈ L(G)</p>
              {r.derivation && <DerivationView d={r.derivation} />}
              {r.method === 'earley' && <p className="xsmall muted">Leftmost derivation found by an Earley parser.</p>}
            </div>
          ) : r.member === false ? (
            <p className="result reject">✗ {w} ∉ L(G){r.method === 'search' ? ' (the search covered every sentential form no longer than w).' : '.'}</p>
          ) : (
            <p className="result">Not found within the search limit. Type 0 membership can’t be decided in general.</p>
          )
        )}
      </div>
      <details className="stack">
        <summary>Batch mode</summary>
        <BatchMembership g={g} text={batch} setText={setBatch} />
      </details>
    </div>
  );
}

function BatchMembership({ g, text, setText }: { g: Grammar; text: string; setText: (s: string) => void }) {
  const [results, setResults] = useState<{ w: string; r: string; ok: boolean | null }[]>([]);
  const bRef = useRef<HTMLTextAreaElement>(null);
  const job = useJob<Membership>();
  const runAll = async () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const out: typeof results = [];
    for (const line of lines.filter((l, i) => l !== '' || i < lines.length - 1)) {
      const p = parseTerminalString(line, g);
      if (p.error) {
        out.push({ w: line || 'λ', r: p.error, ok: null });
        continue;
      }
      try {
        const m = await job.start({ type: 'membership', grammar: g, word: p.word, timeLimitMs: 4000 });
        out.push({ w: line || 'λ', r: m.member === true ? '∈ L(G)' : m.member === false ? '∉ L(G)' : 'search limit hit', ok: m.member });
      } catch {
        out.push({ w: line || 'λ', r: 'stopped', ok: null });
      }
      setResults([...out]);
    }
  };
  return (
    <div className="stack">
      <div className="row"><span className="xsmall muted">One string per line; λ or an empty line is the empty string.</span><span className="spacer" /><SymbolButtons target={bRef} value={text} onChange={setText} /></div>
      <textarea ref={bRef} rows={5} className="mono" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={lambdaShortcut(text, setText)} placeholder={'One string per line\n0011\n010'} aria-label="Strings to test, one per line" />
      <button type="button" className="btn btn-sm" onClick={() => void runAll()} disabled={!text.trim() || job.running}>Test all</button>
      <ul className="test-list">
        {results.map((x, i) => (
          <li key={i} className="row">
            <span className={`badge ${x.ok === true ? 'badge-accept' : x.ok === false ? 'badge-reject' : ''}`}>{x.ok === true ? '✓' : x.ok === false ? '✗' : '?'}</span>
            <span className="mono">{x.w}</span>
            <span className="xsmall muted">{x.r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConvertTabG({ g, onOpenMachine }: { g: Grammar; onOpenMachine: (doc: ReturnType<typeof machineToDoc>) => void }) {
  const c = useMemo(() => classify(g), [g]);
  const nfa = useMemo(() => (c.checks[3].ok ? kleeneGrammarToNfa(g) : null), [g, c]);
  return (
    <div className="stack">
      <h3 className="h-sm">Regular grammar → non-deterministic FSM (Kleene’s construction)</h3>
      <p className="small muted">One state s_A for each non-terminal A, with start state s_S, plus a final state s_F. s_S is also final if S → λ ∈ P. A → a gives s_A → s_F on a, and A → aB gives s_A → s_B on a.</p>
      {!nfa ? (
        <p className="inline-msg">This construction needs a type 3 grammar. {c.checks[3].reason}</p>
      ) : (
        <>
          <div className="diagram-frame"><Diagram doc={machineToDoc(nfa)} title="Non-deterministic FSM from Kleene’s construction" maxHeight={300} /></div>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onOpenMachine(machineToDoc(nfa))}>Open in the machine builder</button>
        </>
      )}
    </div>
  );
}

export function ExportTabG({ g, derivation }: { g: Grammar; derivation: Derivation }) {
  return (
    <div className="stack">
      <CopyBlock label="Grammar G = (V, T, S, P)" text={grammarLatex(g)} filename="grammar.tex" />
      {derivation.steps.length > 0 ? (
        <CopyBlock label={`Derivation (${showDerivation(derivation)})`} text={derivationLatex(derivation)} filename="derivation.tex" />
      ) : (
        <p className="small muted">Build a derivation in the Derive tab to export it as a ⇒ chain.</p>
      )}
      <p className="xsmall muted">The grammar export uses the aligned environment from amsmath.</p>
    </div>
  );
}

export { FormText };
