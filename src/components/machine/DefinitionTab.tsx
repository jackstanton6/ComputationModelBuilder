// The formal tuple in KaTeX, plus chip editors for the alphabets I and O.
import { useState } from 'react';
import { docToMachine } from '../../store/machineDoc';
import { machineDefinitionLines } from '../../engine/latex';
import { isMultiChar } from '../../engine/notation';
import { Tex } from '../Tex';
import { useConfirm } from '../Confirm';
import { useEditor, useMachine } from './EditorContext';

function ChipEditor({ label, name, symbols, locked, onAdd, onRemove }: {
  label: string;
  name: string;
  symbols: string[];
  locked: boolean;
  onAdd: (s: string) => void;
  onRemove: (s: string) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (/\s/.test(v)) return setError('Symbols can’t contain spaces.');
    if (v === 'λ' || v === 'lambda') return setError('λ is the empty string, not a symbol.');
    if (symbols.includes(v)) return setError(`${v} is already in ${name}.`);
    if (symbols.length >= 8) return setError('At most 8 symbols.');
    onAdd(v);
    setText('');
    setError('');
  };
  return (
    <div className="chip-editor">
      <div className="row">
        <span className="chip-label">{label}</span>
        <ul className="chips" aria-label={`Symbols in ${name}`}>
          {symbols.map((s) => (
            <li key={s} className="chip mono">
              {s}
              {!locked && symbols.length > 1 && (
                <button type="button" className="chip-x" aria-label={`Remove ${s} from ${name}`} onClick={() => onRemove(s)}>×</button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!locked && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a symbol" aria-label={`Add a symbol to ${name}`} size={10} />
          <button type="submit" className="btn btn-sm">Add</button>
        </form>
      )}
      {error && <p className="xsmall reject" role="alert">{error}</p>}
    </div>
  );
}

export default function DefinitionTab() {
  const { store, options } = useEditor();
  const doc = useMachine((s) => s.doc);
  const confirm = useConfirm();
  const m = docToMachine(doc);
  const lines = machineDefinitionLines(m);

  const removeSymbol = async (which: 'input' | 'output', sym: string) => {
    const affected = doc.trans.filter((t) => (which === 'input' ? t.input === sym : t.output === sym)).length;
    if (affected > 0) {
      const ok = await confirm({
        title: `Remove ${sym}?`,
        body: which === 'input'
          ? `This deletes ${affected} transition${affected === 1 ? '' : 's'} on ${sym}.`
          : `${affected} output${affected === 1 ? '' : 's'} use ${sym}; they will become undefined.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
    }
    store.getState().update((d) => which === 'input'
      ? { ...d, input: d.input.filter((s) => s !== sym), trans: d.trans.filter((t) => t.input !== sym) }
      : { ...d, output: d.output.filter((s) => s !== sym), trans: d.trans.map((t) => (t.output === sym ? { ...t, output: undefined } : t)) });
  };

  return (
    <div className="stack definition">
      <div className="math-block">
        <Tex display>{lines[0]}</Tex>
        {lines.slice(1).map((l, i) => <Tex key={i} display>{l}</Tex>)}
      </div>
      <p className="small muted">
        {doc.kind === 'dfa' && <>An FSM without output (deterministic finite automaton). f must be defined for every s ∈ S and i ∈ I. x is recognised if f(s₀, x) ∈ F.</>}
        {doc.kind === 'nfa' && <>A non-deterministic FSM. f(s, i) is a set of states and may be ∅. x is recognised if f(s₀, x) ∩ F ≠ ∅.</>}
        {doc.kind === 'mealy' && <>An FSM with output. Running an input x produces an output string of the same length. There are no accepting states.</>}
      </p>
      <ChipEditor
        label="I ="
        name="I"
        symbols={doc.input}
        locked={options.lockAlphabet}
        onAdd={(s) => store.getState().update((d) => ({ ...d, input: [...d.input, s] }))}
        onRemove={(s) => void removeSymbol('input', s)}
      />
      {doc.kind === 'mealy' && (
        <ChipEditor
          label="O ="
          name="O"
          symbols={doc.output}
          locked={options.lockAlphabet}
          onAdd={(s) => store.getState().update((d) => ({ ...d, output: [...d.output, s] }))}
          onRemove={(s) => void removeSymbol('output', s)}
        />
      )}
      {isMultiChar(doc.input) && (
        <p className="xsmall muted">Some symbols have more than one character, so input strings must be space-separated.</p>
      )}
    </div>
  );
}
