// Small buttons that insert hard-to-type symbols (λ, →, ≥, …) at the cursor of a text field.
import type { KeyboardEvent, RefObject } from 'react';

type Field = HTMLInputElement | HTMLTextAreaElement;

/** Insert text at the field's cursor, report the new value, and put the cursor after it. */
export function insertAtCursor(el: Field | null, value: string, text: string, onChange: (v: string) => void) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + text + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  });
}

const LABELS: Record<string, string> = {
  'λ': 'Insert λ (the empty string)',
  '→': 'Insert →',
  '|': 'Insert | (or)',
  '≥': 'Insert ≥',
  '≤': 'Insert ≤',
  '≠': 'Insert ≠',
  '⟨⟩': 'Insert ⟨⟩ for a multi-letter non-terminal',
};

export default function SymbolButtons({ target, value, onChange, symbols = ['λ'] }: {
  target: RefObject<Field | null>;
  value: string;
  onChange: (v: string) => void;
  symbols?: string[];
}) {
  return (
    <span className="symbol-buttons" role="group" aria-label="Insert a symbol">
      {symbols.map((s) => (
        <button
          key={s}
          type="button"
          className="btn btn-sm symbol-btn"
          title={LABELS[s] ?? `Insert ${s}`}
          aria-label={LABELS[s] ?? `Insert ${s}`}
          // Keep focus (and the selection) in the field.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (s === '⟨⟩') {
              insertAtCursor(target.current, value, '⟨⟩', onChange);
              requestAnimationFrame(() => {
                const el = target.current;
                if (el && el.selectionStart !== null) el.setSelectionRange(el.selectionStart - 1, el.selectionStart - 1);
              });
            } else insertAtCursor(target.current, value, s, onChange);
          }}
        >
          {s}
        </button>
      ))}
    </span>
  );
}

/** Ctrl/Cmd+L types λ in any field that uses this handler. */
export function lambdaShortcut(value: string, onChange: (v: string) => void) {
  return (e: KeyboardEvent<Field>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      insertAtCursor(e.currentTarget, value, 'λ', onChange);
    }
  };
}
