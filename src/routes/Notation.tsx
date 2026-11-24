import { breadcrumbs, canonical, isPartOfSite, type Head } from '../seo/site';
import { Tex, Inline } from '../components/Tex';
import { Diagram } from '../components/machine/Diagram';
import StaticTable from '../components/machine/StaticTable';
import { machineToDoc } from '../store/machineDoc';
import { dfa, mealy } from '../problems/dsl';

const DESCRIPTION = 'λ, f and g, L(M), G = (V, T, S, P), the Type 0–3 table, Kleene’s theorem and common traps, in one printable page.';

export const handle = {
  head: (): Head => ({
    title: 'MATH1064/1964 notation cheat sheet: FSMs & grammars',
    description: DESCRIPTION,
    path: '/notation/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        name: 'MATH1064/1964 notation cheat sheet: FSMs & grammars',
        description: DESCRIPTION,
        url: canonical('/notation/'),
        learningResourceType: 'Reference',
        educationalLevel: 'First-year university',
        teaches: 'Finite state machines and grammars',
        inLanguage: 'en-AU',
        isAccessibleForFree: true,
        isPartOf: isPartOfSite,
      },
      breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Notation', path: '/notation/' }]),
    ],
  }),
};

// One-unit delay: outputs the previous input bit (0 first).
const delay = mealy(`>s0 | s0/0 s1/0
  s1 | s0/1 s1/1`);
const delayDoc = machineToDoc(delay, { s0: { x: 0, y: 0 }, s1: { x: 200, y: 0 } });

// Accepts strings ending in 1.
const ends1 = dfa(`>s0 | s0 s1
  *s1 | s0 s1`);
const ends1Doc = machineToDoc(ends1, { s0: { x: 0, y: 0 }, s1: { x: 200, y: 0 } });

const SECTIONS = [
  ['strings', 'Strings and languages'],
  ['with-output', 'FSM with output'],
  ['without-output', 'FSM without output'],
  ['nondeterministic', 'Non-deterministic FSM'],
  ['grammars', 'Grammars'],
  ['types', 'Types of grammars'],
  ['kleene', 'Kleene’s theorem and constructions'],
  ['traps', 'Common traps'],
  ['beyond', 'Beyond this course'],
] as const;

function Hierarchy() {
  return (
    <svg className="hierarchy" viewBox="0 0 520 300" role="img" aria-labelledby="hier-title hier-desc">
      <title id="hier-title">The Chomsky hierarchy of languages</title>
      <desc id="hier-desc">Nested regions: regular languages inside context-free languages, inside context-sensitive languages, inside the languages of type 0 grammars.</desc>
      <g fill="none" stroke="var(--text)" strokeWidth="1.5">
        <ellipse cx="260" cy="150" rx="250" ry="140" />
        <ellipse cx="260" cy="168" rx="195" ry="110" />
        <ellipse cx="260" cy="186" rx="140" ry="80" />
        <ellipse cx="260" cy="204" rx="85" ry="50" stroke="var(--accent)" />
      </g>
      <g fontFamily="system-ui, sans-serif" fontSize="12" fill="var(--text)" textAnchor="middle">
        <text x="260" y="34">Type 0</text>
        <text x="260" y="90">Type 1 (context-sensitive): 0ⁿ1ⁿ2ⁿ</text>
        <text x="260" y="138">Type 2 (context-free): 0ⁿ1ⁿ</text>
        <text x="260" y="200" fill="var(--accent-strong)">Type 3 (regular)</text>
        <text x="260" y="220" fill="var(--accent-strong)">0ⁿ1ᵐ</text>
      </g>
    </svg>
  );
}

