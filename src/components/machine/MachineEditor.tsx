// The full machine editor: left toolbar, canvas with validation panel, right panel with tabs.
import { useEffect, useState, type ReactNode } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { MachineKind, NFA } from '../../engine/types';
import { nfaIsDeterministic } from '../../engine/fsm';
import { subsetConstruction } from '../../engine/nfa';
import { docToMachine, machineToDoc, stripOutputs } from '../../store/machineDoc';
import type { MachineState } from '../../store/machineStore';
import { useConfirm } from '../Confirm';
import { Tabs } from '../Tabs';
import { EditorContext, useEditor, useMachine, type EditorOptions } from './EditorContext';
import Canvas from './Canvas';
import StateTable from './StateTable';
import DefinitionTab from './DefinitionTab';
import TestTab from './TestTab';
import ConvertTab from './ConvertTab';
import ExportTab from './ExportTab';
import ValidationPanel from './ValidationPanel';

export const KIND_LABELS: Record<MachineKind, string> = {
  dfa: 'Without output',
  nfa: 'Non-deterministic',
  mealy: 'With output',
};

function KindSelector() {
  const { store, options } = useEditor();
  const kind = useMachine((s) => s.doc.kind);
  const confirm = useConfirm();

  const switchTo = async (to: MachineKind) => {
    const S = store.getState();
    const d = S.doc;
    if (to === d.kind) return;
    if (d.kind === 'dfa' && to === 'nfa') {
      S.update((x) => ({ ...x, kind: 'nfa' }));
    } else if (d.kind === 'nfa' && to === 'dfa') {
      const m = docToMachine(d) as NFA;
      if (nfaIsDeterministic(m)) {
        S.update((x) => ({ ...x, kind: 'dfa' }));
        return;
      }
      if (m.start === null) {
        await confirm({ title: 'Choose an initial state first', body: 'The subset construction starts from {s₀}, so the machine needs an initial state.', confirmLabel: 'OK', cancelLabel: 'Close' });
        return;
      }
      const ok = await confirm({
        title: 'Convert to an FSM without output?',
        body: <p>This machine is non-deterministic (some f(s, i) isn’t exactly one state), so it can’t simply be relabelled. The subset construction builds an equivalent FSM without output whose states are sets of states.</p>,
        confirmLabel: 'Convert using subset construction',
      });
      if (!ok) return;
      try {
        const next = machineToDoc(subsetConstruction(m).dfa);
        S.update(() => ({ ...next, tests: d.tests }));
      } catch (e) {
        await confirm({ title: 'Couldn’t convert', body: (e as Error).message, confirmLabel: 'OK', cancelLabel: 'Close' });
      }
    } else if (to === 'mealy') {
      const nondet = d.kind === 'nfa' && !nfaIsDeterministic(docToMachine(d) as NFA);
      if (d.accepting.length > 0 || nondet) {
        const ok = await confirm({
          title: 'Switch to an FSM with output?',
          body: <p>FSMs with output have no accepting states{nondet ? ' and f must be a function' : ''}, so {d.accepting.length > 0 ? 'the accepting states' : ''}{d.accepting.length > 0 && nondet ? ' and ' : ''}{nondet ? 'extra transitions on the same input' : ''} will be removed. Every output starts as {d.output[0] ?? '0'}.</p>,
          confirmLabel: 'Switch',
        });
        if (!ok) return;
      }
      S.update((x) => {
        const seen = new Set<string>();
        const trans = x.trans.filter((t) => {
          const k = `${t.from}|${t.input}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).map((t) => ({ ...t, output: x.output[0] ?? '0' }));
        return { ...x, kind: 'mealy', accepting: [], trans, output: x.output.length ? x.output : ['0', '1'] };
      });
    } else {
      // From an FSM with output to one without output (deterministic or not).
      if (d.trans.length > 0) {
        const ok = await confirm({ title: 'Remove the outputs?', body: 'FSMs without output have no output function g, so every output will be removed. You can then mark accepting states.', confirmLabel: 'Remove outputs' });
        if (!ok) return;
      }
      S.update((x) => stripOutputs(x, to));
    }
  };

  return (
    <fieldset className="kind-selector">
      <legend className="xsmall muted">Machine type</legend>
      {(['dfa', 'nfa', 'mealy'] as MachineKind[]).map((k) => (
        <label key={k} className={`seg${kind === k ? ' on' : ''}${options.kinds.includes(k) ? '' : ' disabled'}`}>
          <input type="radio" name={`kind-${KIND_LABELS[k]}`} checked={kind === k} disabled={!options.kinds.includes(k)} onChange={() => void switchTo(k)} />
          {KIND_LABELS[k]}
        </label>
      ))}
    </fieldset>
  );
}

function Toolbar({ extra }: { extra?: ReactNode }) {
  const { store } = useEditor();
  const canUndo = useMachine((s) => s.past.length > 0);
  const canRedo = useMachine((s) => s.future.length > 0);
  const S = store.getState;
  return (
    <aside className="editor-toolbar" aria-label="Machine tools">
      {extra}
      <KindSelector />
      <div className="tool-group">
        <button type="button" className="btn btn-sm" onClick={() => {
          const d = S().doc;
          const maxX = d.states.length ? Math.max(...d.states.map((s) => s.x)) : 40;
          const y = d.states.length ? Math.round(d.states.reduce((a, s) => a + s.y, 0) / d.states.length) : 160;
          S().addState(maxX + 120, y);
        }}>Add state</button>
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => S().undo()} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">↶ Undo</button>
          <button type="button" className="btn btn-sm" onClick={() => S().redo()} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        </div>
      </div>
      <details className="shortcuts xsmall">
        <summary>Shortcuts</summary>
        <dl>
          <dt>Double-click</dt><dd>add a state</dd>
          <dt>Shift-drag</dt><dd>add a transition</dd>
          <dt><kbd>S</kbd></dt><dd>set initial</dd>
          <dt><kbd>A</kbd></dt><dd>toggle accepting</dd>
          <dt><kbd>Enter</kbd></dt><dd>rename</dd>
          <dt><kbd>Del</kbd></dt><dd>delete</dd>
          <dt>Arrows</dt><dd>nudge</dd>
          <dt>Space-drag</dt><dd>pan</dd>
          <dt>Ctrl+scroll</dt><dd>zoom</dd>
        </dl>
      </details>
    </aside>
  );
}

const TAB_LABELS: Record<string, string> = { test: 'Test', table: 'Table', definition: 'Definition', convert: 'Convert', export: 'Export' };

export default function MachineEditor({ store, options, toolbarExtra, tabs = ['test', 'table', 'definition', 'convert', 'export'], fileBase, className }: {
  store: StoreApi<MachineState>;
  options: EditorOptions;
  toolbarExtra?: ReactNode;
  tabs?: string[];
  fileBase?: string;
  className?: string;
}) {
  const [tab, setTab] = useState(tabs[0]);
  useEffect(() => store.subscribe((s, p) => {
    if (s.traceRequest && s.traceRequest !== p.traceRequest) setTab('test');
  }), [store]);
  return (
    <EditorContext.Provider value={{ store, options }}>
      <div className={`machine-editor ${className ?? ''}`}>
        <Toolbar extra={toolbarExtra} />
        <div className="editor-center">
          <Canvas />
          <ValidationPanel />
        </div>
        <div className="editor-panel">
          <Tabs tabs={tabs.map((id) => ({ id, label: TAB_LABELS[id] }))} value={tab} onChange={setTab} label="Machine panels">
            {tab === 'test' && <TestTab />}
            {tab === 'table' && <StateTable />}
            {tab === 'definition' && <DefinitionTab />}
            {tab === 'convert' && <ConvertTab />}
            {tab === 'export' && <ExportTab fileBase={fileBase} />}
          </Tabs>
        </div>
      </div>
    </EditorContext.Provider>
  );
}

/** Switch the editor to the Test tab and load a string (used by practice "Trace this string"). */
export function useTraceString(store: StoreApi<MachineState>) {
  return (word: string) => store.getState().requestTrace(word);
}
