// Grammar classifier: implements the course's Type 0–3 table exactly (types aren't nested).
import type { Grammar, Production, Sym } from './types';
import { nonTerminals, showProduction } from './grammar';

export type GrammarType = 0 | 1 | 2 | 3;

export interface TypeCheck {
  type: GrammarType;
  ok: boolean;
  /** First offending production, if any. */
  offending?: Production;
  reason?: string;
}

export interface Classification {
  /** Largest k for which G is of type k. */
  type: GrammarType;
  checks: Record<GrammarType, TypeCheck>;
  notes: string[];
}

export const TYPE_NAMES: Record<GrammarType, string> = {
  0: 'unrestricted',
  1: 'context-sensitive',
  2: 'context-free',
  3: 'regular',
};

const eq = (a: Sym[], b: Sym[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** w₁ = lAr and w₂ = lwr with A ∈ N and w ≠ λ, for some occurrence of a non-terminal A in w₁. */
export function isLAr(p: Production, N: Set<Sym>): boolean {
  const { lhs, rhs } = p;
  for (let i = 0; i < lhs.length; i++) {
    if (!N.has(lhs[i])) continue;
    const l = lhs.slice(0, i);
    const r = lhs.slice(i + 1);
    if (rhs.length < l.length + r.length + 1) continue;
    if (eq(rhs.slice(0, l.length), l) && eq(rhs.slice(rhs.length - r.length), r)) return true;
  }
  return false;
}

function rhsContaining(g: Grammar, sym: Sym): Production | undefined {
  return g.P.find((p) => p.rhs.includes(sym));
}

export function classify(g: Grammar): Classification {
  const N = new Set(nonTerminals(g));
  const T = new Set(g.T);
  const S = g.S;
  const sOnRight = rhsContaining(g, S);
  const isSLambda = (p: Production) => p.lhs.length === 1 && p.lhs[0] === S && p.rhs.length === 0;

  // Type 3
  let t3: TypeCheck = { type: 3, ok: true };
  for (const p of g.P) {
    const singleNT = p.lhs.length === 1 && N.has(p.lhs[0]);
    const ok = isSLambda(p) || (singleNT && (
      (p.rhs.length === 1 && T.has(p.rhs[0])) ||
      (p.rhs.length === 2 && T.has(p.rhs[0]) && N.has(p.rhs[1]))
    ));
    if (!ok) {
      let reason: string;
      if (!singleNT) reason = `${showProduction(p)} has more than a single non-terminal on its left side.`;
      else if (p.rhs.length === 0) reason = `${showProduction(p)} isn't allowed: only S → λ may have an empty right-hand side.`;
      else if (p.rhs.length === 2 && N.has(p.rhs[0]) && T.has(p.rhs[1])) {
        reason = `${showProduction(p)} is left-linear (A → Ba). Type 3 in this course needs A → aB or A → a. The language may still be regular: the type of a grammar ≠ the type of its language.`;
      } else reason = `${showProduction(p)} isn't of the form A → aB, A → a or S → λ.`;
      t3 = { type: 3, ok: false, offending: p, reason };
      break;
    }
  }

  // Type 2
  let t2: TypeCheck = { type: 2, ok: true };
  for (const p of g.P) {
    if (!(p.lhs.length === 1 && N.has(p.lhs[0]))) {
      t2 = { type: 2, ok: false, offending: p, reason: `${showProduction(p)} has more than one symbol on its left side; type 2 needs a single non-terminal.` };
      break;
    }
  }

  // Type 1
  let t1: TypeCheck = { type: 1, ok: true };
  for (const p of g.P) {
    if (isSLambda(p)) {
      if (sOnRight) {
        t1 = {
          type: 1, ok: false, offending: p,
          reason: `${showProduction(p)} fails type 1 because ${S} appears on the right-hand side of ${showProduction(sOnRight)}.`,
        };
        break;
      }
      continue;
    }
    if (!isLAr(p, N)) {
      const reason = p.rhs.length === 0
        ? `${showProduction(p)} fails type 1: only ${S} → λ may have an empty right-hand side (and only if ${S} is on no right-hand side).`
        : p.rhs.length < p.lhs.length
          ? `${showProduction(p)} shrinks the string, so it can't be written as lAr → lwr with w ≠ λ.`
          : `${showProduction(p)} can't be written as lAr → lwr (A ∈ N, w ≠ λ): the context around the rewritten non-terminal changes.`;
      t1 = { type: 1, ok: false, offending: p, reason };
      break;
    }
  }

  const t0: TypeCheck = { type: 0, ok: true };
  const checks = { 0: t0, 1: t1, 2: t2, 3: t3 } as Record<GrammarType, TypeCheck>;
  const type: GrammarType = t3.ok ? 3 : t2.ok ? 2 : t1.ok ? 1 : 0;

  const notes: string[] = [];
  if ((t3.ok || t2.ok) && !t1.ok) {
    notes.push(`Because of the λ rules, the types aren't nested: this grammar is type ${type} but not type 1.`);
  }
  if (t3.offending && t3.offending.rhs.length === 2 && N.has(t3.offending.rhs[0]) && T.has(t3.offending.rhs[1]) && t2.ok) {
    notes.push('Left-linear rules such as A → Ba aren’t type 3 under the course definition, even though L(G) may be regular.');
  }
  if (type < 3) {
    notes.push('This classifies the grammar, not the language. L(G) might also have a grammar of a higher type.');
  }
  return { type, checks, notes };
}

/** Does G satisfy the type-k restriction (per-type check, since types aren't nested)? */
export function satisfiesType(g: Grammar, k: GrammarType): boolean {
  return classify(g).checks[k].ok;
}
