# Computation Model Builder

A learning aid for students of MATH1064/1964 at the University of Sydney.

Build finite state machines and grammars in the course's own notation, run strings through them step by
step, and practise with 70 auto-checked problems. Live at **https://jackstanton.dev/cmb/**.

> Unofficial. Not affiliated with or endorsed by the University of Sydney. Notation follows the MATH1064/1964
> lecture notes and Rosen, *Discrete Mathematics and Its Applications* (7th ed.). Always check against your
> official course materials.

## Features

- **Machine builder** (`/cmb/machines/`): FSMs without output, non-deterministic FSMs and FSMs with output.
  An SVG diagram editor synced with an editable state table, validation in course language (with "Complete
  with a dead state"), a step-through simulator, batch tests, language preview, subset construction,
  minimisation, equivalence with the shortest counterexample, and SVG/PNG/TikZ/LaTeX export.
- **Grammar workbench** (`/cmb/grammars/`): G = (V, T, S, P), a Type 0–3 classifier that implements the
  course table exactly (including the λ nuances), a word lister, a derivation stepper, membership tests
  (Earley for types 2–3, bounded search for types 0–1), Kleene's construction, and LaTeX export.
- **Practice** (`/cmb/practice/`): 70 problems across four tiers, each verified by an automated test.
- **Notation cheat sheet** (`/cmb/notation/`): one printable page.
- **Guides** (`/cmb/guides/`): short explainers (subset construction, Kleene's theorem, types of grammars,
  non-regular languages, dead states, FSMs with output, finding L(G)) linked to the tools and problems.

## Local development

Requires Node 20+.

```sh
npm install
npm run dev          # Vite dev server at http://localhost:5173/cmb/
npm test             # Vitest: engine unit tests + verification of every practice problem
npm run lint         # ESLint + tsc --noEmit
npm run build        # typecheck, Vite build, SSR build, prerender, sitemap, OG image
npm run test:e2e     # Playwright smoke tests against dist/ (run `npm run build` first)
npm run preview      # wrangler dev against the built dist/
```

The build writes everything to `dist/`, with the app under `dist/cmb/` so paths on disk match URLs.
`dist/_headers` and `dist/_redirects` hold caching, security headers and the `/cmb` → `/cmb/` redirect.

### Project layout

```
src/engine/      pure TypeScript: machines, grammars, Earley, bounded search, conversions, LaTeX/TikZ
src/problems/    the practice catalogue (one file per topic), the checker and its verification test
src/components/  diagram editor, state table, simulator, grammar editor, practice workspaces
src/guides/      the topic guides (Markdown + KaTeX + figures)
src/routes/      one module per route; each exports its SEO head data in `handle.head`
src/store/       zustand stores and versioned localStorage persistence
src/workers/     the Web Worker for heavy work (bounded search, checking)
scripts/         prerender, local static server, OG image template
tests/e2e/       Playwright smoke tests; tests/fixtures/machine.tex is a compilable TikZ sample
```

## Deploying (Cloudflare Workers)

The site is a static-assets Worker bound only to the route `jackstanton.dev/cmb*` (see `wrangler.jsonc`).
The root of jackstanton.dev is served by a different Worker; a route on `jackstanton.dev/cmb*` is more
specific than that Worker's route, and routes take precedence over Custom Domains, so `/cmb/…` reaches this
Worker and everything else still reaches the root site.

To deploy by connecting this repository to the Worker in the Cloudflare dashboard (Workers Builds):

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: the repository root

Or deploy from your machine with `npm run deploy` (runs the build, then `wrangler deploy`; needs
`wrangler login` or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment).

After the first deploy, check that `https://jackstanton.dev/cmb/` serves the app, `https://jackstanton.dev/cmb`
redirects to it, `https://jackstanton.dev/cmb/nope/` shows the 404 page, and `https://jackstanton.dev/` is
unchanged.

### Sitemap and robots.txt

`robots.txt` lives at the domain root, which belongs to the other site, so this Worker doesn't serve one.
Add this line to the root site's `robots.txt`:

```
Sitemap: https://jackstanton.dev/cmb/sitemap.xml
```

Then submit `https://jackstanton.dev/cmb/sitemap.xml` in Google Search Console.

## Continuous integration

`.github/workflows/ci.yml` runs lint, unit tests, the build, the Playwright smoke tests and (when available)
a `pdflatex` compile of `tests/fixtures/machine.tex` on every push and pull request. Deploys happen through
Cloudflare's Git integration, so no Cloudflare secrets are needed in GitHub. If you prefer deploying from
GitHub Actions instead, add a job that runs `npx wrangler deploy` with the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets.

## Adding a practice problem

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: add an entry to the right file in `src/problems/`, give it
three hints, an explanation and a reference solution, then run `npm test`. The verification suite checks the
reference against the problem's language predicate for every string up to length 12 (or about 5,000 strings
for larger alphabets). A problem without a passing test isn't done. If the catalogue size changes, update
`src/problems/count.ts`.

## Licence

MIT. See [LICENSE](LICENSE).
