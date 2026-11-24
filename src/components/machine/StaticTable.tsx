// Read-only state table in the course layout (prerender-safe).
import type { Machine, StateId } from '../../engine/types';
import { plainName, stateName } from '../../engine/notation';

export default function StaticTable({ m, caption }: { m: Machine; caption?: string }) {
  const nm = (id: StateId) => plainName(stateName(m, id));
  const I = m.input;
  const set = (ids: StateId[]) => (ids.length ? `{${ids.map(nm).join(', ')}}` : '∅');
  return (
    <div className="table-scroll">
      <table className="state-table static">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th rowSpan={2} scope="col">State</th>
            <th colSpan={I.length} scope="colgroup" className="math">f</th>
            {m.kind === 'mealy' && <th colSpan={I.length} scope="colgroup" className="math">g</th>}
          </tr>
          <tr>
            {I.map((i) => <th key={`f${i}`} scope="col" className="mono">{i}</th>)}
            {m.kind === 'mealy' && I.map((i) => <th key={`g${i}`} scope="col" className="mono">{i}</th>)}
          </tr>
        </thead>
        <tbody>
          {m.states.map((s) => (
            <tr key={s}>
              <th scope="row" className="state-cell">
                <span className="marker" aria-hidden="true">{m.start === s ? '⟶' : ''}</span>
                {nm(s)}
                <span className="marker" aria-hidden="true">{m.kind !== 'mealy' && m.accepting.includes(s) ? '⋆' : ''}</span>
                {m.start === s && <span className="sr-only"> (initial)</span>}
                {m.kind !== 'mealy' && m.accepting.includes(s) && <span className="sr-only"> (final)</span>}
              </th>
              {I.map((i) => {
                const t = m.delta[s]?.[i];
                return <td key={i}>{t === undefined ? '—' : Array.isArray(t) ? set(t) : nm(t)}</td>;
              })}
              {m.kind === 'mealy' && I.map((i) => <td key={`g${i}`} className="mono">{m.out[s]?.[i] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="xsmall muted">⟶ marks the initial state s₀{m.kind !== 'mealy' && '; ⋆ marks the final states F'}.</p>
    </div>
  );
}
