import { describe, expect, it } from 'vitest';
import { guides, guideForTopic, guideBySlug } from './index';
import { problemBySlug } from '../problems';
import { TOPIC_LABELS } from '../problems/types';

const FORBIDDEN = /δ|ε|Σ|q₀|q_0|\\delta|\\epsilon|\\Sigma/;

describe('guides', () => {
  it.each(guides.map((g) => [g.slug, g] as const))('%s is well-formed', (_s, g) => {
    expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(g.description.length).toBeLessThanOrEqual(160);
    expect(g.title.length).toBeLessThanOrEqual(90);
    expect(g.body).not.toMatch(FORBIDDEN);
    for (const slug of g.related) expect(problemBySlug(slug), slug).toBeDefined();
    for (const m of g.body.matchAll(/^\[\[figure:(\w+)\]\]$/gm)) expect(g.figures?.[m[1]], m[1]).toBeDefined();
    // Inline maths must be balanced (an odd number of $ outside $$ blocks breaks rendering).
    const inline = g.body.replace(/\$\$[\s\S]*?\$\$/g, '');
    expect((inline.match(/\$/g) ?? []).length % 2).toBe(0);
  });
  it('maps every practice topic to a guide', () => {
    for (const t of Object.keys(TOPIC_LABELS)) expect(guideBySlug(guideForTopic[t as keyof typeof guideForTopic])).toBeDefined();
  });
  it('has unique slugs', () => {
    expect(new Set(guides.map((g) => g.slug)).size).toBe(guides.length);
  });
});
