// SVG state diagram. Used for the interactive canvas, read-only diagrams and exports, so the
// exported SVG/PNG matches what is on screen.
import type { PointerEvent as RPointerEvent, ReactNode } from 'react';
import { labelParts, plainName } from '../../engine/notation';
import { edgeGroups, type MachineDoc } from '../../store/machineDoc';
import type { Selection, SimHighlight } from '../../store/machineStore';
import { bounds, edgeShape, labelLayout, LINE_H, LOOP_DEFAULT, loopShape, R, startArrow } from './geometry';

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accept: string;
  reject: string;
}

export const cssPalette: Palette = {
  bg: 'var(--bg)', surface: 'var(--surface)', text: 'var(--text)', muted: 'var(--text-muted)',
  accent: 'var(--accent)', accentStrong: 'var(--accent-strong)', accentSoft: 'var(--accent-soft)',
  accept: 'var(--accept)', reject: 'var(--reject)',
};

export const lightPalette: Palette = {
  bg: '#FAF9F6', surface: '#FFFFFF', text: '#1D1B17', muted: '#6A665D', accent: '#B7791F',
  accentStrong: '#8F5C10', accentSoft: '#F6EBD8', accept: '#2A7A4E', reject: '#C0392B',
};

/** Resolve the current theme's tokens to literal colours (for exports in the current theme). */
export function computedPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--bg'), surface: v('--surface'), text: v('--text'), muted: v('--text-muted'), accent: v('--accent'),
    accentStrong: v('--accent-strong'), accentSoft: v('--accent-soft'), accept: v('--accept'), reject: v('--reject'),
  };
}

export const MATH_FONT = "'Latin Modern Math', 'STIX Two Math', 'Cambria Math', 'Times New Roman', Times, serif";

export function StateLabel({ name, x, y, size = 19, fill }: { name: string; x: number; y: number; size?: number; fill: string }) {
  const parts = labelParts(name);
  const long = name.length > 6;
  const fs = long ? Math.max(11, size - (name.length - 6) * 1.3) : size;
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={MATH_FONT} fontSize={fs} fill={fill}>
      {parts.map((p, i) => (
        <tspan key={i}>
          <tspan fontStyle={/^[A-Za-z]+$/.test(p.text) ? 'italic' : 'normal'}>{p.text}</tspan>
          {p.sub !== undefined && (
            <tspan fontSize={fs * 0.68} dy={fs * 0.28} fontStyle={/^\d+$/.test(p.sub) ? 'normal' : 'italic'}>
              {p.sub}
            </tspan>
          )}
          {p.sub !== undefined && <tspan dy={-fs * 0.28}>{'​'}</tspan>}
        </tspan>
      ))}
    </text>
  );
}

export function summary(doc: MachineDoc): string {
  const byId = new Map(doc.states.map((s) => [s.id, s]));
  const nm = (id: string) => plainName(byId.get(id)?.name ?? id);
  const parts = [`${doc.states.length} state${doc.states.length === 1 ? '' : 's'}`];
  parts.push(doc.start ? `initial ${nm(doc.start)}` : 'no initial state');
  if (doc.kind !== 'mealy') parts.push(`accepting {${doc.accepting.map(nm).join(', ')}}`);
  const edges = edgeGroups(doc).map((g) => `${nm(g.from)} to ${nm(g.to)} on ${g.lines.join('; ')}`);
  if (edges.length) parts.push('transitions: ' + edges.join('; '));
  return parts.join(', ') + '.';
}

export interface DiagramHandlers {
  onStatePointerDown?: (e: RPointerEvent, id: string) => void;
  onHandlePointerDown?: (e: RPointerEvent, id: string) => void;
  onEdgePointerDown?: (e: RPointerEvent, from: string, to: string) => void;
  onLoopHandlePointerDown?: (e: RPointerEvent, id: string) => void;
  onStateEnter?: (id: string) => void;
}

interface Props extends DiagramHandlers {
  doc: MachineDoc;
  palette?: Palette;
  selection?: Selection;
  sim?: SimHighlight;
  interactive?: boolean;
  hoverState?: string | null;
  /** Extra content drawn on top (e.g. the edge being dragged). */
  overlay?: ReactNode;
}

