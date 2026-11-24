// Monospace production editor with line numbers; lines with errors are marked.
import { useRef } from 'react';
import type { GrammarError } from '../../engine/grammar';
import SymbolButtons, { lambdaShortcut } from '../SymbolButtons';

export default function GrammarEditor({ value, onChange, errors, id = 'grammar-text', rows = 8 }: {
  value: string;
  onChange: (v: string) => void;
  errors: GrammarError[];
  id?: string;
  rows?: number;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const nums = useRef<HTMLOListElement>(null);
  const lines = Math.max(value.split('\n').length, rows);
  const bad = new Set(errors.map((e) => e.line));
  return (
    <div className="stack">
      <div className="row">
        <label htmlFor={id} className="small">Productions P <span className="muted">(one per line; use | for alternatives, -&gt; or →, λ or nothing for the empty string)</span></label>
        <span className="spacer" />
        <SymbolButtons target={ta} value={value} onChange={onChange} symbols={['λ', '→', '|', '⟨⟩']} />
      </div>
      <div className="code-editor">
        <ol className="line-numbers" ref={nums} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <li key={i} className={bad.has(i + 1) ? 'err' : undefined}>{i + 1}</li>
          ))}
        </ol>
        <textarea
          id={id}
          ref={ta}
          value={value}
          rows={rows}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-invalid={errors.length > 0}
          aria-describedby={errors.length ? `${id}-errors` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onScroll={() => {
            if (nums.current && ta.current) nums.current.scrollTop = ta.current.scrollTop;
          }}
          onKeyDown={lambdaShortcut(value, onChange)}
        />
      </div>
      {errors.length > 0 && (
        <ul className="errors" id={`${id}-errors`} aria-live="polite">
          {errors.map((e, i) => <li key={i}>{e.line > 0 ? `Line ${e.line}: ` : ''}{e.message}</li>)}
        </ul>
      )}
      <p className="xsmall muted">Uppercase letters are non-terminals, other characters are terminals. Write longer non-terminals as ⟨noun⟩ or &lt;noun&gt;. Type λ with the λ button, <kbd>Ctrl</kbd>+<kbd>L</kbd>, or the word <code>lambda</code>.</p>
    </div>
  );
}
