// Workspaces for answer-type problems: trace, describe, classify, possible, fill-table.
import { useId } from 'react';
import type { Machine, NFA, StateId } from '../../engine/types';
import { plainName, stateName } from '../../engine/notation';
import type { AnswerKey, Problem, TraceField } from '../../problems/types';
import type { SubsetRowAnswer } from '../../problems/checker';
import { Inline } from '../Tex';
import { TYPE_NAMES, type GrammarType } from '../../engine/classify';

type Values = Record<string, unknown>;
type Fields = Record<string, boolean> | undefined;

interface WSProps {
  p: Problem;
  values: Values;
  set: (k: string, v: unknown) => void;
  fields: Fields;
}

const mark = (fields: Fields, k: string) => (fields && k in fields ? (fields[k] ? ' ✓' : ' ✗') : '');
const cls = (fields: Fields, k: string) => (fields && k in fields ? (fields[k] ? 'cell-ok' : 'cell-bad') : undefined);

export function SetPicker({ states, names, value, onChange, label }: { states: StateId[]; names: (s: StateId) => string; value: StateId[]; onChange: (v: StateId[]) => void; label: string }) {
  const text = value.length ? `{${states.filter((s) => value.includes(s)).map(names).join(', ')}}` : '∅';
  return (
    <details className="set-editor">
      <summary aria-label={`${label}: ${text}`}>{text}</summary>
      <div className="set-options">
        {states.map((s) => (
          <label key={s} className="check">
            <input type="checkbox" checked={value.includes(s)} onChange={() => onChange(value.includes(s) ? value.filter((x) => x !== s) : states.filter((x) => x === s || value.includes(x)))} />
            {names(s)}
          </label>
        ))}
      </div>
    </details>
  );
}

function TraceInput({ f, m, value, set }: { f: TraceField; m: Machine; value: unknown; set: (v: unknown) => void }) {
  const nm = (s: StateId) => plainName(stateName(m, s));
  const id = useId();
  if (f.type === 'state') {
    return (
      <select id={id} value={(value as string) ?? ''} onChange={(e) => set(e.target.value || undefined)} aria-label="State">
        <option value="">Choose…</option>
        {m.states.map((s) => <option key={s} value={s}>{nm(s)}</option>)}
      </select>
    );
  }
  if (f.type === 'set') return <SetPicker states={m.states} names={nm} value={(value as StateId[]) ?? []} onChange={set} label="Set of states" />;
  if (f.type === 'word') return <input type="text" className="mono" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} spellCheck={false} aria-label="Output string" />;
  return (
    <div className="row" role="radiogroup">
      <label className="check"><input type="radio" name={id} checked={value === true} onChange={() => set(true)} /> Yes</label>
      <label className="check"><input type="radio" name={id} checked={value === false} onChange={() => set(false)} /> No</label>
    </div>
  );
}

export function TraceWorkspace({ p, values, set, fields }: WSProps) {
  const ref = p.reference as Extract<AnswerKey, { kind: 'trace' }>;
  return (
    <div className="answer-grid">
      {ref.fields.map((f) => (
        <div key={f.id} className="row">
          <span style={{ minWidth: '12em' }}><Inline text={f.label} /></span>
          <TraceInput f={f} m={p.given as Machine} value={values[f.id]} set={(v) => set(f.id, v)} />
          <span aria-live="polite" className={fields?.[f.id] ? 'accept' : 'reject'}>{mark(fields, f.id)}</span>
        </div>
      ))}
    </div>
  );
}

function Choices({ options, value, onChange, name, fields }: { options: { text: string }[]; value: unknown; onChange: (i: number) => void; name: string; fields?: Fields }) {
  return (
    <fieldset className="choices">
      <legend className="sr-only">Options</legend>
      {options.map((o, i) => (
        <label key={i} className="choice">
          <input type="radio" name={name} checked={value === i} onChange={() => onChange(i)} />
          <span><Inline text={o.text} /></span>
        </label>
      ))}
      {fields && 'choice' in fields && <span className={fields.choice ? 'accept' : 'reject'}>{fields.choice ? '✓ Right description' : '✗ Not this description'}</span>}
    </fieldset>
  );
}

export function DescribeWorkspace({ p, values, set, fields }: WSProps) {
  const ref = p.reference as Extract<AnswerKey, { kind: 'describe' }>;
  const name = useId();
  return (
    <div className="stack">
      <Choices options={ref.options} value={values.choice} onChange={(i) => set('choice', i)} name={name} fields={fields} />
      <div className="answer-grid">
        <label>
          <span>A string in the language{mark(fields, 'inL')}</span>
          <input type="text" className="mono" value={(values.inL as string) ?? ''} onChange={(e) => set('inL', e.target.value)} spellCheck={false} placeholder="λ allowed" />
        </label>
        <label>
          <span>A string not in the language{mark(fields, 'notInL')}</span>
          <input type="text" className="mono" value={(values.notInL as string) ?? ''} onChange={(e) => set('notInL', e.target.value)} spellCheck={false} placeholder="λ allowed" />
        </label>
      </div>
    </div>
  );
}

