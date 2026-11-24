// Grammar parsing (course syntax), validation and inference of V, T and N.
import type { Grammar, Production, Sym } from './types';
import { LIMITS } from './types';

export interface GrammarError {
  line: number; // 1-based
  message: string;
}

export interface VocabularyOverride {
  /** Explicit terminals. Symbols listed here are terminals even if uppercase. */
  T?: Sym[];
  /** Extra symbols to include in V. */
  V?: Sym[];
}

export interface ParsedGrammar {
  grammar: Grammar;
  errors: GrammarError[];
  /** Line (1-based) each production came from. */
  lines: number[];
}

/** Default rule: uppercase letters and ⟨…⟩ symbols are non-terminals. */
export function looksNonTerminal(s: Sym): boolean {
  return /^[A-Z]$/.test(s) || (s.startsWith('⟨') && s.endsWith('⟩') && s.length > 2) || /^[A-Z]['′0-9]+$/.test(s);
}

const ARROWS = /->|→|::=/;

/** Tokenise one side of a production into symbols. */
export function tokenise(side: string): { syms: Sym[]; error?: string } {
  const t = side.trim();
  if (t === '' || t === 'λ' || t === 'lambda' || t === '\\lambda' || t === 'ε') return { syms: [] };
  const syms: Sym[] = [];
  const chars = [...t];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) continue;
    if (c === '<' || c === '⟨') {
      const close = c === '<' ? '>' : '⟩';
      const j = chars.indexOf(close, i + 1);
      if (j < 0) return { syms, error: `Missing ${close} after ${c}.` };
      const name = chars.slice(i + 1, j).join('').trim();
      if (!name) return { syms, error: 'Empty ⟨⟩ symbol.' };
      syms.push(`⟨${name}⟩`);
      i = j;
      continue;
    }
    if (c === 'λ') {
      return { syms, error: 'λ can only stand alone as a whole right-hand side.' };
    }
    // Allow primes on non-terminals: A′ or A'.
    if (/[A-Z]/.test(c) && (chars[i + 1] === "'" || chars[i + 1] === '′')) {
      syms.push(c + '′');
      i++;
      continue;
    }
    syms.push(c);
  }
  return { syms };
}

export function parseGrammar(text: string, start = 'S', override: VocabularyOverride = {}): ParsedGrammar {
  const errors: GrammarError[] = [];
  const P: Production[] = [];
  const lines: number[] = [];
  const rawLines = text.split(/\r?\n/);
  const terminalOverride = override.T ? new Set(override.T) : null;
  const isNT = (s: Sym) => (terminalOverride ? !terminalOverride.has(s) : looksNonTerminal(s));
  rawLines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.replace(/(^|\s)(#|%|\/\/).*$/, '').trim();
    if (!line) return;
    const m = ARROWS.exec(line);
    if (!m) {
      errors.push({ line: lineNo, message: 'Expected an arrow: write productions like S -> 0S1 | 01.' });
      return;
    }
    const lhsText = line.slice(0, m.index);
    const rhsText = line.slice(m.index + m[0].length);
    if (ARROWS.test(rhsText)) {
      errors.push({ line: lineNo, message: 'Only one arrow per line.' });
      return;
    }
    const lhs = tokenise(lhsText);
    if (lhs.error) {
      errors.push({ line: lineNo, message: lhs.error });
      return;
    }
    if (lhs.syms.length === 0) {
      errors.push({ line: lineNo, message: 'The left side of a production can’t be λ.' });
      return;
    }
    for (const alt of rhsText.split('|')) {
      const rhs = tokenise(alt);
      if (rhs.error) {
        errors.push({ line: lineNo, message: rhs.error });
        continue;
      }
      P.push({ lhs: lhs.syms, rhs: rhs.syms });
      lines.push(lineNo);
    }
    if (!lhs.syms.some(isNT)) {
      errors.push({
        line: lineNo,
        message: `${lhs.syms.join('')} → … has no non-terminal on its left side. Every production needs at least one.`,
      });
    }
  });
  // Deduplicate productions (P is a set).
  const seen = new Set<string>();
  const dedupP: Production[] = [];
  const dedupLines: number[] = [];
  P.forEach((p, i) => {
    const k = p.lhs.join(' ') + '→' + p.rhs.join(' ');
    if (!seen.has(k)) {
      seen.add(k);
      dedupP.push(p);
      dedupLines.push(lines[i]);
    }
  });
  if (dedupP.length > LIMITS.maxProductions) {
    errors.push({ line: 0, message: `This grammar has ${dedupP.length} productions. The limit is ${LIMITS.maxProductions}.` });
  }
  const symbols = new Set<Sym>([start, ...(override.V ?? [])]);
  for (const p of dedupP) for (const s of [...p.lhs, ...p.rhs]) symbols.add(s);
  const V = orderSymbols([...symbols]);
  const T = terminalOverride
    ? V.filter((s) => terminalOverride.has(s))
    : V.filter((s) => !looksNonTerminal(s));
  if (terminalOverride) for (const t of terminalOverride) if (!V.includes(t)) { V.push(t); T.push(t); }
  if (T.includes(start)) errors.push({ line: 0, message: `The start symbol ${start} must be a non-terminal.` });
  if (dedupP.length === 0 && errors.length === 0) errors.push({ line: 0, message: 'P is empty. Add a production such as S -> 0S1 | 01.' });
  return { grammar: { V, T: orderSymbols(T), S: start, P: dedupP }, errors, lines: dedupLines };
}

/** Order: start-ish non-terminals first (S, then A–Z, then ⟨…⟩), then terminals. */
export function orderSymbols(syms: Sym[]): Sym[] {
  const rank = (s: Sym) => (s === 'S' ? 0 : looksNonTerminal(s) ? 1 : 2);
  return [...new Set(syms)].sort((a, b) => rank(a) - rank(b) || (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0));
}

export const nonTerminals = (g: Grammar): Sym[] => g.V.filter((s) => !g.T.includes(s));

export function isContextFree(g: Grammar): boolean {
  const N = new Set(nonTerminals(g));
  return g.P.every((p) => p.lhs.length === 1 && N.has(p.lhs[0]));
}

export function showSyms(syms: Sym[]): string {
  return syms.length === 0 ? 'λ' : syms.join('');
}

export function showProduction(p: Production): string {
  return `${showSyms(p.lhs)} → ${showSyms(p.rhs)}`;
}

/** Plain-text P in set notation: P = {S → 0S1, S → 01}. */
export function showP(g: Grammar): string {
  return `{${g.P.map(showProduction).join(', ')}}`;
}

/** Serialise a grammar back to editor text, grouping alternatives with |. */
export function grammarToText(g: Grammar): string {
  const groups = new Map<string, Production[]>();
  for (const p of g.P) {
    const k = showSyms(p.lhs);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  return [...groups.entries()].map(([lhs, ps]) => `${lhs} -> ${ps.map((p) => showSyms(p.rhs)).join(' | ')}`).join('\n');
}

/** Build a grammar from compact text (used by problems and tests). Throws on errors. */
export function grammar(text: string, start = 'S', override: VocabularyOverride = {}): Grammar {
  const r = parseGrammar(text, start, override);
  if (r.errors.length) throw new Error(r.errors.map((e) => `line ${e.line}: ${e.message}`).join('; '));
  return r.grammar;
}