export function Component() {
  return (
    <div className="page notation">
      <h1>Notation cheat sheet</h1>
      <p className="prose">
        The notation used in MATH1064/1964 for finite state machines and grammars (following Rosen, Ch. 13), on one
        printable page. Everything in Computation Model Builder uses exactly this notation.
      </p>
      <nav aria-label="Contents" className="no-print">
        <ol className="toc">{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
      </nav>

      <section id="strings">
        <h2>1. Strings and languages</h2>
        <ul className="prose">
          <li><Inline text="An **alphabet** is a finite set: the input alphabet $I$ for FSMs, the vocabulary $V$ for grammars." /></li>
          <li><Inline text="The **empty string** is $\lambda$, with $|\lambda| = 0$." /></li>
          <li><Inline text="$A^\star$ is the set of all strings over $A$ (including $\lambda$), for example $I^\star$ and $V^\star$." /></li>
          <li><Inline text="**Concatenation** $xy$ writes $y$ after $x$; $x\lambda = \lambda x = x$." /></li>
          <li><Inline text="A **language** is a subset of $A^\star$. We write $L(M)$ for the language of a machine and $L(G)$ for the language of a grammar, for example $L = \{0^n1^n \mid n \geq 1\}$." /></li>
        </ul>
      </section>

      <section id="with-output">
        <h2>2. Finite state machine with output</h2>
        <Tex display>{'M = (S, I, O, f, g, s_0)'}</Tex>
        <ul className="prose">
          <li><Inline text="$S$ states, $I$ input alphabet, $O$ output alphabet, $s_0$ initial state." /></li>
          <li><Inline text="**Transition function** $f : S \times I \to S$ and **output function** $g : S \times I \to O$." /></li>
          <li><Inline text="Edges are labelled $i, o$: on input $i$, output $o$. Several labels on one edge are stacked." /></li>
          <li><Inline text="No accepting states. An input $x$ produces an output string of the same length." /></li>
        </ul>
        <p className="small">Example: a one-unit delay outputs 0, then each input bit one step late (input 1101 gives 0110).</p>
        <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-8)' }}>
          <div className="diagram-frame" style={{ flex: '1 1 280px', maxWidth: 380 }}><Diagram doc={delayDoc} title="One-unit delay" maxHeight={200} /></div>
          <StaticTable m={delay} caption="State table of the one-unit delay" />
        </div>
      </section>

      <section id="without-output">
        <h2>3. Finite state machine without output</h2>
        <Tex display>{'M = (S, I, f, s_0, F), \\qquad f : S \\times I \\to S \\text{ (total)}, \\qquad F \\subseteq S'}</Tex>
        <ul className="prose">
          <li><Inline text="$F$ is the set of **final** (accepting) states, drawn as **double circles**. The initial state has an arrow labelled **Start**." /></li>
          <li><Inline text="**Extended** $f : S \times I^\star \to S$: $f(s, x)$ is the state reached from $s$ by reading $x$ left to right, and $f(s, \lambda) = s$." /></li>
          <li><Inline text="$x$ is **recognised** (accepted) if $f(s_0, x) \in F$, and $L(M) = \{x \in I^\star \mid f(s_0, x) \in F\}$." /></li>
          <li><Inline text="$f$ must be defined for every $s \in S$ and $i \in I$. A missing arrow is an error, not a rejection: add a dead state." /></li>
        </ul>
        <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-8)' }}>
          <div className="diagram-frame" style={{ flex: '1 1 280px', maxWidth: 380 }}><Diagram doc={ends1Doc} title="FSM without output accepting strings ending in 1" maxHeight={200} /></div>
          <StaticTable m={ends1} caption="State table of an FSM accepting strings ending in 1" />
        </div>
      </section>

      <section id="nondeterministic">
        <h2>4. Non-deterministic FSM</h2>
        <Tex display>{'f : S \\times I \\to \\mathcal{P}(S)'}</Tex>
        <ul className="prose">
          <li><Inline text="$f(s, i)$ is a **set** of states and may be $\emptyset$ (no edge). There are no $\lambda$-transitions." /></li>
          <li><Inline text="$f(s_0, x)$ is the set of states reachable by reading $x$. $x$ is accepted iff $f(s_0, x) \cap F \neq \emptyset$." /></li>
          <li><Inline text="**Subset construction:** the states of the new machine are subsets $V \subseteq S$. On input $i$, $V$ goes to the set of states reachable from elements of $V$ on $i$. $V$ is final iff it contains a final state. Only build the subsets reachable from $\{s_0\}$." /></li>
        </ul>
      </section>

      <section id="grammars">
        <h2>5. Grammars</h2>
        <Tex display>{'G = (V, T, S, P), \\qquad T \\subseteq V, \\qquad S \\in V, \\qquad N = V - T'}</Tex>
        <ul className="prose">
          <li><Inline text="$V$ vocabulary, $T$ terminals, $N$ non-terminals, $S$ start symbol, $P$ finite set of productions $w_0 \to w_1$." /></li>
          <li><Inline text="Every production must have **at least one non-terminal on its left side**." /></li>
          <li><Inline text="$w_0 \Rightarrow w_1$: $w_1$ is **directly derivable** from $w_0$ (one production applied once). $w \Rightarrow^\star w'$: **derivable** (zero or more steps)." /></li>
          <li><Inline text="$L(G)$ is the set of strings of terminals derivable from $S$, so $L(G) \subseteq T^\star \subseteq V^\star$." /></li>
          <li><Inline text="P is written as a set, for example $P = \{S \to 0S1,\ S \to 01\}$, and $S \Rightarrow 0S1 \Rightarrow 0011$." /></li>
        </ul>
      </section>

      <section id="types">
        <h2>6. Types of grammars</h2>
        <table className="type-table">
          <thead><tr><th>Type</th><th>Name</th><th>Restrictions on productions <Tex>{'w_1 \\to w_2'}</Tex></th></tr></thead>
          <tbody>
            <tr><td>0</td><td>(unrestricted)</td><td>No restrictions beyond the grammar definition</td></tr>
            <tr><td>1</td><td>context-sensitive</td><td><Inline text="$w_1 = lAr$, $w_2 = lwr$ with $A \in N$, $l, r, w \in V^\star$, $w \neq \lambda$; or $w_1 = S$, $w_2 = \lambda$ if $S$ is on no right-hand side" /></td></tr>
            <tr><td>2</td><td>context-free</td><td><Inline text="$w_1 = A$ with $A \in N$" /></td></tr>
            <tr><td>3</td><td>regular</td><td><Inline text="$w_1 = A$ and $w_2 = aB$ or $w_2 = a$ ($A, B \in N$, $a \in T$); or $w_1 = S$, $w_2 = \lambda$" /></td></tr>
          </tbody>
        </table>
        <ul className="prose">
          <li><Inline text="“$G$ is of type $k$” means every production meets the type $k$ restriction. Report the **largest** such $k$." /></li>
          <li><Inline text="Because of the $\lambda$ rules the types aren’t nested for grammars: $\{S \to 0S1,\ S \to \lambda\}$ is type 2 but not type 1, and $\{S \to 0S,\ S \to \lambda\}$ is type 3 but not type 1." /></li>
          <li><Inline text="The type of a grammar ≠ the type of its language. $\{S \to S0,\ S \to 1\}$ is only type 2 (left-linear), but its language $10^\star$ is regular." /></li>
        </ul>
        <Hierarchy />
      </section>

      <section id="kleene">
        <h2>7. Kleene’s theorem and constructions</h2>
        <p className="prose"><Inline text="A language is recognised by an FSM iff it is generated by a regular (type 3) grammar." /></p>
        <ul className="prose">
          <li><Inline text="**Grammar → non-deterministic FSM:** a state $s_A$ for each non-terminal $A$ (start state $s_S$) plus a final state $s_F$. $A \to a$ gives an edge $s_A \to s_F$ on $a$; $A \to aB$ gives $s_A \to s_B$ on $a$. $s_S$ is also final if $S \to \lambda \in P$." /></li>
          <li><Inline text="**FSM without output → grammar:** a non-terminal per state ($S$ for $s_0$). For each $f(s_X, a) = s_Y$ add $X \to aY$, and also $X \to a$ if $s_Y \in F$. If $s_0 \in F$ add $S \to \lambda$." /></li>
        </ul>
      </section>

      <section id="traps">
        <h2>8. Common traps</h2>
        <ul className="prose">
          <li><Inline text="**Partial f.** In an FSM without output (or with output), every $f(s, i)$ must be defined. Add a dead state." /></li>
          <li><Inline text="**Forgetting $\lambda$.** Is the empty string in the language? That decides whether $s_0 \in F$." /></li>
          <li><Inline text="**$\emptyset$ vs $\lambda$.** $\emptyset$ is the empty set (of states or strings); $\lambda$ is the empty string. $\{\lambda\} \neq \emptyset$." /></li>
          <li><Inline text="**Left-linear rules** such as $A \to Ba$ are not type 3 in this course." /></li>
          <li><Inline text="**$S \to \lambda$** breaks type 1 if $S$ appears on any right-hand side." /></li>
          <li><Inline text="**Non-regular languages** like $\{0^n1^n\}$ have no FSM: with $k$ states, two of $\lambda, 0, \dots, 0^k$ reach the same state (pigeonhole)." /></li>
        </ul>
      </section>

      <section id="beyond">
        <h2>9. Beyond this course</h2>
        <p className="prose">Other textbooks go further. These ideas exist, but Computation Model Builder doesn’t use them:</p>
        <ul className="prose">
          <li>λ-transitions in non-deterministic FSMs <span className="muted">(not examinable in MATH1064/1964)</span></li>
          <li>regular expressions for regular languages <span className="muted">(not examinable in MATH1064/1964)</span></li>
          <li>pushdown automata, which recognise context-free languages <span className="muted">(not examinable in MATH1064/1964)</span></li>
          <li>Turing machines, which recognise the languages of type 0 grammars <span className="muted">(not examinable in MATH1064/1964)</span></li>
        </ul>
      </section>
    </div>
  );
}
