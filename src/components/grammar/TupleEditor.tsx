// Enter G = (V, T, S, P) as four fields in set notation, as in lectures.
import { useRef, useState } from 'react';
import SymbolButtons, { lambdaShortcut } from '../SymbolButtons';
import { parseTuple, tupleOf, type TupleError, type TupleFields } from '../../engine/grammar';
import type { Grammar } from '../../engine/types';

export default function TupleEditor({ initial, onValid }: { initial: Grammar; onValid: (g: Grammar) => void }) {
  const [fields, setFields] = useState<TupleFields>(() => tupleOf(initial));
  const [errors, setErrors] = useState<TupleError[]>([]);
  const pRef = useRef<HTMLTextAreaElement>(null);

  const update = (k: keyof TupleFields, v: string) => {
    const next = { ...fields, [k]: v };
    setFields(next);
    const r = parseTuple(next);
    setErrors(r.errors);
    if (r.errors.length === 0) onValid(r.parsed.grammar);
  };

  const field = (k: keyof TupleFields, label: string, hint: string, rows = 1) => {
    const errs = errors.filter((e) => e.field === k);
    const id = `tuple-${k}`;
    return (
      <div className="tuple-field">
        <div className="row">
          <label htmlFor={id} className="math">{label} =</label>
          <span className="spacer" />
          {k === 'P' && <SymbolButtons target={pRef} value={fields.P} onChange={(v) => update('P', v)} symbols={['λ', '→', '⟨⟩']} />}
        </div>
        {rows > 1 ? (
          <textarea id={id} ref={k === 'P' ? pRef : undefined} onKeyDown={lambdaShortcut(fields[k], (v) => update(k, v))} className="mono" rows={rows} value={fields[k]} onChange={(e) => update(k, e.target.value)} spellCheck={false} aria-invalid={errs.length > 0} aria-describedby={`${id}-hint`} />
        ) : (
          <input id={id} type="text" className="mono" value={fields[k]} onChange={(e) => update(k, e.target.value)} spellCheck={false} aria-invalid={errs.length > 0} aria-describedby={`${id}-hint`} />
        )}
        <span id={`${id}-hint`} className="xsmall muted">{hint}</span>
        {errs.length > 0 && <ul className="errors">{errs.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
      </div>
    );
  };

  return (
    <div className="stack tuple-editor">
      <p className="small">G = (V, T, S, P)</p>
      {field('V', 'V', 'The vocabulary: every symbol, separated by commas.')}
      {field('T', 'T', 'The terminals, T ⊆ V. N = V − T are the non-terminals.')}
      {field('S', 'S', 'The start symbol, S ∈ V − T.')}
      {field('P', 'P', 'Productions separated by commas or new lines, e.g. {S → 0S1, S → λ}. Use → or ->.', 4)}
    </div>
  );
}
