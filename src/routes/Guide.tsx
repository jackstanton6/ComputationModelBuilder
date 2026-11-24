import { Link, useParams } from 'react-router';
import { breadcrumbs, canonical, isPartOfSite, type Head } from '../seo/site';
import { guideBySlug, guides, type Guide as GuideT } from '../guides';
import { problemBySlug } from '../problems';
import { TIER_LABELS, TOPIC_LABELS } from '../problems/types';
import { Markdown } from '../components/Tex';
import { Diagram } from '../components/machine/Diagram';
import StaticTable from '../components/machine/StaticTable';
import { machineToDoc } from '../store/machineDoc';
import { Component as NotFound } from './NotFound';

export const handle = {
  head: (params: { slug?: string }): Head => {
    const g = guideBySlug(params.slug ?? '');
    if (!g) return { title: 'Guide not found · Computation Model Builder', description: 'This guide doesn’t exist.', path: '/404.html', noindex: true };
    const path = `/guides/${g.slug}/`;
    return {
      title: `${g.title} · Computation Model Builder`,
      description: g.description,
      path,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': ['Article', 'LearningResource'],
          headline: g.title,
          name: g.title,
          description: g.description,
          url: canonical(path),
          learningResourceType: 'Guide',
          educationalLevel: 'First-year university',
          teaches: g.topics.map((t) => TOPIC_LABELS[t]),
          inLanguage: 'en-AU',
          isAccessibleForFree: true,
          isPartOf: isPartOfSite,
        },
        breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: g.h1, path }]),
      ],
    };
  },
};

function Body({ g }: { g: GuideT }) {
  const parts = g.body.split(/^\[\[figure:(\w+)\]\]$/m);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Markdown key={i} text={part} className="prose" />;
        const f = g.figures?.[part];
        if (!f) return null;
        return (
          <figure key={i} className="guide-figure">
            {f.kind === 'diagram'
              ? <div className="diagram-frame"><Diagram doc={machineToDoc(f.machine)} title={f.caption} maxHeight={300} /></div>
              : <StaticTable m={f.machine} caption={f.caption} />}
            <figcaption className="small muted">{f.caption}</figcaption>
          </figure>
        );
      })}
    </>
  );
}

export function Component() {
  const { slug } = useParams();
  const g = guideBySlug(slug ?? '');
  if (!g) return <NotFound />;
  const idx = guides.indexOf(g);
  const next = guides[(idx + 1) % guides.length];
  const related = g.related.map(problemBySlug).filter((p) => p !== undefined);
  return (
    <article className="page guide">
      <nav aria-label="Breadcrumb" className="small"><Link to="/guides/">Guides</Link> /</nav>
      <h1>{g.h1}</h1>
      <Body g={g} />
      <aside className="guide-aside" aria-label="Related">
        <h2 className="h-sm">Try it</h2>
        <ul>{g.tools.map((t) => <li key={t.to + t.label}><Link to={t.to}>{t.label}</Link></li>)}</ul>
        {related.length > 0 && (
          <>
            <h2 className="h-sm">Practice problems</h2>
            <ul>
              {related.map((p) => (
                <li key={p.slug}><Link to={`/practice/${p.slug}/`}>{p.title}</Link> <span className="xsmall muted">({TIER_LABELS[p.tier]})</span></li>
              ))}
            </ul>
          </>
        )}
        <p className="small">Next guide: <Link to={`/guides/${next.slug}/`}>{next.h1}</Link></p>
      </aside>
    </article>
  );
}
