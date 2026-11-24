// Always-visible, collapsible list of validation issues in course language.
import { useMemo, useState } from 'react';
import { completeWithDeadState, validate } from '../../engine/fsm';
import type { DFA, Mealy } from '../../engine/types';
import { docToMachine } from '../../store/machineDoc';
import { useEditor, useMachine } from './EditorContext';

const MAX_SHOWN = 6;

export default function ValidationPanel() {
  const { store } = useEditor();
  const doc = useMachine((s) => s.doc);
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const issues = useMemo(() => validate(docToMachine(doc)), [doc]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const missingF = doc.kind !== 'nfa' && issues.some((i) => i.code === 'undefined-f' || i.code === 'undefined-g');

  const completeDead = () => {
    const S = store.getState();
    const m = docToMachine(S.doc) as DFA | Mealy;
    const { machine, dead } = completeWithDeadState(m);
    if (!dead) return;
    S.update((d) => {
      const xs = d.states.map((s) => s.x);
      const ys = d.states.map((s) => s.y);
      const x = Math.max(...xs) + 140;
      const y = Math.max(...ys) + 100;
      const trans = d.trans.slice();
      for (const s of machine.states) {
        for (const i of machine.input) {
          const exists = trans.some((t) => t.from === s && t.input === i);
          if (exists) {
            if (d.kind === 'mealy') {
              const idx = trans.findIndex((t) => t.from === s && t.input === i);
              if (trans[idx].output === undefined) trans[idx] = { ...trans[idx], output: (machine as Mealy).out[s][i] };
            }
            continue;
          }
          trans.push(d.kind === 'mealy'
            ? { from: s, to: machine.delta[s][i], input: i, output: (machine as Mealy).out[s][i] }
            : { from: s, to: machine.delta[s][i], input: i });
        }
      }
      return { ...d, states: [...d.states, { id: dead, name: dead, x, y }], trans };
    });
  };

  const summaryText = errors.length === 0 && warnings.length === 0
    ? 'No issues'
    : [errors.length ? `${errors.length} error${errors.length === 1 ? '' : 's'}` : '', warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
  const all = [...errors, ...warnings];
  const shown = showAll ? all : all.slice(0, MAX_SHOWN);

  return (
    <section className={`validation ${errors.length ? 'has-errors' : ''}`} aria-label="Validation">
      <button type="button" className="validation-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className={errors.length ? 'reject' : warnings.length ? '' : 'accept'}>
          {errors.length ? '✗' : warnings.length ? '!' : '✓'} {summaryText}
        </span>
      </button>
      {open && all.length > 0 && (
        <div className="validation-body">
          <ul>
            {shown.map((i, k) => (
              <li key={k} className={i.severity === 'error' ? 'issue-error' : 'issue-warning'}>
                <span className="sr-only">{i.severity}: </span>{i.message}
              </li>
            ))}
          </ul>
          <div className="row">
            {all.length > MAX_SHOWN && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show fewer' : `Show all ${all.length}`}
              </button>
            )}
            {missingF && doc.states.length > 0 && (
              <button type="button" className="btn btn-sm" onClick={completeDead}>Complete with a dead state</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
