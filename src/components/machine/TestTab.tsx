// Simulator: single run with step-through, saved tests, batch test and language preview.
import { useEffect, useMemo, useRef, useState } from 'react';
import SymbolButtons, { lambdaShortcut } from '../SymbolButtons';
import type { DFA, Mealy, NFA, Sym } from '../../engine/types';
import { acceptedUpTo, hasErrors, runDeterministic, runNondeterministic, validate } from '../../engine/fsm';
import { isMultiChar, parseWord, plainName, showWord } from '../../engine/notation';
import { docToMachine } from '../../store/machineDoc';
import { noSim } from '../../store/machineStore';
import { useEditor, useMachine } from './EditorContext';

interface Frame {
  /** States occupied after reading `pos` symbols. */
  states: string[];
  output: Sym[];
}

export default function TestTab() {
  const { store } = useEditor();
  const doc = useMachine((s) => s.doc);
  const traceRequest = useMachine((s) => s.traceRequest);
  const m = useMemo(() => docToMachine(doc), [doc]);
  const issues = useMemo(() => validate(m), [m]);
  const blocked = hasErrors(issues);
  const multi = isMultiChar(doc.input);
  const nm = (id: string) => plainName(doc.states.find((s) => s.id === id)?.name ?? id);
  const setNames = (ids: string[]) => (ids.length ? `{${ids.map(nm).join(', ')}}` : '∅');

  const [text, setText] = useState('');
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [batch, setBatch] = useState('');
  const [n, setN] = useState(6);
  const [copied, setCopied] = useState(false);
  const [ran, setRan] = useState(false);
  const pulseNonce = useRef(0);
  const xRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLTextAreaElement>(null);

  const parsed = parseWord(text, doc.input);
  const word = parsed.word;

  const run = useMemo(() => {
    if (blocked || parsed.error) return null;
    if (m.kind === 'nfa') return { kind: 'set' as const, r: runNondeterministic(m, word) };
    return { kind: 'det' as const, r: runDeterministic(m as DFA | Mealy, word) };
  }, [m, word, blocked, parsed.error]);  

  const frames: Frame[] = useMemo(() => {
    if (!run || m.start === null) return [];
    if (run.kind === 'set') return [{ states: [m.start], output: [] }, ...run.r.steps.map((s) => ({ states: s.after, output: [] }))];
    const out: Sym[] = [];
    return [{ states: [m.start], output: [] }, ...run.r.steps.map((s) => {
      if (s.out !== undefined) out.push(s.out);
      return { states: [s.after], output: [...out] };
    })];
  }, [run, m.start]);

  const n_ = word.length;
  const atEnd = run !== null && pos >= n_;

  // Reset the stepper when the input or machine changes.
  useEffect(() => {
    setPos(0);
    setPlaying(false);
    setRan(false);
  }, [text, doc]);

  useEffect(() => {
    if (traceRequest) {
      setText(traceRequest.word);
      setPos(0);
    }
  }, [traceRequest]);

  // Push highlights to the canvas.
  useEffect(() => {
    const st = store.getState();
    if (!run || frames.length === 0) {
      st.setSim(noSim);
      return;
    }
    const k = Math.min(pos, n_);
    const active = frames[k].states;
    const flash = k > 0 ? (() => {
      const sym = word[k - 1];
      const before = frames[k - 1].states;
      return doc.trans
        .filter((t) => before.includes(t.from) && t.input === sym && active.includes(t.to))
        .map((t) => ({ from: t.from, to: t.to, nonce: k }));
    })() : [];
    let pulse = null;
    if (k === n_ && (n_ > 0 || ran)) {
      if (m.kind !== 'mealy') {
        const accepted = run.r.accepted;
        pulse = { states: active.length ? active : [], result: accepted ? 'accept' as const : 'reject' as const, nonce: ++pulseNonce.current };
      }
    }
    st.setSim({ active, flash, pulse });
  }, [pos, frames, ran]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => store.getState().setSim(noSim), [store]);

  useEffect(() => {
    if (!playing) return;
    if (pos >= n_) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPos((p) => p + 1), speed);
    return () => clearTimeout(t);
  }, [playing, pos, n_, speed]);

  const resultLine = (() => {
    if (!run || !atEnd) return null;
    const x = showWord(word, multi);
    if (run.kind === 'set') {
      const fin = setNames(run.r.final);
      return run.r.accepted
        ? { ok: true, text: `Accepted: f(s₀, ${x}) = ${fin}, which meets F.` }
        : { ok: false, text: `Rejected: f(s₀, ${x}) = ${fin}, which is disjoint from F.` };
    }
    if (m.kind === 'mealy') return { ok: null, text: `Output: ${showWord(run.r.output, isMultiChar(doc.output))}` };
    return run.r.accepted
      ? { ok: true, text: `Accepted: f(s₀, ${x}) = ${nm(run.r.final)} ∈ F` }
      : { ok: false, text: `Rejected: f(s₀, ${x}) = ${nm(run.r.final)} ∉ F` };
  })();

  const traceRows = run ? (run.kind === 'set'
    ? run.r.steps.map((s) => [String(s.k), s.sym, setNames(s.before), setNames(s.after), ''])
    : run.r.steps.map((s) => [String(s.k), s.sym, nm(s.before), nm(s.after), s.out ?? ''])) : [];
  const traceText = () => {
    const head = m.kind === 'mealy' ? 'k\tread\tstate\tf(…)\tg(…)' : 'k\tread\tstate(s)\tf(…)';
    return [head, ...traceRows.slice(0, pos).map((r) => (m.kind === 'mealy' ? r : r.slice(0, 4)).join('\t'))].join('\n');
  };

  const tests = doc.tests ?? [];
  const evalString = (s: string): { ok: boolean | null; text: string } => {
    const p = parseWord(s, doc.input);
    if (p.error) return { ok: null, text: p.error };
    if (blocked) return { ok: null, text: '—' };
    if (m.kind === 'nfa') return runNondeterministic(m as NFA, p.word).accepted ? { ok: true, text: 'accepted' } : { ok: false, text: 'rejected' };
    const r = runDeterministic(m as DFA | Mealy, p.word);
    if (m.kind === 'mealy') return { ok: null, text: showWord(r.output, isMultiChar(doc.output)) };
    return r.accepted ? { ok: true, text: 'accepted' } : { ok: false, text: 'rejected' };
  };

  const preview = useMemo(() => (blocked || m.kind === 'mealy' ? null : acceptedUpTo(m as DFA | NFA, n)), [m, n, blocked]);

  return (
    <div className="stack test-tab">
      {blocked && (
        <p className="inline-msg" role="status">
          The machine has errors (listed under the canvas), so it can’t run yet.
        </p>
      )}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); setPlaying(false); setRan(true); setPos(n_); }}>
        <label className="field">
          <span>Input string x</span>
          <span className="row">
            <input ref={xRef} type="text" className="mono" style={{ flex: 1, minWidth: 0 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={lambdaShortcut(text, setText)} placeholder="e.g. 0110 (empty means λ)" spellCheck={false} autoComplete="off" />
            <SymbolButtons target={xRef} value={text} onChange={setText} />
          </span>
        </label>
        {multi && <p className="xsmall muted">Separate symbols with spaces, because some symbols in I have more than one character.</p>}
        {parsed.error && <p className="xsmall reject" role="alert">{parsed.error}</p>}
        <div className="row sim-controls">
          <button type="button" className="btn btn-sm" onClick={() => { setPlaying(false); setPos(0); }} disabled={!run} aria-label="Reset">⏮ Reset</button>
          <button type="button" className="btn btn-sm" onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} disabled={!run || pos === 0} aria-label="Back one step">◀ Back</button>
          <button type="button" className="btn btn-sm" onClick={() => { setPlaying(false); setPos((p) => Math.min(n_, p + 1)); }} disabled={!run || atEnd} aria-label="Step forward">▶ Step</button>
          <button type="button" className="btn btn-sm" onClick={() => { if (atEnd) setPos(0); setPlaying((p) => !p); }} disabled={!run || n_ === 0} aria-label={playing ? 'Pause' : 'Play'}>⏯ {playing ? 'Pause' : 'Play'}</button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={!run}>Run</button>
        </div>
        <label className="row xsmall muted">
          Speed
          <input type="range" min={150} max={1500} step={50} value={1650 - speed} onChange={(e) => setSpeed(1650 - Number(e.target.value))} aria-label="Playback speed" />
        </label>
      </form>

      {run && (
        <div className="tapes">
          <div className="tape" aria-label="Input tape">
            {word.length === 0 && <span className="tape-cell empty">λ</span>}
            {word.map((s, i) => (
              <span key={i} className={`tape-cell${i === pos ? ' current' : i < pos ? ' read' : ''}`}>{s}</span>
            ))}
          </div>
          {m.kind === 'mealy' && (
            <div className="tape output" aria-label="Output tape">
              {word.map((_, i) => (
                <span key={i} className={`tape-cell${i < pos ? '' : ' pending'}`}>{i < pos ? frames[pos]?.output[i] ?? '' : ''}</span>
              ))}
            </div>
          )}
          <p className="small">
            {m.kind === 'nfa'
              ? <>f(s₀, {showWord(word.slice(0, pos), multi)}) = {setNames(frames[Math.min(pos, n_)]?.states ?? [])}</>
              : <>Current state: {nm(frames[Math.min(pos, n_)]?.states[0] ?? '')}</>}
          </p>
          <div aria-live="polite">
            {resultLine && (
              <p className={`result ${resultLine.ok === true ? 'accept' : resultLine.ok === false ? 'reject' : ''}`}>
                {resultLine.ok === true ? '✓ ' : resultLine.ok === false ? '✗ ' : ''}{resultLine.text}
              </p>
            )}
          </div>
          {pos > 0 && (
            <details className="trace">
              <summary>Trace table ({pos} step{pos === 1 ? '' : 's'})</summary>
              <table>
                <thead>
                  <tr>
                    <th>k</th><th>read</th><th>{m.kind === 'nfa' ? 'states' : 'state'}</th><th>f(…)</th>
                    {m.kind === 'mealy' && <th>g(…)</th>}
                  </tr>
                </thead>
                <tbody>
                  {traceRows.slice(0, pos).map((r) => (
                    <tr key={r[0]}>
                      <td>{r[0]}</td><td className="mono">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                      {m.kind === 'mealy' && <td className="mono">{r[4]}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-sm" onClick={() => {
                void navigator.clipboard?.writeText(traceText()).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}>{copied ? 'Copied' : 'Copy as text'}</button>
            </details>
          )}
        </div>
      )}

      <section className="stack">
        <div className="row">
          <h3 className="h-sm">Saved tests</h3>
          <span className="spacer" />
          <button type="button" className="btn btn-sm" disabled={tests.includes(text)} onClick={() => store.getState().update((d) => ({ ...d, tests: [...(d.tests ?? []), text] }))}>
            Save current string
          </button>
        </div>
        {tests.length === 0 ? <p className="xsmall muted">Saved strings re-run as you edit the machine.</p> : (
          <ul className="test-list">
            {tests.map((t) => {
              const r = evalString(t);
              return (
                <li key={t} className="row">
                  <span className={`badge ${r.ok === true ? 'badge-accept' : r.ok === false ? 'badge-reject' : ''}`}>
                    {r.ok === true ? '✓' : r.ok === false ? '✗' : '→'}
                  </span>
                  <button type="button" className="link-btn mono" onClick={() => setText(t)}>{t === '' ? 'λ' : t}</button>
                  <span className="xsmall muted">{r.text}</span>
                  <span className="spacer" />
                  <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove ${t || 'λ'}`} onClick={() => store.getState().update((d) => ({ ...d, tests: (d.tests ?? []).filter((x) => x !== t) }))}>×</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="stack">
        <summary>Batch test</summary>
        <div className="row"><span className="xsmall muted">One string per line; λ or an empty line is the empty string.</span><span className="spacer" /><SymbolButtons target={batchRef} value={batch} onChange={setBatch} /></div>
        <textarea ref={batchRef} rows={5} className="mono" value={batch} onChange={(e) => setBatch(e.target.value)} onKeyDown={lambdaShortcut(batch, setBatch)} placeholder={'One string per line\nλ\n0101'} aria-label="Strings to test, one per line" />
        {batch.trim() && (
          <ul className="test-list">
            {batch.split(/\r?\n/).filter((l, i, a) => l.trim() !== '' || i < a.length - 1).map((line, i) => {
              const r = evalString(line.trim());
              return (
                <li key={i} className="row">
                  <span className={`badge ${r.ok === true ? 'badge-accept' : r.ok === false ? 'badge-reject' : ''}`}>{r.ok === true ? '✓' : r.ok === false ? '✗' : '→'}</span>
                  <span className="mono">{line.trim() === '' ? 'λ' : line.trim()}</span>
                  <span className="xsmall muted">{r.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </details>

      {m.kind !== 'mealy' && (
        <details className="stack" open>
          <summary>Accepted strings up to length {n}</summary>
          <label className="row xsmall">
            n =
            <input type="number" min={0} max={12} value={n} onChange={(e) => setN(Math.max(0, Math.min(12, Number(e.target.value) || 0)))} aria-label="Maximum length" style={{ width: '5em' }} />
          </label>
          {preview && (
            <>
              <p className="xsmall muted">{preview.words.length}{preview.truncated ? '+' : ''} string{preview.words.length === 1 ? '' : 's'}, in shortlex order.</p>
              <p className="word-list mono">
                {preview.words.length === 0 ? <span className="muted">None.</span> : preview.words.map((w) => showWord(w, multi)).join(', ')}
              </p>
            </>
          )}
        </details>
      )}
    </div>
  );
}
