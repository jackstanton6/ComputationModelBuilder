// TikZ (automata library) export. Coordinates come from the canvas positions, scaled.
import type { Machine, StateId } from './types';
import { stateName, texName } from './notation';
import { texSym } from './latex';

export interface Positioned {
  x: number;
  y: number;
  loopAngle?: number;
}

const SCALE = 1 / 55; // canvas px -> cm

function loopDir(angle: number | undefined): string {
  const a = angle ?? -Math.PI / 2;
  const deg = ((a * 180) / Math.PI + 360) % 360;
  if (deg >= 45 && deg < 135) return 'loop below';
  if (deg >= 135 && deg < 225) return 'loop left';
  if (deg >= 225 && deg < 315) return 'loop above';
  return 'loop right';
}

export const TIKZ_PREAMBLE = [
  '% Requires: \\usepackage{tikz}',
  '%           \\usetikzlibrary{automata, positioning, arrows.meta}',
];

export function machineTikz(m: Machine, pos: Record<StateId, Positioned>, standalone = false): string {
  const ids = new Map(m.states.map((s, i) => [s, `q${i}`]));
  const r = (n: number) => Math.round(n * 100) / 100;
  const origin = m.states.length ? pos[m.states[0]] ?? { x: 0, y: 0 } : { x: 0, y: 0 };
  const nodes = m.states.map((s) => {
    const p = pos[s] ?? { x: 0, y: 0 };
    const opts = ['state'];
    if (s === m.start) opts.push('initial', 'initial text=Start');
    if (m.kind !== 'mealy' && m.accepting.includes(s)) opts.push('accepting');
    return `  \\node[${opts.join(', ')}] (${ids.get(s)}) at (${r((p.x - origin.x) * SCALE)}, ${r(-(p.y - origin.y) * SCALE)}) {$${texName(stateName(m, s))}$};`;
  });
  // Group transitions into one edge per (from, to).
  const groups = new Map<string, { from: StateId; to: StateId; labels: string[] }>();
  for (const s of m.states) {
    for (const i of m.input) {
      const t = m.delta[s]?.[i];
      if (t === undefined) continue;
      for (const u of Array.isArray(t) ? t : [t]) {
        const k = `${s}>${u}`;
        if (!groups.has(k)) groups.set(k, { from: s, to: u, labels: [] });
        groups.get(k)!.labels.push(m.kind === 'mealy' ? `${texSym(i)}, ${texSym(m.out[s]?.[i] ?? '?')}` : texSym(i));
      }
    }
  }
  const edges = [...groups.values()].map((g) => {
    const a = ids.get(g.from)!;
    const b = ids.get(g.to)!;
    const label = m.kind === 'mealy'
      ? g.labels.map((l) => `$${l}$`).join(' \\\\ ')
      : `$${g.labels.join(', ')}$`;
    const node = m.kind === 'mealy' && g.labels.length > 1 ? `node[auto, align=center] {${label}}` : `node[auto] {${label}}`;
    if (g.from === g.to) return `    (${a}) edge[${loopDir(pos[g.from]?.loopAngle)}] ${node} (${b})`;
    const twoWay = groups.has(`${g.to}>${g.from}`);
    return `    (${a}) edge${twoWay ? '[bend left]' : ''} ${node} (${b})`;
  });
  const body = [
    '\\begin{tikzpicture}[>={Stealth[round]}, shorten >=1pt, auto, node distance=2.5cm, every state/.style={minimum size=1cm}]',
    ...nodes,
    edges.length ? '  \\path[->]' : '',
    ...edges,
    edges.length ? '  ;' : '',
    '\\end{tikzpicture}',
  ].filter((l) => l !== '').join('\n');
  if (!standalone) return `${TIKZ_PREAMBLE.join('\n')}\n${body}`;
  return [
    '\\documentclass[tikz, border=4pt]{standalone}',
    '\\usetikzlibrary{automata, positioning, arrows.meta}',
    '\\begin{document}',
    body,
    '\\end{document}',
  ].join('\n');
}
