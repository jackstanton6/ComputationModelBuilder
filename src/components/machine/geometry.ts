// Pure geometry for state diagrams (shared by the canvas, read-only diagrams and exports).
export interface Pt {
  x: number;
  y: number;
}

export const R = 26;
const ARROW_LEN = 10;
const ARROW_HALF = 4.5;
export const BEND = 38;
export const LOOP_DEFAULT = -Math.PI / 2;

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y) || 1;
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
const f = (n: number) => Math.round(n * 10) / 10;

export interface EdgeShape {
  d: string;
  arrow: string; // polygon points
  label: Pt;
  /** Unit normal pointing from the edge towards the label. */
  normal: Pt;
}

function arrowAt(tip: Pt, dir: Pt): string {
  const u = unit(dir);
  const n = { x: -u.y, y: u.x };
  const base = sub(tip, mul(u, ARROW_LEN));
  const a = add(base, mul(n, ARROW_HALF));
  const b = sub(base, mul(n, ARROW_HALF));
  return `${f(tip.x)},${f(tip.y)} ${f(a.x)},${f(a.y)} ${f(b.x)},${f(b.y)}`;
}

/** Edge between two distinct states. `curved` is used when edges run both ways. */
export function edgeShape(a: Pt, b: Pt, curved: boolean): EdgeShape {
  const u = unit(sub(b, a));
  // Left of the direction of travel, so the two directions bend apart.
  let n: Pt = { x: u.y, y: -u.x };
  if (!curved) {
    const s = add(a, mul(u, R));
    const e = sub(b, mul(u, R));
    const lineEnd = sub(e, mul(u, ARROW_LEN - 1));
    const mid = mul(add(s, e), 0.5);
    // Straight labels sit above the line (or to the left of vertical lines).
    if (n.y > 0 || (Math.abs(n.y) < 1e-6 && n.x > 0)) n = mul(n, -1);
    return { d: `M${f(s.x)},${f(s.y)}L${f(lineEnd.x)},${f(lineEnd.y)}`, arrow: arrowAt(e, u), label: add(mid, mul(n, 9)), normal: n };
  }
  const mid = mul(add(a, b), 0.5);
  const c = add(mid, mul(n, BEND * 1.6));
  const s = add(a, mul(unit(sub(c, a)), R));
  const e = add(b, mul(unit(sub(c, b)), R));
  const tan = unit(sub(e, c));
  const lineEnd = sub(e, mul(tan, ARROW_LEN - 1));
  const top = add(mul(add(s, e), 0.25), mul(c, 0.5));
  return { d: `M${f(s.x)},${f(s.y)}Q${f(c.x)},${f(c.y)} ${f(lineEnd.x)},${f(lineEnd.y)}`, arrow: arrowAt(e, tan), label: add(top, mul(n, 9)), normal: n };
}

export function loopShape(c: Pt, angle: number): EdgeShape {
  const at = (t: number, r: number): Pt => ({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
  const p1 = at(angle - 0.42, R);
  const p2 = at(angle + 0.42, R);
  const c1 = at(angle - 0.62, R * 2.9);
  const c2 = at(angle + 0.62, R * 2.9);
  const tan = unit(sub(p2, c2));
  const lineEnd = sub(p2, mul(tan, ARROW_LEN - 1));
  const n = { x: Math.cos(angle), y: Math.sin(angle) };
  return {
    d: `M${f(p1.x)},${f(p1.y)}C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(lineEnd.x)},${f(lineEnd.y)}`,
    arrow: arrowAt(p2, tan),
    label: at(angle, R * 2.35 + 8),
    normal: n,
  };
}

export function startArrow(c: Pt): { d: string; arrow: string; text: Pt } {
  const tip = { x: c.x - R, y: c.y };
  const s = { x: c.x - R - 44, y: c.y };
  return { d: `M${f(s.x)},${f(s.y)}L${f(tip.x - ARROW_LEN + 1)},${f(tip.y)}`, arrow: arrowAt(tip, { x: 1, y: 0 }), text: { x: s.x + 18, y: s.y - 8 } };
}

export const LINE_H = 17;

/** Position for a block of label lines so it sits on the label side of the edge. */
export function labelLayout(p: Pt, n: Pt, lines: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const anchor = n.x > 0.6 ? 'start' : n.x < -0.6 ? 'end' : 'middle';
  const h = (lines - 1) * LINE_H;
  // y is the baseline of the first line; ~5px puts the visual centre on p.
  let y = p.y + 5 - h / 2;
  if (n.y < -0.5) y = p.y - h - 2;
  else if (n.y > 0.5) y = p.y + 12;
  return { x: p.x, y, anchor };
}

/** Angle from a state centre to a point, for dragging self-loops around the state. */
export const angleTo = (c: Pt, p: Pt) => Math.atan2(p.y - c.y, p.x - c.x);

export function bounds(points: Pt[], pad = 90): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 600, h: 400 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs) - pad - 50; // room for the Start arrow
  const y0 = Math.min(...ys) - pad;
  const x1 = Math.max(...xs) + pad;
  const y1 = Math.max(...ys) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
