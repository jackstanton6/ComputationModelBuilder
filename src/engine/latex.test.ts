import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DFA, Mealy, NFA } from './types';
import { derivationLatex, grammarLatex, machineDefinitionLatex, stateTableLatex } from './latex';
import { machineTikz } from './tikz';
import { grammar } from './grammar';
import { earleyDerive } from './earley';

const ends01: DFA = {
  kind: 'dfa', states: ['s0', 's1', 's2'], input: ['0', '1'], start: 's0', accepting: ['s2'],
  delta: { s0: { 0: 's1', 1: 's0' }, s1: { 0: 's1', 1: 's2' }, s2: { 0: 's1', 1: 's0' } },
};
const pos = { s0: { x: 0, y: 0 }, s1: { x: 150, y: 0 }, s2: { x: 300, y: 0, loopAngle: Math.PI / 2 } };
const delay: Mealy = {
  kind: 'mealy', states: ['s0', 's1'], input: ['0', '1'], output: ['0', '1'], start: 's0',
  delta: { s0: { 0: 's0', 1: 's1' }, s1: { 0: 's0', 1: 's1' } },
  out: { s0: { 0: '0', 1: '0' }, s1: { 0: '1', 1: '1' } },
};
const nfa: NFA = {
  kind: 'nfa', states: ['s0', 's1'], input: ['0', '1'], start: 's0', accepting: ['s1'],
  delta: { s0: { 0: ['s0'], 1: ['s0', 's1'] }, s1: { 0: [], 1: [] } },
};

describe('LaTeX and TikZ', () => {
  it('writes TikZ with the automata library conventions', () => {
    const t = machineTikz(ends01, pos);
    expect(t).toContain('\\usetikzlibrary{automata, positioning, arrows.meta}');
    expect(t).toContain('\\node[state, initial, initial text=Start] (q0) at (0, 0) {$s_{0}$};');
    expect(t).toContain('\\node[state, accepting] (q2)');
    expect(t).toContain('(q1) edge[loop above] node[auto] {$0$} (q1)');
    expect(t).toContain('edge[bend left]');
    const complement: Mealy = { ...delay, states: ['s0'], delta: { s0: { 0: 's0', 1: 's0' } }, out: { s0: { 0: '1', 1: '0' } } };
    expect(machineTikz(complement, { s0: { x: 0, y: 0 } })).toContain('node[auto, align=center] {$0, 1$ \\\\ $1, 0$}');
  });
  it('writes the state table in the course layout', () => {
    const t = stateTableLatex(delay);
    expect(t).toContain('\\multicolumn{2}{c|}{$f$} & \\multicolumn{2}{c}{$g$}');
    expect(t).toContain('$\\to s_{0}$ & $s_{0}$ & $s_{1}$ & $0$ & $0$ \\\\');
    expect(stateTableLatex(nfa)).toContain('$\\emptyset$');
    expect(stateTableLatex(ends01)).toContain('$s_{2}^{\\star}$');
  });
  it('writes formal definitions and grammars in course notation', () => {
    const d = machineDefinitionLatex(ends01);
    expect(d).toContain('M = (S, I, f, s_0, F)');
    expect(d).toContain('S = \\{s_{0}, s_{1}, s_{2}\\}');
    expect(d).toContain('F = \\{s_{2}\\}');
    expect(machineDefinitionLatex(nfa)).toContain('\\mathcal{P}(S)');
    const g = grammar('S -> 0S1 | λ');
    expect(grammarLatex(g)).toContain('P &= \\{S \\to 0S1,\\ S \\to \\lambda\\}');
    expect(derivationLatex(earleyDerive(g, ['0', '1'])!)).toContain('S \\Rightarrow 0S1 \\Rightarrow 01');
  });
  it('matches the compilable fixture (tests/fixtures/machine.tex)', () => {
    const doc = [
      '\\documentclass{article}',
      '\\usepackage{amsmath}',
      '\\usepackage{tikz}',
      '\\usetikzlibrary{automata, positioning, arrows.meta}',
      '\\begin{document}',
      machineTikz(ends01, pos).split('\n').filter((l) => !l.startsWith('%')).join('\n'),
      '',
      machineTikz(delay, { s0: { x: 0, y: 0 }, s1: { x: 150, y: 0 } }).split('\n').filter((l) => !l.startsWith('%')).join('\n'),
      '',
      stateTableLatex(delay),
      '',
      stateTableLatex(nfa),
      '',
      machineDefinitionLatex(ends01),
      '',
      grammarLatex(grammar('S -> 0S1 | λ\nA -> <noun>a')),
      '\\end{document}',
      '',
    ].join('\n');
    const file = resolve(__dirname, '../../tests/fixtures/machine.tex');
    if (!existsSync(file) || process.env.UPDATE_FIXTURES) writeFileSync(file, doc);
    expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(doc);
  });
});
