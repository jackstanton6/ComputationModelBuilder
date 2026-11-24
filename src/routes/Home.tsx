import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SITE_NAME, SITE_URL, SUBTITLE, type Head } from '../seo/site';
import { getLastVisit, readJSON, type LastVisit } from '../store/persist';

import { PROBLEM_COUNT as TOTAL } from '../problems/count';

export const handle = {
  head: (): Head => ({
    title: 'Computation Model Builder · FSMs & grammars for MATH1064/1964',
    description: 'Build and test finite state machines and grammars in MATH1064/1964 notation. Step-through simulator, Chomsky type checker and 70 auto-checked practice problems.',
    path: '/',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL + '/', inLanguage: 'en-AU' },
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: SITE_URL + '/',
        description: 'Finite state machine simulator, grammar workbench and practice problems for MATH1064/1964 (Discrete Mathematics) at the University of Sydney.',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'AUD' },
        audience: { '@type': 'EducationalAudience', educationalRole: 'student', audienceType: 'university students' },
        inLanguage: 'en-AU',
      },
    ],
  }),
};

export function Component() {
  const [solved, setSolved] = useState<number | null>(null);
  const [last, setLast] = useState<LastVisit | null>(null);
  useEffect(() => {
    const progress = readJSON<Record<string, { solved?: boolean }>>('progress', {});
    setSolved(Object.values(progress).filter((p) => p.solved).length);
    setLast(getLastVisit());
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <h1>Computation Model Builder</h1>
        <p className="subtitle">{SUBTITLE}</p>
        <p className="lede">Draw finite state machines, write grammars, and watch them run, in the same notation as your lectures.</p>
      </section>

      {last && (
        <div className="continue">
          <span className="small muted">Continue where you left off:</span>
          <Link to={last.path}>{last.label}</Link>
        </div>
      )}

      <div className="cards">
        <Link to="/machines/" className="card">
          <h2>Build a machine</h2>
          <p>FSMs without output, non-deterministic FSMs and FSMs with output. Step through inputs, edit the state table, use the subset construction and export to TikZ.</p>
        </Link>
        <Link to="/grammars/" className="card">
          <h2>Write a grammar</h2>
          <p>G = (V, T, S, P) in course notation. Classify it with the Type 0–3 table, derive words step by step and test membership.</p>
        </Link>
        <Link to="/practice/" className="card">
          <h2>Practise</h2>
          <p>{TOTAL} auto-checked problems from warm-up to challenge, with the shortest counterexample when you’re wrong.</p>
          <p className="small" aria-live="polite">{solved === null ? ' ' : `${solved} of ${TOTAL} solved`}</p>
        </Link>
      </div>

      <section className="prose">
        <h2>What is this?</h2>
        <p>
          A free, unofficial learning aid for the finite state machine and grammar topics of MATH1064 and MATH1964
          (discrete mathematics) at the University of Sydney. It is a finite state machine simulator and FSM builder,
          a subset construction tool (NFA to DFA), and a grammar type checker for the Chomsky hierarchy, but everything
          is written the way your lectures write it: f and g, s₀, λ for the empty string, L(M), and G = (V, T, S, P).
        </p>
        <p>
          New to the notation? Start with the <Link to="/notation/">notation cheat sheet</Link>, or read the
          short <Link to="/guides/">guides</Link> on the subset construction, Kleene’s theorem and the types of grammars. Everything you build
          is saved in your browser; there are no accounts.
        </p>
      </section>
    </div>
  );
}
