// The practice catalogue. Problems are ordered by section (A–I) and number.
import type { Problem } from './types';
import { fsmWithoutOutput, possible } from './fsm-without-output';
import { nondeterministic } from './nondeterministic';
import { fsmWithOutput } from './fsm-with-output';
import { readingMachines } from './reading-machines';
import { grammars } from './grammars';
import { grammarTypes } from './grammar-types';
import { conversions } from './conversions';

export const slugify = (title: string) =>
  title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const order = (id: string) => [id.charCodeAt(0), Number(id.slice(1))];

export const problems: Problem[] = [
  ...fsmWithoutOutput, ...nondeterministic, ...fsmWithOutput, ...readingMachines,
  ...grammars, ...grammarTypes, ...conversions, ...possible,
]
  .map((p) => ({ ...p, slug: slugify(p.title) }))
  .sort((a, b) => {
    const [x1, x2] = order(a.id);
    const [y1, y2] = order(b.id);
    return x1 - y1 || x2 - y2;
  });

export const problemBySlug = (slug: string) => problems.find((p) => p.slug === slug);
export const TOTAL_PROBLEMS = problems.length;