/** Diagram contents (no <svg> wrapper), in world coordinates. */
export function DiagramContent({
  doc, palette = cssPalette, selection = null, sim, interactive = false, hoverState = null, overlay,
  onStatePointerDown, onHandlePointerDown, onEdgePointerDown, onLoopHandlePointerDown, onStateEnter,
}: Props) {
  const P = palette;
  const pos = new Map(doc.states.map((s) => [s.id, s]));
  const groups = edgeGroups(doc);
  const pairs = new Set(groups.map((g) => `${g.from}>${g.to}`));
  const active = new Set(sim?.active ?? []);
  const flash = sim?.flash ?? [];
  const start = doc.start ? pos.get(doc.start) : undefined;
  const halo = { paintOrder: 'stroke' as const, stroke: P.bg, strokeWidth: 4, strokeLinejoin: 'round' as const };

  return (
    <g>
      {start && (() => {
        const s = startArrow(start);
        return (
          <g>
            <path d={s.d} stroke={P.text} strokeWidth={1.5} fill="none" />
            <polygon points={s.arrow} fill={P.text} />
            <text x={s.text.x} y={s.text.y} textAnchor="middle" fontSize={13} fontFamily="system-ui, sans-serif" fill={P.muted}>Start</text>
          </g>
        );
      })()}
      {groups.map((g) => {
        const a = pos.get(g.from);
        const b = pos.get(g.to);
        if (!a || !b) return null;
        const shape = g.from === g.to
          ? loopShape(a, a.loopAngle ?? LOOP_DEFAULT)
          : edgeShape(a, b, pairs.has(`${g.to}>${g.from}`));
        const selected = selection?.type === 'edge' && selection.from === g.from && selection.to === g.to;
        const lit = flash.find((fl) => fl.from === g.from && fl.to === g.to);
        const stroke = selected || lit ? P.accent : P.text;
        const lay = labelLayout(shape.label, shape.normal, g.lines.length);
        return (
          <g key={`${g.from}>${g.to}`} className={interactive ? 'edge interactive' : 'edge'}>
            {interactive && (
              <path d={shape.d} stroke="transparent" strokeWidth={14} fill="none"
                onPointerDown={(e) => onEdgePointerDown?.(e, g.from, g.to)} />
            )}
            <path key={lit?.nonce} className={lit ? 'edge-flash' : undefined} d={shape.d} stroke={stroke} strokeWidth={selected || lit ? 2.5 : 1.5} fill="none" pointerEvents="none" />
            <polygon points={shape.arrow} fill={stroke} pointerEvents="none" />
            <text
              x={lay.x} y={lay.y} textAnchor={lay.anchor} fontFamily={MATH_FONT} fontSize={16} fill={P.accentStrong}
              style={halo} onPointerDown={interactive ? (e) => onEdgePointerDown?.(e, g.from, g.to) : undefined}
              className={interactive ? 'edge-label' : undefined}
            >
              {g.lines.map((line, i) => (
                <tspan key={i} x={lay.x} dy={i === 0 ? 0 : LINE_H}>{line}</tspan>
              ))}
            </text>
            {interactive && selected && g.from === g.to && (
              <circle className="loop-handle" cx={shape.label.x} cy={shape.label.y - 18} r={6} fill={P.surface} stroke={P.accent} strokeWidth={1.5}
                onPointerDown={(e) => onLoopHandlePointerDown?.(e, g.from)}>
                <title>Drag to move the loop around the state</title>
              </circle>
            )}
          </g>
        );
      })}
      {doc.states.map((s) => {
        const isActive = active.has(s.id);
        const accepting = doc.kind !== 'mealy' && doc.accepting.includes(s.id);
        const selected = selection?.type === 'state' && selection.id === s.id;
        const showHandle = interactive && (selected || hoverState === s.id);
        return (
          <g key={s.id} className={interactive ? 'state interactive' : 'state'} onPointerDown={(e) => onStatePointerDown?.(e, s.id)} onPointerEnter={() => onStateEnter?.(s.id)}>
            {selected && <circle cx={s.x} cy={s.y} r={R + 5} fill="none" stroke={P.accent} strokeWidth={2} />}
            <circle cx={s.x} cy={s.y} r={R} fill={isActive ? P.accentSoft : P.surface} stroke={isActive ? P.accent : P.text} strokeWidth={isActive ? 2.5 : 1.5} />
            {accepting && <circle cx={s.x} cy={s.y} r={R - 4} fill="none" stroke={isActive ? P.accent : P.text} strokeWidth={1.5} />}
            <StateLabel name={s.name} x={s.x} y={s.y} fill={P.text} />
            {showHandle && (
              <circle className="edge-handle" cx={s.x + R} cy={s.y} r={6} fill={P.accent} stroke={P.surface} strokeWidth={2}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHandlePointerDown?.(e, s.id);
                }}>
                <title>Drag to another state to add a transition</title>
              </circle>
            )}
          </g>
        );
      })}
      {sim?.pulse && sim.pulse.states.map((id) => {
        const s = pos.get(id);
        if (!s) return null;
        return (
          <circle key={`${id}-${sim.pulse!.nonce}`} className="pulse-ring" cx={s.x} cy={s.y} r={R}
            fill="none" stroke={sim.pulse!.result === 'accept' ? P.accept : P.reject} strokeWidth={3} pointerEvents="none" />
        );
      })}
      {overlay}
    </g>
  );
}

/** A standalone, read-only diagram that fits its content. */
export function Diagram({ doc, palette, title, maxHeight = 320, sim }: { doc: MachineDoc; palette?: Palette; title?: string; maxHeight?: number; sim?: SimHighlight }) {
  const b = bounds(doc.states);
  const text = summary(doc);
  return (
    <svg className="diagram" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={{ maxHeight, width: '100%' }} role="img" aria-label={text}>
      <title>{title ?? 'State diagram'}</title>
      <desc>{text}</desc>
      <DiagramContent doc={doc} palette={palette} sim={sim} />
    </svg>
  );
}
