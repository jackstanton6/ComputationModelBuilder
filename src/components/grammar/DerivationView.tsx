import type { Derivation } from '../../engine/derivation';
import { showProduction } from '../../engine/grammar';
import type { Sym } from '../../engine/types';

export function FormText({ form, from, to }: { form: Sym[]; from?: number; to?: number }) {
  if (form.length === 0) return <span>{from !== undefined ? <mark className="rw">λ</mark> : 'λ'}</span>;
  if (from === undefined || to === undefined || to <= from) return <span>{form.join('')}</span>;
  return (
    <span>
      {form.slice(0, from).join('')}
      <mark className="rw">{form.slice(from, to).join('')}</mark>
      {form.slice(to).join('')}
    </span>
  );
}

/** One step per line, with the rewritten part highlighted and the production used. */
export default function DerivationView({ d, showRules = true }: { d: Derivation; showRules?: boolean }) {
  return (
    <ol className="derivation" aria-label="Derivation">
      {d.forms.map((form, k) => {
        const step = k > 0 ? d.steps[k - 1] : undefined;
        return (
          <li key={k}>
            <span className="arrow" aria-hidden="true">{k === 0 ? '' : '⇒'}</span>
            {k > 0 && <span className="sr-only">directly derives </span>}
            <FormText form={form} from={step?.pos} to={step ? step.pos + step.prod.rhs.length : undefined} />
            {showRules && step && <span className="xsmall muted">{'  '}({showProduction(step.prod)})</span>}
          </li>
        );
      })}
    </ol>
  );
}
