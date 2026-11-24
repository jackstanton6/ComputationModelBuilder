// Inline popover for choosing the inputs (and outputs) on the edge from one state to another.
import { useEffect, useRef, useState } from 'react';
import { plainName } from '../../engine/notation';
import { useEditor, useMachine } from './EditorContext';

export default function TransitionEditor({ from, to, x, y, onClose }: { from: string; to: string; x: number; y: number; onClose: () => void }) {
  const { store } = useEditor();
  const doc = useMachine((s) => s.doc);
  const [conflict, setConflict] = useState<{ input: string; current: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const name = (id: string) => plainName(doc.states.find((s) => s.id === id)?.name ?? id);
  const here = doc.trans.filter((t) => t.from === from && t.to === to);
  const checked = new Map(here.map((t) => [t.input, t.output]));
  const deterministic = doc.kind !== 'nfa';

  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [from, to]);

  const apply = (next: Map<string, string | undefined>) => {
    store.getState().setTransitions(from, to, [...next.entries()].map(([input, output]) => ({ input, output })));
  };

  const toggle = (input: string, force = false) => {
    const next = new Map(checked);
    if (next.has(input)) {
      next.delete(input);
    } else {
      const existing = doc.trans.find((t) => t.from === from && t.input === input && t.to !== to);
      if (deterministic && existing && !force) {
        setConflict({ input, current: existing.to });
        return;
      }
      next.set(input, doc.kind === 'mealy' ? doc.output[0] : undefined);
    }
    setConflict(null);
    apply(next);
  };

  const setOutput = (input: string, output: string) => {
    const next = new Map(checked);
    next.set(input, output);
    apply(next);
  };

  return (
    <div
      ref={ref}
      className="popover transition-editor"
      style={{ left: x, top: y }}
      role="dialog"
      aria-label={`Transitions from ${name(from)} to ${name(to)}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="popover-title">{name(from)} → {name(to)}</div>
      <fieldset className="input-checks">
        <legend className="xsmall muted">Inputs i ∈ I{doc.kind === 'mealy' ? ' and outputs' : ''}</legend>
        {doc.input.map((i) => (
          <div key={i} className="row">
            <label className="check">
              <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
              <span className="mono">{i}</span>
            </label>
            {doc.kind === 'mealy' && checked.has(i) && (
              <label className="row xsmall">
                <span className="muted">output</span>
                <select value={checked.get(i) ?? ''} onChange={(e) => setOutput(i, e.target.value)} aria-label={`Output for input ${i}`}>
                  {doc.output.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            )}
          </div>
        ))}
      </fieldset>
      {conflict && (
        <div className="inline-msg" role="alert">
          <p>f({name(from)}, {conflict.input}) is already {name(conflict.current)} — f must be a function.</p>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => toggle(conflict.input, true)}>
              Replace with {name(to)}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConflict(null)}>Keep</button>
          </div>
        </div>
      )}
      <div className="row popover-actions">
        {here.length > 0 && (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => store.getState().deleteEdge(from, to)}>Delete edge</button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-sm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
