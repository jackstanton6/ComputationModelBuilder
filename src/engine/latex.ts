// LaTeX serialisers in course notation: formal definitions, state tables, grammars, derivations.
import type { Grammar, Machine, StateId, Sym } from './types';
import { stateName, texName } from './notation';
import type { Derivation } from './derivation';

const texSym = (s: Sym): string => {
  if (s.startsWith('⟨') && s.endsWith('⟩')) return `{\\langle\\text{${s.slice(1, -1)}}\\rangle}`;
  if (s.endsWith('′')) return `${s.slice(0, -1)}'`;
  if (/^[A-Za-z0-9]$/.test(s)) return s;
  if (/^[A-Za-z0-9]+$/.test(s)) return `\\mathit{${s}}`;
  return `\\text{${s.replace(/([#$%&_{}\\])/g, '\\$1')}}`;
};

export const texWord = (w: Sym[]) => (w.length === 0 ? '\\lambda' : w.map(texSym).join(''));
const texSetOf = (items: string[]) => (items.length ? `\\{${items.join(', ')}\\}` : '\\emptyset');

/** Lines of the formal definition, e.g. M = (S, I, f, s_0, F), S = {…}, I = {…}, F = {…}. */
export function machineDefinitionLines(m: Machine): string[] {
  const nm = (id: StateId) => texName(stateName(m, id));
  const S = texSetOf(m.states.map(nm));
  const I = texSetOf(m.input.map(texSym));
  const lines: string[] = [];
  if (m.kind === 'mealy') {
    lines.push('M = (S, I, O, f, g, s_0)');
    lines.push(`S = ${S}`, `I = ${I}`, `O = ${texSetOf(m.output.map(texSym))}`);
    lines.push('f : S \\times I \\to S', 'g : S \\times I \\to O');
  } else {
    lines.push('M = (S, I, f, s_0, F)');
    lines.push(`S = ${S}`, `I = ${I}`);
    lines.push(m.kind === 'nfa' ? 'f : S \\times I \\to \\mathcal{P}(S)' : 'f : S \\times I \\to S');
    lines.push(`F = ${texSetOf(m.accepting.map(nm))}`);
  }
  if (m.start !== null && stateName(m, m.start) !== 's0') lines.push(`s_0 = ${nm(m.start)}`);
  return lines;
}

export function machineDefinitionLatex(m: Machine): string {
  const lines = machineDefinitionLines(m);
  return `\\[\n${lines[0]}\n\\]\nwhere\n\\[\n\\begin{aligned}\n${lines.slice(1).map((l) => `  &${l}`).join(' \\\\\n')}\n\\end{aligned}\n\\]`;
}

/** The state table as a tabular in the course layout. */
export function stateTableLatex(m: Machine): string {
  const nm = (id: StateId) => texName(stateName(m, id));
  const I = m.input;
  const k = I.length;
  const mealy = m.kind === 'mealy';
  const cols = `c|${'c'.repeat(k)}${mealy ? `|${'c'.repeat(k)}` : ''}`;
  const head1 = ` & \\multicolumn{${k}}{c${mealy ? '|' : ''}}{$f$}${mealy ? ` & \\multicolumn{${k}}{c}{$g$}` : ''} \\\\`;
  const head2 = `State & ${I.map((i) => `$${texSym(i)}$`).join(' & ')}${mealy ? ' & ' + I.map((i) => `$${texSym(i)}$`).join(' & ') : ''} \\\\ \\hline`;
  const rows = m.states.map((s) => {
    const mark = (m.start === s ? '\\to ' : '') + nm(s) + (m.kind !== 'mealy' && m.accepting.includes(s) ? '^{\\star}' : '');
    const fCells = I.map((i) => {
      const t = m.delta[s]?.[i];
      if (m.kind === 'nfa') return `$${texSetOf(((t as StateId[] | undefined) ?? []).map(nm))}$`;
      return t === undefined ? '--' : `$${nm(t as StateId)}$`;
    });
    const gCells = mealy ? I.map((i) => {
      const o = m.out[s]?.[i];
      return o === undefined ? '--' : `$${texSym(o)}$`;
    }) : [];
    return `$${mark}$ & ${[...fCells, ...gCells].join(' & ')} \\\\`;
  });
  const legend = mealy ? '% \\to marks the initial state s_0.' : '% \\to marks the initial state s_0; ^\\star marks the final states F.';
  return `${legend}\n\\begin{tabular}{${cols}}\n${head1}\n${head2}\n${rows.join('\n')}\n\\end{tabular}`;
}

/** G = (V, T, S, P) with P as a set. */
export function grammarLatex(g: Grammar): string {
  const P = g.P.map((p) => `${texWord(p.lhs)} \\to ${texWord(p.rhs)}`);
  return [
    '\\[',
    `G = (V, T, ${texSym(g.S)}, P)`,
    '\\]',
    'where',
    '\\[',
    '\\begin{aligned}',
    `  V &= ${texSetOf(g.V.map(texSym))} \\\\`,
    `  T &= ${texSetOf(g.T.map(texSym))} \\\\`,
    `  P &= \\{${P.join(',\\ ')}\\}`,
    '\\end{aligned}',
    '\\]',
  ].join('\n');
}

/** Inline (KaTeX-ready) parts of the course form of a grammar. */
export function grammarTexParts(g: Grammar): { tuple: string; V: string; T: string; P: string } {
  return {
    tuple: `G = (V, T, ${texSym(g.S)}, P)`,
    V: `V = ${texSetOf(g.V.map(texSym))}`,
    T: `T = ${texSetOf(g.T.map(texSym))}`,
    P: `P = \\{${g.P.map((p) => `${texWord(p.lhs)} \\to ${texWord(p.rhs)}`).join(',\\ ')}\\}`,
  };
}

export function derivationLatex(d: Derivation): string {
  return `\\[\n${d.forms.map(texWord).join(' \\Rightarrow ')}\n\\]`;
}

export { texSym };
