# Contributing

Thanks for helping! Corrections to notation, bug reports and new practice problems are all welcome.

## Ground rules

- **Course notation only.** Use the MATH1064/1964 notation everywhere: f and g, s₀, λ for the empty string,
  L(M), G = (V, T, S, P), and "FSM without output", "non-deterministic FSM", "FSM with output". Don't use δ,
  ε, Σ or q₀.
- **Original content only.** Don't copy figures, machines or wording from the Rosen textbook or the course
  slides. Write your own machines and statements in the same style.
- **Australian spelling** (recognise, colour, minimise).

## Adding a practice problem

1. Pick the topic file in `src/problems/` (`fsm-without-output.ts`, `nondeterministic.ts`,
   `fsm-with-output.ts`, `reading-machines.ts`, `grammars.ts`, `grammar-types.ts`, `conversions.ts`).
2. Add an object matching `Problem` in `src/problems/types.ts`:
   - `id`: section letter and number, e.g. `A23`. The slug is generated from the title, which must be unique.
   - `tier`, `topic`, `format`, `statement` (Markdown with `$…$` KaTeX).
   - `constraints`, e.g. `{ machineKind: 'dfa', maxStates: 3 }` or `{ terminals: ['0', '1'], requiredGrammarType: 3 }`.
   - `predicate` (the target language) or `transducer` (for FSMs with output).
   - `reference`: a machine (write it with `dfa`, `nfa` or `mealy` from `dsl.ts`), a grammar (`grammar('S -> 0S1 | 01')`),
     or an answer key for trace, describe, classify, fill-table and possible problems.
   - `hints`: exactly three, from gentle to nearly the answer.
   - `explanation`: the key idea in 2–5 sentences.
3. Update `src/problems/count.ts` if the number of problems changes.
4. Run `npm test`. `src/problems/problems.test.ts` verifies every problem: the reference against the
   predicate on all strings up to length 12 (or about 5,000 strings for larger alphabets), the constraints,
   trace answers against the engine, describe-language options, and classifications.
5. Run `npm run lint`, and look at the problem in `npm run dev`.

## Code

- `src/engine/` must stay pure TypeScript: no React, DOM or storage imports, and every algorithm needs Vitest
  tests.
- Styling is plain CSS with the tokens in `src/styles/tokens.css`. No CSS frameworks or component libraries.
- Record any judgement call in `DECISIONS.md` (one line).
