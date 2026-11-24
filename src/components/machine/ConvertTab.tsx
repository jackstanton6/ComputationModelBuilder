// Conversions: subset construction, FSM → regular grammar, minimise, compare.
import { useMemo, useState } from 'react';
import type { DFA, Mealy, NFA } from '../../engine/types';
import { hasErrors, minimise, validate } from '../../engine/fsm';
import { renameSequential, subsetConstruction } from '../../engine/nfa';
import { dfaToGrammar } from '../../engine/conversions';
import { grammarToText, showP } from '../../engine/grammar';
import { languageDifference, outputDifference } from '../../engine/equivalence';
import { plainName, showWord } from '../../engine/notation';
import { docToMachine, machineToDoc } from '../../store/machineDoc';
import { useEditor, useMachine } from './EditorContext';

function SubsetSection({ m }: { m: NFA }) {
  const { options } = useEditor();
  const [rename, setRename] = useState(false);
  const result = useMemo(() => {
    try {
      return { ok: subsetConstruction(m) } as const;
    } catch (e) {
      return { err: (e as Error).message } as const;
    }
  }, [m]);
  if ('err' in result) return <p className="reject">{result.err}</p>;
  const { rows, dfa } = result.ok!;
  const set = (ids: string[]) => (ids.length ? `{${ids.map((s) => plainName(m.names?.[s] ?? s)).join(', ')}}` : '∅');
  return (
    <section className="stack">
      <h3 className="h-sm">Subset construction</h3>
      <p className="small muted">Each row is a reachable subset V ⊆ S. On input i it goes to the set of states reachable from elements of V on i. A subset is final iff it contains a final state of M.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Subset</th>{m.input.map((i) => <th key={i} className="mono">{i}</th>)}<th>Final?</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subset.join(',')}>
                <th scope="row">{r.subset[0] === m.start && r.subset.length === 1 ? '⟶ ' : ''}{set(r.subset)}</th>
                {m.input.map((i) => <td key={i}>{set(r.next[i])}</td>)}
                <td>{r.final ? 'yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xsmall muted">{rows.length} reachable subset{rows.length === 1 ? '' : 's'} (out of 2^{m.states.length} = {2 ** m.states.length}).</p>
      {options.onOpenAsNew && (
        <div className="row">
          <label className="check small">
            <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} />
            Rename states s₀, s₁, …
          </label>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => {
            if (rename) {
              const r = renameSequential(dfa);
              options.onOpenAsNew!(machineToDoc(r.dfa), 'Subset construction');
            } else {
              options.onOpenAsNew!(machineToDoc(dfa), 'Subset construction');
            }
          }}>Open as new machine</button>
        </div>
      )}
      {rename && (
        <p className="xsmall muted">
          Legend: {renameSequential(dfa).legend.map(([a, b]) => `${plainName(b)} = ${plainName(a)}`).join(', ')}
        </p>
      )}
    </section>
  );
}

function GrammarSection({ m }: { m: DFA }) {
  const { options } = useEditor();
  const g = useMemo(() => dfaToGrammar(m), [m]);
  return (
    <section className="stack">
      <h3 className="h-sm">FSM without output → regular grammar</h3>
      <p className="small muted">One non-terminal per state (S for s₀). For each f(X, a) = Y add X → aY, and also X → a if Y ∈ F. If s₀ ∈ F add S → λ.</p>
      <p className="mono small wrap">P = {showP(g)}</p>
      {options.onOpenGrammar && (
        <button type="button" className="btn btn-sm btn-primary" onClick={() => options.onOpenGrammar!(grammarToText(g))}>Open in the grammar workbench</button>
      )}
    </section>
  );
}

function MinimiseSection({ m }: { m: DFA }) {
  const { options } = useEditor();
  const r = useMemo(() => minimise(m), [m]);
  const nm = (s: string) => plainName(m.names?.[s] ?? s);
  return (
    <section className="stack">
      <h3 className="h-sm">Minimise</h3>
      <p className="xsmall muted">Beyond the lectures, but useful for checking your answers. Uses Moore’s partition refinement.</p>
      {r.alreadyMinimal ? <p className="small accept">✓ Already minimal.</p> : (
        <>
          <p className="small">
            {r.dfa.states.length} state{r.dfa.states.length === 1 ? '' : 's'} instead of {m.states.length}.
            {r.removedUnreachable.length > 0 && <> Removed unreachable: {r.removedUnreachable.map(nm).join(', ')}.</>}
          </p>
          {r.groups.some((g) => g.length > 1) && (
            <p className="small">Merged: {r.groups.filter((g) => g.length > 1).map((g) => `{${g.map(nm).join(', ')}}`).join(', ')}</p>
          )}
          {options.onOpenAsNew && (
            <button type="button" className="btn btn-sm" onClick={() => options.onOpenAsNew!(machineToDoc(r.dfa), 'Minimised')}>Open as new machine</button>
          )}
        </>
      )}
    </section>
  );
}

function CompareSection({ m }: { m: DFA | NFA | Mealy }) {
  const { options } = useEditor();
  const saved = (options.savedMachines?.() ?? []).filter((s) => (m.kind === 'mealy') === (s.doc.kind === 'mealy'));
  const [other, setOther] = useState('');
  const result = useMemo(() => {
    const s = saved.find((x) => x.id === other);
    if (!s) return null;
    const om = docToMachine(s.doc);
    if (hasErrors(validate(om))) return { text: `${s.name} has errors, so it can’t be compared yet.`, ok: null };
    const multi = m.input.some((x) => x.length > 1);
    if (m.kind === 'mealy') {
      const d = outputDifference(m, om as Mealy);
      if (!d) return { text: `Equivalent: both give the same output on every input.`, ok: true };
      return { text: `Different on input ${showWord(d.word, multi)}: this machine outputs ${showWord(d.first)}, ${s.name} outputs ${showWord(d.second)}.`, ok: false };
    }
    const d = languageDifference(m, om as DFA | NFA);
    if (!d) return { text: `Equivalent: L(M) is the same for both.`, ok: true };
    const who = d.acceptedBy === 'first' ? 'this machine accepts it' : `${s.name} accepts it`;
    return { text: `Not equivalent. Shortest distinguishing string: ${showWord(d.word, multi)} (${who}, the other rejects it).`, ok: false };
  }, [other, m]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!options.savedMachines) return null;
  return (
    <section className="stack">
      <h3 className="h-sm">Compare with…</h3>
      {saved.length === 0 ? <p className="small muted">Save another machine of the same kind in My machines to compare against it.</p> : (
        <label className="field">
          <span className="small">Another saved machine</span>
          <select value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">Choose…</option>
            {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {result && <p className={`small ${result.ok === true ? 'accept' : result.ok === false ? 'reject' : ''}`} aria-live="polite">{result.ok === true ? '✓ ' : result.ok === false ? '✗ ' : ''}{result.text}</p>}
    </section>
  );
}

export default function ConvertTab() {
  const doc = useMachine((s) => s.doc);
  const m = useMemo(() => docToMachine(doc), [doc]);
  const blocked = hasErrors(validate(m));
  if (blocked) return <p className="inline-msg">Fix the errors under the canvas first. Conversions need a valid machine.</p>;
  return (
    <div className="stack convert-tab">
      {m.kind === 'nfa' && <SubsetSection m={m} />}
      {m.kind === 'dfa' && <GrammarSection m={m} />}
      {m.kind === 'dfa' && <MinimiseSection m={m} />}
      <CompareSection m={m} />
    </div>
  );
}
