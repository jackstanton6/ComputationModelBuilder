// Zustand store for one machine editor: document, undo/redo history, selection and simulator
// highlights. Created per workspace (builder page or practice problem).
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { StateId, Sym } from '../engine/types';
import { emptyDoc, newId, nextStateName, type MachineDoc, type VTrans } from './machineDoc';

export type Selection =
  | { type: 'state'; id: StateId }
  | { type: 'edge'; from: StateId; to: StateId }
  | null;

export interface SimHighlight {
  active: StateId[];
  flash: { from: StateId; to: StateId; nonce: number }[];
  pulse: { states: StateId[]; result: 'accept' | 'reject'; nonce: number } | null;
}

export interface MachineState {
  doc: MachineDoc;
  past: MachineDoc[];
  future: MachineDoc[];
  selection: Selection;
  /** Open transition popover for a pair of states (after drawing or clicking an edge). */
  edgeEditor: { from: StateId; to: StateId; isNew: boolean } | null;
  sim: SimHighlight;
  /** Bumped when another part of the UI asks the simulator to trace a string. */
  traceRequest: { word: string; nonce: number } | null;

  /** Apply a change and record it for undo. */
  update: (fn: (d: MachineDoc) => MachineDoc) => void;
  /** Replace without recording (e.g. during a drag). */
  replace: (fn: (d: MachineDoc) => MachineDoc) => void;
  /** Record the given doc as an undo point (used at the start of a drag). */
  checkpoint: (d: MachineDoc) => void;
  undo: () => void;
  redo: () => void;
  load: (d: MachineDoc) => void;
  select: (s: Selection) => void;
  openEdgeEditor: (e: MachineState['edgeEditor']) => void;
  setSim: (s: Partial<SimHighlight>) => void;
  requestTrace: (word: string) => void;

  addState: (x: number, y: number) => StateId;
  deleteState: (id: StateId) => void;
  renameState: (id: StateId, name: string) => void;
  setInitial: (id: StateId) => void;
  toggleAccepting: (id: StateId) => void;
  setTransitions: (from: StateId, to: StateId, items: { input: Sym; output?: Sym }[]) => void;
  deleteEdge: (from: StateId, to: StateId) => void;
  /** Table editing: set f(from, input) (deterministic) or the set f(from, input) (non-deterministic). */
  setF: (from: StateId, input: Sym, to: StateId[]) => void;
  setG: (from: StateId, input: Sym, output: Sym) => void;
}

const HISTORY = 100;
export const noSim: SimHighlight = { active: [], flash: [], pulse: null };

export function createMachineStore(initial: MachineDoc = emptyDoc()): StoreApi<MachineState> {
  return createStore<MachineState>((set, get) => {
    const update = (fn: (d: MachineDoc) => MachineDoc) => {
      const { doc, past } = get();
      const next = fn(doc);
      if (next === doc) return;
      set({ doc: next, past: [...past.slice(-HISTORY + 1), doc], future: [] });
    };
    return {
      doc: initial,
      past: [],
      future: [],
      selection: null,
      edgeEditor: null,
      sim: noSim,
      traceRequest: null,
      update,
      replace: (fn) => set({ doc: fn(get().doc) }),
      checkpoint: (d) => set({ past: [...get().past.slice(-HISTORY + 1), d], future: [] }),
      undo: () => {
        const { past, doc, future } = get();
        if (!past.length) return;
        set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future], selection: null, edgeEditor: null });
      },
      redo: () => {
        const { past, doc, future } = get();
        if (!future.length) return;
        set({ doc: future[0], past: [...past, doc], future: future.slice(1), selection: null, edgeEditor: null });
      },
      load: (d) => set({ doc: d, past: [], future: [], selection: null, edgeEditor: null, sim: noSim }),
      select: (selection) => set({ selection }),
      openEdgeEditor: (edgeEditor) => set({ edgeEditor }),
      setSim: (s) => set({ sim: { ...get().sim, ...s } }),
      requestTrace: (word) => set({ traceRequest: { word, nonce: Date.now() } }),

      addState: (x, y) => {
        const id = newId();
        update((d) => ({
          ...d,
          states: [...d.states, { id, name: nextStateName(d), x, y }],
          start: d.start ?? id,
        }));
        set({ selection: { type: 'state', id } });
        return id;
      },
      deleteState: (id) => {
        update((d) => ({
          ...d,
          states: d.states.filter((s) => s.id !== id),
          trans: d.trans.filter((t) => t.from !== id && t.to !== id),
          accepting: d.accepting.filter((a) => a !== id),
          start: d.start === id ? null : d.start,
        }));
        set({ selection: null, edgeEditor: null });
      },
      renameState: (id, name) => update((d) => ({ ...d, states: d.states.map((s) => (s.id === id ? { ...s, name } : s)) })),
      setInitial: (id) => update((d) => (d.start === id ? d : { ...d, start: id })),
      toggleAccepting: (id) => update((d) => (d.kind === 'mealy' ? d : {
        ...d,
        accepting: d.accepting.includes(id) ? d.accepting.filter((a) => a !== id) : [...d.accepting, id],
      })),
      setTransitions: (from, to, items) => update((d) => {
        const deterministic = d.kind !== 'nfa';
        const inputs = new Set(items.map((i) => i.input));
        let trans = d.trans.filter((t) => !(t.from === from && t.to === to));
        // Deterministic machines: f(from, i) has one value, so replace any other edge on i.
        if (deterministic) trans = trans.filter((t) => !(t.from === from && inputs.has(t.input)));
        const added: VTrans[] = items.map(({ input, output }) => (d.kind === 'mealy' ? { from, to, input, output } : { from, to, input }));
        return { ...d, trans: [...trans, ...added] };
      }),
      setF: (from, input, to) => update((d) => {
        const old = d.trans.filter((t) => t.from === from && t.input === input);
        const rest = d.trans.filter((t) => !(t.from === from && t.input === input));
        const output = old[0]?.output ?? (d.kind === 'mealy' ? d.output[0] : undefined);
        const targets = d.kind === 'nfa' ? to : to.slice(0, 1);
        return { ...d, trans: [...rest, ...targets.map((u) => (d.kind === 'mealy' ? { from, to: u, input, output } : { from, to: u, input }))] };
      }),
      setG: (from, input, output) => update((d) => ({
        ...d,
        trans: d.trans.map((t) => (t.from === from && t.input === input ? { ...t, output } : t)),
      })),
      deleteEdge: (from, to) => {
        update((d) => ({ ...d, trans: d.trans.filter((t) => !(t.from === from && t.to === to)) }));
        set({ selection: null, edgeEditor: null });
      },
    };
  });
}
