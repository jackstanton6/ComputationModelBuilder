// Derivations: w₀ ⇒ w₁ ⇒ … with the rewritten part recorded for highlighting.
import type { Production, Sym } from './types';

export interface DerivationStep {
  prod: Production;
  /** Position in the previous form where prod.lhs was rewritten. */
  pos: number;
}

export interface Derivation {
  /** forms[0] = [S]; forms[k + 1] = result of steps[k]. */
  forms: Sym[][];
  steps: DerivationStep[];
}

export function occurrences(form: Sym[], lhs: Sym[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + lhs.length <= form.length; i++) {
    let ok = true;
    for (let j = 0; j < lhs.length; j++) {
      if (form[i + j] !== lhs[j]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

export function applyAt(form: Sym[], prod: Production, pos: number): Sym[] {
  return [...form.slice(0, pos), ...prod.rhs, ...form.slice(pos + prod.lhs.length)];
}

export function showForm(form: Sym[]): string {
  return form.length === 0 ? 'λ' : form.join('');
}

/** "S ⇒ 0S1 ⇒ 01" */
export function showDerivation(d: Derivation): string {
  return d.forms.map(showForm).join(' ⇒ ');
}
