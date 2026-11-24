import { useState } from 'react';
import { Link } from 'react-router';
import { breadcrumbs, DISCLAIMER, REPO_URL, type Head } from '../seo/site';
import { resetProgress } from '../store/progress';
import { useConfirm } from '../components/Confirm';
import { useHydrated } from '../components/hooks';

export const handle = {
  head: (): Head => ({
    title: 'About · Computation Model Builder',
    description: 'An unofficial, open-source learning aid for MATH1064/1964 students at the University of Sydney.',
    path: '/about/',
    jsonLd: [breadcrumbs([{ name: 'Home', path: '/' }, { name: 'About', path: '/about/' }])],
  }),
};

function ResetProgress() {
  const confirm = useConfirm();
  const hydrated = useHydrated();
  const [done, setDone] = useState(false);
  return (
    <div className="row">
      <button type="button" className="btn btn-danger" disabled={!hydrated} onClick={async () => {
        const ok = await confirm({
          title: 'Reset practice progress?',
          body: 'This clears your solved and attempted marks, hint counts and saved answers for every problem in this browser. It can’t be undone. Your saved machines and grammar are kept.',
          confirmLabel: 'Reset progress',
        });
        if (ok) {
          resetProgress();
          setDone(true);
        }
      }}>Reset progress</button>
      <span className="small muted" aria-live="polite">{done ? 'Progress reset.' : ''}</span>
    </div>
  );
}

export function Component() {
  return (
    <div className="page prose">
      <h1>About Computation Model Builder</h1>
      <p>
        Computation Model Builder is a free learning aid for students of MATH1064 (Discrete Mathematics for Computer
        Science) and MATH1964 (the Advanced stream) at the University of Sydney. It covers the course’s last topic:
        finite state machines, with and without output, non-deterministic FSMs, phrase-structure grammars and the
        types of grammars. Everything uses the course’s notation, so what you see here should look like your lecture
        notes.
      </p>
      <p><strong>{DISCLAIMER}</strong></p>

      <h2>How checking works</h2>
      <ul>
        <li>
          <strong>Machines</strong> are compared with a model solution exactly. The checker determinises both machines
          and searches their product, so if your machine is wrong you get the <em>shortest</em> string on which they
          differ (the lexicographically smallest one if there are several).
        </li>
        <li>
          <strong>FSMs with output</strong> are compared the same way, and you get the shortest input whose output
          differs, with both outputs.
        </li>
        <li>
          <strong>Grammars</strong> can’t be compared exactly in general, so your grammar is checked against the
          target language on every string up to a fixed length (usually 10, or 8 or 9 for three terminals). Passing
          is strong evidence, not a proof. For context-free grammars membership is decided with an Earley parser; for
          other grammars a bounded search over sentential forms is used.
        </li>
        <li>Everything runs in your browser. Nothing is sent anywhere, and there are no accounts or analytics.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        Your machines, your grammar and your practice progress are saved in this browser’s local storage. Clearing
        site data removes them.
      </p>
      <ResetProgress />

      <h2>Contributing</h2>
      <p>
        The source is on <a href={REPO_URL}>GitHub</a> under the MIT licence. New practice problems are welcome:
        each one needs a statement in course notation, three hints, an explanation and a model solution, and it must
        pass the automatic verification test. See <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>CONTRIBUTING.md</a>.
        If you spot a mistake in notation, please open an issue.
      </p>

      <h2>Credits</h2>
      <p>
        Notation follows the MATH1064/1964 lecture notes, which are based on Rosen, <em>Discrete Mathematics and Its
        Applications</em> (7th ed.), Chapter 13. All machines, grammars and problems here are original. Maths is
        typeset with KaTeX, and generated machines are laid out with dagre.
      </p>
      <p><Link to="/notation/">Read the notation cheat sheet</Link> · <Link to="/practice/">Start practising</Link></p>
    </div>
  );
}