export function PossibleWorkspace({ p, values, set }: WSProps) {
  const ref = p.reference as Extract<AnswerKey, { kind: 'possible' }>;
  const name = useId();
  return <Choices options={ref.options} value={values.choice} onChange={(i) => set('choice', i)} name={name} />;
}

export function ClassifyWorkspace({ values, set }: WSProps) {
  const name = useId();
  return (
    <fieldset className="choices">
      <legend className="small">The largest k for which G is of type k:</legend>
      {([3, 2, 1, 0] as GrammarType[]).map((k) => (
        <label key={k} className="choice">
          <input type="radio" name={name} checked={values.type === k} onChange={() => set('type', k)} />
          <span>Type {k} ({TYPE_NAMES[k]})</span>
        </label>
      ))}
    </fieldset>
  );
}

export function FillTableWorkspace({ p, values, set, fields }: WSProps) {
  const m = p.given as Machine;
  const nm = (s: StateId) => plainName(stateName(m, s));
  const I = m.input;
  return (
    <div className="table-scroll">
      <table className="state-table fill-table">
        <thead>
          <tr>
            <th rowSpan={2}>State</th>
            <th colSpan={I.length} className="math">f</th>
            {m.kind === 'mealy' && <th colSpan={I.length} className="math">g</th>}
          </tr>
          <tr>
            {I.map((i) => <th key={i} className="mono">{i}</th>)}
            {m.kind === 'mealy' && I.map((i) => <th key={`g${i}`} className="mono">{i}</th>)}
          </tr>
        </thead>
        <tbody>
          {m.states.map((s) => (
            <tr key={s}>
              <th scope="row" className="state-cell">
                <span className="marker" aria-hidden="true">{m.start === s ? '⟶' : ''}</span>{nm(s)}
                <span className="marker" aria-hidden="true">{m.kind !== 'mealy' && m.accepting.includes(s) ? '⋆' : ''}</span>
              </th>
              {I.map((i) => {
                const k = `f:${s}:${i}`;
                return (
                  <td key={i} className={cls(fields, k)}>
                    <select value={(values[k] as string) ?? ''} onChange={(e) => set(k, e.target.value || undefined)} aria-label={`f(${nm(s)}, ${i})`}>
                      <option value="">—</option>
                      {m.states.map((t) => <option key={t} value={t}>{nm(t)}</option>)}
                    </select>
                  </td>
                );
              })}
              {m.kind === 'mealy' && I.map((i) => {
                const k = `g:${s}:${i}`;
                return (
                  <td key={`g${i}`} className={cls(fields, k)}>
                    <select value={(values[k] as string) ?? ''} onChange={(e) => set(k, e.target.value || undefined)} aria-label={`g(${nm(s)}, ${i})`}>
                      <option value="">—</option>
                      {m.output.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SubsetWorkspace({ p, values, set, fields }: WSProps) {
  const m = p.given as NFA;
  const nm = (s: StateId) => plainName(stateName(m, s));
  const rows = (values.rows as SubsetRowAnswer[] | undefined) ?? [{ subset: m.start ? [m.start] : [], next: {}, final: false }];
  const update = (idx: number, r: Partial<SubsetRowAnswer>) => set('rows', rows.map((x, i) => (i === idx ? { ...x, ...r } : x)));
  return (
    <div className="stack">
      <div className="table-scroll">
        <table className="state-table fill-table">
          <thead>
            <tr>
              <th>Subset</th>
              {m.input.map((i) => <th key={i} className="mono">{i}</th>)}
              <th>Final?</th>
              <th><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td className={cls(fields, `row:${idx}`)}>
                  <SetPicker states={m.states} names={nm} value={r.subset} onChange={(v) => update(idx, { subset: v })} label={`Subset in row ${idx + 1}`} />
                </td>
                {m.input.map((i) => (
                  <td key={i} className={cls(fields, `cell:${idx}:${i}`)}>
                    <SetPicker states={m.states} names={nm} value={r.next[i] ?? []} onChange={(v) => update(idx, { next: { ...r.next, [i]: v } })} label={`Row ${idx + 1}, input ${i}`} />
                  </td>
                ))}
                <td className={cls(fields, `final:${idx}`)}>
                  <input type="checkbox" checked={r.final} onChange={(e) => update(idx, { final: e.target.checked })} aria-label={`Row ${idx + 1} is final`} />
                </td>
                <td>
                  <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove row ${idx + 1}`} onClick={() => set('rows', rows.filter((_, i) => i !== idx))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-sm" onClick={() => set('rows', [...rows, { subset: [], next: {}, final: false }])}>Add row</button>
      <p className="xsmall muted">Click a set to choose its states; an empty set is ∅.</p>
    </div>
  );
}
