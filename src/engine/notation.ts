// Course notation helpers: state names with subscripts, λ, sets, and input-string parsing.
import type { Machine, StateId, Sym } from './types';

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

export const LAMBDA = 'λ';

export interface LabelPart {
  text: string;
  sub?: string;
}

const SIMPLE = /^([A-Za-z]+?)_?(\d+|[A-Za-z][A-Za-z0-9']*)?$/;

function parseSimple(name: string): LabelPart[] {
  // "s0" -> s, 0. "s_A" -> s, A. "d" -> d. "dead" -> dead.
  const underscore = name.indexOf('_');
  if (underscore > 0) {
    return [{ text: name.slice(0, underscore), sub: name.slice(underscore + 1) }];
  }
  const m = /^([A-Za-z]+)(\d+)$/.exec(name);
  if (m) return [{ text: m[1], sub: m[2] }];
  if (SIMPLE.test(name)) return [{ text: name }];
  return [{ text: name }];
}

/** Split a state name into text and subscript parts, e.g. "{s0,s1}" -> {, s₀, ", ", s₁, }. */
export function labelParts(name: string): LabelPart[] {
  if (name === '{}' || name === '∅') return [{ text: '∅' }];
  if (name.startsWith('{') && name.endsWith('}')) {
    const inner = name.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    const parts: LabelPart[] = [{ text: '{' }];
    inner.forEach((n, i) => {
      if (i > 0) parts.push({ text: ', ' });
      parts.push(...parseSimple(n));
    });
    parts.push({ text: '}' });
    return parts;
  }
  return parseSimple(name);
}

function subText(s: string): string {
  if (/^\d+$/.test(s)) return [...s].map((c) => SUB_DIGITS[Number(c)]).join('');
  return '_' + s;
}

/** Plain-text form with Unicode subscripts: "s0" -> "s₀". */
export function plainName(name: string): string {
  return labelParts(name)
    .map((p) => p.text + (p.sub !== undefined ? subText(p.sub) : ''))
    .join('');
}

function texEscape(s: string): string {
  return s.replace(/([#$%&_{}])/g, '\\$1');
}

function texAtom(text: string): string {
  if (text === '∅') return '\\emptyset';
  if (text === '{') return '\\{';
  if (text === '}') return '\\}';
  if (text === ', ') return ', ';
  if (/^[A-Za-z]$/.test(text)) return text;
  if (/^[A-Za-z0-9]+$/.test(text) && text.length > 1) return `\\mathit{${text}}`;
  return `\\text{${texEscape(text)}}`;
}

/** KaTeX/LaTeX form: "s0" -> "s_{0}", "{s0,s1}" -> "\{s_{0}, s_{1}\}". */
export function texName(name: string): string {
  return labelParts(name)
    .map((p) => texAtom(p.text) + (p.sub !== undefined ? `_{${texEscape(p.sub)}}` : ''))
    .join('');
}

export function stateName(m: Pick<Machine, 'names'>, id: StateId): string {
  return m.names?.[id] ?? id;
}

/** Plain-text set of state names: "{s₀, s₁}" or "∅". */
export function plainSet(m: Pick<Machine, 'names'>, ids: Iterable<StateId>): string {
  const arr = [...ids];
  if (arr.length === 0) return '∅';
  return '{' + arr.map((id) => plainName(stateName(m, id))).join(', ') + '}';
}

export function texSet(m: Pick<Machine, 'names'>, ids: Iterable<StateId>): string {
  const arr = [...ids];
  if (arr.length === 0) return '\\emptyset';
  return '\\{' + arr.map((id) => texName(stateName(m, id))).join(', ') + '\\}';
}

export function isMultiChar(alphabet: Sym[]): boolean {
  return alphabet.some((s) => [...s].length !== 1);
}

/** Display a word over an alphabet: λ for empty, spaces between multi-character symbols. */
export function showWord(w: Sym[], multi = false): string {
  if (w.length === 0) return LAMBDA;
  return w.join(multi || w.some((s) => [...s].length !== 1) ? ' ' : '');
}

export function isLambdaText(t: string): boolean {
  const s = t.trim();
  return s === '' || s === 'λ' || s === 'lambda' || s === '\\lambda' || s === 'ε';
}

export interface ParsedWord {
  word: Sym[];
  error?: string;
}

/** Parse a typed string into symbols of the alphabet. */
export function parseWord(text: string, alphabet: Sym[], alphabetName = 'I'): ParsedWord {
  if (isLambdaText(text)) return { word: [] };
  const multi = isMultiChar(alphabet);
  const word = multi ? text.trim().split(/\s+/) : [...text.replace(/\s+/g, '')];
  const set = new Set(alphabet);
  const bad = word.find((s) => !set.has(s));
  if (bad !== undefined) {
    return {
      word,
      error: `“${bad}” isn't in ${alphabetName} = {${alphabet.join(', ')}}.` +
        (multi ? ' Separate symbols with spaces.' : ''),
    };
  }
  return { word };
}

export function sortSyms(syms: Iterable<Sym>): Sym[] {
  return [...syms].sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0));
}

/** Shortlex comparison of words. */
export function shortlex(a: Sym[], b: Sym[], order: Sym[]): number {
  if (a.length !== b.length) return a.length - b.length;
  const rank = new Map(order.map((s, i) => [s, i]));
  for (let i = 0; i < a.length; i++) {
    const d = (rank.get(a[i]) ?? 0) - (rank.get(b[i]) ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
