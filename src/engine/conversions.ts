// Kleene's construction (regular grammar → non-deterministic FSM) and the converse
// (FSM without output → regular grammar), as in the lectures (SPEC §3.8–3.9).
import type { DFA, Grammar, NFA, Production, StateId, Sym } from './types';
import { nonTerminals, orderSymbols } from './grammar';
import { classify } from './classify';
import { stateName } from './notation';

export function kleeneGrammarToNfa(g: Grammar): NFA {
  if (!classify(g).checks[3].ok) throw new Error('Kleene’s construction needs a type 3 grammar.');
  const N = nonTerminals(g);
  const ordered = [g.S, ...N.filter((A) => A !== g.S)];
  const id = (A: Sym) => `s_${A}`;
  const finalId = N.includes('F') ? 's_F′' : 's_F';
  const states = [...ordered.map(id), finalId];
  const delta: NFA['delta'] = {};
  for (const s of states) delta[s] = Object.fromEntries(g.T.map((a) => [a, [] as StateId[]]));
  const accepting = [finalId];
  for (const p of g.P) {
    const A = p.lhs[0];
    if (p.rhs.length === 0) {
      accepting.unshift(id(g.S));
    } else if (p.rhs.length === 1) {
      const t = delta[id(A)][p.rhs[0]];
      if (!t.includes(finalId)) t.push(finalId);
    } else {
      const t = delta[id(A)][p.rhs[0]];
      if (!t.includes(id(p.rhs[1]))) t.push(id(p.rhs[1]));
    }
  }
  for (const s of states) for (const a of g.T) delta[s][a] = states.filter((x) => delta[s][a].includes(x));
  return { kind: 'nfa', states, input: [...g.T], start: id(g.S), accepting: [...new Set(accepting)], delta };
}

/** Non-terminal names for states: S for s₀, then A, B, C, … (skipping S). */
export function defaultNonTerminalNames(m: DFA): Record<StateId, Sym> {
  const letters = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split('');
  const names: Record<StateId, Sym> = {};
  let k = 0;
  if (m.start !== null) names[m.start] = 'S';
  for (const s of m.states) {
    if (s === m.start) continue;
    names[s] = k < letters.length ? letters[k] : `⟨${stateName(m, s)}⟩`;
    k++;
  }
  return names;
}

export function dfaToGrammar(m: DFA, names: Record<StateId, Sym> = defaultNonTerminalNames(m)): Grammar {
  if (m.start === null) throw new Error('No initial state');
  const acc = new Set(m.accepting);
  const P: Production[] = [];
  const ordered = [m.start, ...m.states.filter((s) => s !== m.start)];
  if (acc.has(m.start)) P.push({ lhs: [names[m.start]], rhs: [] });
  for (const s of ordered) {
    for (const a of m.input) {
      const t = m.delta[s]?.[a];
      if (t === undefined) continue;
      P.push({ lhs: [names[s]], rhs: [a, names[t]] });
      if (acc.has(t)) P.push({ lhs: [names[s]], rhs: [a] });
    }
  }
  const NT = ordered.map((s) => names[s]);
  return { V: orderSymbols([...NT, ...m.input]), T: [...m.input], S: names[m.start], P };
}
