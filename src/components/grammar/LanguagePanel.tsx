// Live L(G): the words up to length n and, where possible, a set-builder description.
import { useEffect, useState } from 'react';
import type { Grammar, Sym } from '../../engine/types';
import type { Guess } from '../../engine/describe';
import { useJob } from '../../workers/client';
import { Tex } from '../Tex';

interface Result {
  words: Sym[][];
  complete: boolean;
  guess: Guess | null;
}

export default function LanguagePanel({ g, gKey }: { g: Grammar; gKey: string }) {
  const [n, setN] = useState(6);
  const job = useJob<Result>();
  const { start } = job;

  useEffect(() => {
    const t = setTimeout(() => void start({ type: 'describe', grammar: g, n, timeLimitMs: 6000 }).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [gKey, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = job.result;
  const shown = r?.words.slice(0, 40) ?? [];
  return (
    <section className="language-panel" aria-label="The language L(G)">
      <div className="row">
        <h2 className="h-sm">L(G)</h2>
        <span className="spacer" />
        <label className="row xsmall muted">
          up to length
          <input type="number" min={1} max={10} value={n} onChange={(e) => setN(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ width: '4.5em' }} />
        </label>
      </div>
      <div aria-live="polite">
        {job.slow && <p className="small muted">Working it out…</p>}
        {job.error && <p className="small reject">{job.error}</p>}
        {r && (
          <>
            {r.guess ? (
              <div>
                <Tex display className="guess">{`L(G) = ${r.guess.tex}`}</Tex>
                <p className="xsmall muted">A description that agrees with L(G) on every string up to length {r.guess.n}. It is a pattern match, not a proof.</p>
              </div>
            ) : (
              <p className="small muted">{r.complete ? 'No simple set-builder description found.' : 'The search limit was hit, so the list may be incomplete.'}</p>
            )}
            <p className="small">
              <span className="muted">{r.words.length}{r.complete ? '' : '+'} word{r.words.length === 1 ? '' : 's'} up to length {n}: </span>
              <span className="mono wrap">{shown.length ? shown.map((w) => (w.length ? w.join('') : 'λ')).join(', ') : '∅ (none)'}{r.words.length > shown.length ? ', …' : ''}</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
