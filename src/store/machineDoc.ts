// Editor view model for machines (positions, names) and its mapping onto engine types.
import dagre from '@dagrejs/dagre';
import type { Machine, MachineKind, StateId, Sym } from '../engine/types';

export interface VState {
  id: StateId;
  name: string;
  x: number;
  y: number;
  /** Self-loop direction in radians; default −π/2 (above). */
  loopAngle?: number;
}

export interface VTrans {
  from: StateId;
  to: StateId;
  input: Sym;
  /** Output (FSMs with output only). */
  output?: Sym;
}

export interface MachineDoc {
  kind: MachineKind;
  input: Sym[];
  output: Sym[];
  states: VState[];
  start: StateId | null;
  accepting: StateId[];
  trans: VTrans[];
  /** Saved test strings (Test tab). */
  tests?: string[];
}

export const emptyDoc = (kind: MachineKind = 'dfa'): MachineDoc => ({
  kind, input: ['0', '1'], output: ['0', '1'], states: [], start: null, accepting: [], trans: [],
});

let idCounter = 0;
export function newId(prefix = 'q'): string {
  idCounter++;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/** Next free name s0, s1, … */
export function nextStateName(doc: MachineDoc): string {
  const used = new Set(doc.states.map((s) => s.name));
  for (let i = 0; ; i++) if (!used.has(`s${i}`)) return `s${i}`;
}

export function docToMachine(doc: MachineDoc): Machine {
  const states = doc.states.map((s) => s.id);
  const names = Object.fromEntries(doc.states.map((s) => [s.id, s.name]));
  const base = { states, input: [...doc.input], start: doc.start, names };
  if (doc.kind === 'nfa') {
    const delta: Record<StateId, Record<Sym, StateId[]>> = {};
    for (const s of states) delta[s] = Object.fromEntries(doc.input.map((i) => [i, [] as StateId[]]));
    for (const t of doc.trans) {
      const row = delta[t.from];
      if (!row) continue;
      (row[t.input] ??= []).push(t.to);
    }
    for (const s of states) for (const i of Object.keys(delta[s])) delta[s][i] = states.filter((x) => delta[s][i].includes(x));
    return { kind: 'nfa', ...base, accepting: doc.accepting.filter((a) => states.includes(a)), delta };
  }
  const delta: Record<StateId, Record<Sym, StateId>> = {};
  for (const s of states) delta[s] = {};
  for (const t of doc.trans) if (delta[t.from]) delta[t.from][t.input] = t.to;
  if (doc.kind === 'dfa') {
    return { kind: 'dfa', ...base, accepting: doc.accepting.filter((a) => states.includes(a)), delta };
  }
  const out: Record<StateId, Record<Sym, Sym>> = {};
  for (const s of states) out[s] = {};
  for (const t of doc.trans) if (out[t.from] && t.output !== undefined) out[t.from][t.input] = t.output;
  return { kind: 'mealy', ...base, output: [...doc.output], delta, out };
}

/** Build a doc from an engine machine, laying it out with dagre if no positions are given. */
export function machineToDoc(m: Machine, positions?: Record<StateId, { x: number; y: number }>): MachineDoc {
  const trans: VTrans[] = [];
  for (const s of m.states) {
    for (const i of m.input) {
      const t = m.delta[s]?.[i];
      if (t === undefined) continue;
      const targets = Array.isArray(t) ? t : [t];
      for (const u of targets) {
        const vt: VTrans = { from: s, to: u, input: i };
        if (m.kind === 'mealy') vt.output = m.out[s]?.[i];
        trans.push(vt);
      }
    }
  }
  const doc: MachineDoc = {
    kind: m.kind,
    input: [...m.input],
    output: m.kind === 'mealy' ? [...m.output] : ['0', '1'],
    states: m.states.map((s) => ({ id: s, name: m.names?.[s] ?? s, x: 0, y: 0 })),
    start: m.start,
    accepting: m.kind === 'mealy' ? [] : [...m.accepting],
    trans,
  };
  if (positions) {
    for (const s of doc.states) Object.assign(s, positions[s.id] ?? { x: 0, y: 0 });
    return doc;
  }
  return tidyLayout(doc);
}

/** Left-to-right layout with dagre. */
export function tidyLayout(doc: MachineDoc): MachineDoc {
  if (doc.states.length === 0) return doc;
  const g = new dagre.graphlib.Graph({ multigraph: false });
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110, marginx: 80, marginy: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  // Keep s₀ first in rank order.
  const ordered = [...doc.states].sort((a, b) => (a.id === doc.start ? -1 : b.id === doc.start ? 1 : 0));
  for (const s of ordered) g.setNode(s.id, { width: 60, height: 60 });
  const seen = new Set<string>();
  for (const t of doc.trans) {
    if (t.from === t.to) continue;
    const k = `${t.from}>${t.to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    g.setEdge(t.from, t.to, { minlen: 1 });
  }
  dagre.layout(g);
  return {
    ...doc,
    states: doc.states.map((s) => {
      const n = g.node(s.id);
      return { ...s, x: Math.round(n.x + 40), y: Math.round(n.y + 20), loopAngle: undefined };
    }),
  };
}

export interface EdgeGroup {
  from: StateId;
  to: StateId;
  trans: VTrans[];
  /** Label lines: "0, 1" for machines without output, one "i, o" line per input with output. */
  lines: string[];
}

export function edgeGroups(doc: MachineDoc): EdgeGroup[] {
  const map = new Map<string, EdgeGroup>();
  const order = new Map(doc.input.map((s, i) => [s, i]));
  for (const t of doc.trans) {
    const k = `${t.from}>${t.to}`;
    if (!map.has(k)) map.set(k, { from: t.from, to: t.to, trans: [], lines: [] });
    map.get(k)!.trans.push(t);
  }
  for (const g of map.values()) {
    g.trans.sort((a, b) => (order.get(a.input) ?? 99) - (order.get(b.input) ?? 99));
    g.lines = doc.kind === 'mealy'
      ? g.trans.map((t) => `${t.input}, ${t.output ?? '?'}`)
      : [g.trans.map((t) => t.input).join(', ')];
  }
  return [...map.values()];
}

export const edgeKey = (from: StateId, to: StateId) => `${from}>${to}`;

/** Convert a doc between machine kinds where lossless; returns null if not possible directly. */
export function stripOutputs(doc: MachineDoc, kind: 'dfa' | 'nfa'): MachineDoc {
  return { ...doc, kind, trans: doc.trans.map(({ from, to, input }) => ({ from, to, input })) };
}
