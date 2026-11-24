// Editable state table in the course layout, synced both ways with the diagram.
import { useId, type KeyboardEvent } from 'react';
import { plainName } from '../../engine/notation';
import { bounds } from './geometry';
import { useEditor, useMachine } from './EditorContext';

/** Left/Right arrows move between cells (Up/Down keep changing the value natively). */
function gridNav(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const cell = (e.target as HTMLElement).closest('td');
  const row = cell?.parentElement;
  if (!cell || !row) return;
  const cells = [...row.querySelectorAll<HTMLElement>('select, input, button, summary')];
  const i = cells.indexOf(e.target as HTMLElement);
  const j = e.key === 'ArrowLeft' ? i - 1 : i + 1;
  if (j >= 0 && j < cells.length) {
    e.preventDefault();
    cells[j].focus();
  }
}

export default function StateTable() {
  const { store } = useEditor();
  const doc = useMachine((s) => s.doc);
  const radioName = useId();
  const S = store.getState;
  const nm = (id: string) => plainName(doc.states.find((s) => s.id === id)?.name ?? id);
  const fOf = (from: string, i: string) => doc.trans.filter((t) => t.from === from && t.input === i);

  const addRow = () => {
    const b = bounds(doc.states, 0);
    const x = doc.states.length ? b.x + b.w + 60 : 120;
    const y = doc.states.length ? Math.round(b.y + b.h / 2) : 160;
    S().addState(x, y);
  };

  if (doc.states.length === 0) {
    return (
      <div className="stack">
        <p className="muted">No states yet. Add one here or double-click the canvas.</p>
        <button type="button" className="btn" onClick={addRow}>Add state</button>
      </div>
    );
  }

  const I = doc.input;
  return (
    <div className="stack">
      <div className="table-scroll">
        <table className="state-table" onKeyDown={gridNav}>
          <caption className="sr-only">State table</caption>
          <thead>
            <tr>
              <th rowSpan={2} scope="col">State</th>
              <th colSpan={I.length} scope="colgroup" className="math">f</th>
              {doc.kind === 'mealy' && <th colSpan={I.length} scope="colgroup" className="math">g</th>}
              <th rowSpan={2} scope="col" className="table-actions-h"><span className="sr-only">Options</span></th>
            </tr>
            <tr>
              {I.map((i) => <th key={`f${i}`} scope="col" className="mono">{i}</th>)}
              {doc.kind === 'mealy' && I.map((i) => <th key={`g${i}`} scope="col" className="mono">{i}</th>)}
            </tr>
          </thead>
          <tbody>
            {doc.states.map((s) => (
              <tr key={s.id}>
                <th scope="row" className="state-cell">
                  <span className="marker" aria-hidden="true">{doc.start === s.id ? '⟶' : ''}</span>
                  <input
                    type="text"
                    className="name-input math"
                    value={s.name}
                    aria-label={`Name of ${plainName(s.name)}`}
                    onChange={(e) => S().renameState(s.id, e.target.value)}
                  />
                  <span className="marker" aria-hidden="true">{doc.kind !== 'mealy' && doc.accepting.includes(s.id) ? '⋆' : ''}</span>
                </th>
                {I.map((i) => {
                  const ts = fOf(s.id, i);
                  if (doc.kind === 'nfa') {
                    const set = new Set(ts.map((t) => t.to));
                    const label = set.size === 0 ? '∅' : `{${doc.states.filter((x) => set.has(x.id)).map((x) => plainName(x.name)).join(', ')}}`;
                    return (
                      <td key={i}>
                        <details className="set-editor">
                          <summary aria-label={`f(${plainName(s.name)}, ${i}) = ${label}`}>{label}</summary>
                          <div className="set-options">
                            {doc.states.map((x) => (
                              <label key={x.id} className="check">
                                <input
                                  type="checkbox"
                                  checked={set.has(x.id)}
                                  onChange={() => {
                                    const next = new Set(set);
                                    if (next.has(x.id)) next.delete(x.id);
                                    else next.add(x.id);
                                    S().setF(s.id, i, doc.states.map((y) => y.id).filter((y) => next.has(y)));
                                  }}
                                />
                                {plainName(x.name)}
                              </label>
                            ))}
                          </div>
                        </details>
                      </td>
                    );
                  }
                  const cur = ts[0]?.to ?? '';
                  return (
                    <td key={i} className={cur ? undefined : 'cell-missing'}>
                      <select
                        value={cur}
                        aria-label={`f(${plainName(s.name)}, ${i})`}
                        onChange={(e) => S().setF(s.id, i, e.target.value ? [e.target.value] : [])}
                      >
                        <option value="">—</option>
                        {doc.states.map((x) => <option key={x.id} value={x.id}>{plainName(x.name)}</option>)}
                      </select>
                    </td>
                  );
                })}
                {doc.kind === 'mealy' && I.map((i) => {
                  const t = fOf(s.id, i)[0];
                  return (
                    <td key={`g${i}`} className={t?.output !== undefined ? undefined : 'cell-missing'}>
                      <select
                        value={t?.output ?? ''}
                        disabled={!t}
                        title={t ? undefined : `Set f(${plainName(s.name)}, ${i}) first`}
                        aria-label={`g(${plainName(s.name)}, ${i})`}
                        onChange={(e) => S().setG(s.id, i, e.target.value)}
                      >
                        <option value="">—</option>
                        {doc.output.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                  );
                })}
                <td className="table-actions">
                  <label className="check xsmall" title="Initial state s₀">
                    <input type="radio" name={radioName} checked={doc.start === s.id} onChange={() => S().setInitial(s.id)} />
                    initial
                  </label>
                  {doc.kind !== 'mealy' && (
                    <label className="check xsmall" title="Accepting (final) state">
                      <input type="checkbox" checked={doc.accepting.includes(s.id)} onChange={() => S().toggleAccepting(s.id)} />
                      final
                    </label>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost btn-danger" aria-label={`Delete ${nm(s.id)}`} onClick={() => S().deleteState(s.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xsmall muted">
        ⟶ marks the initial state s₀{doc.kind !== 'mealy' && <>; ⋆ marks the final (accepting) states F</>}.
        {doc.kind === 'nfa' ? ' Each cell is a set; ∅ means no transition.' : ' — means undefined.'}
      </p>
      <button type="button" className="btn btn-sm" onClick={addRow}>Add state</button>
    </div>
  );
}
