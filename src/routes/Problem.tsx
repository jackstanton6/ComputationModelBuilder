import { Link, useParams } from 'react-router';
import { breadcrumbs, isPartOfSite, canonical, type Head } from '../seo/site';
import { problemBySlug } from '../problems';
import { TIER_LABELS, TOPIC_LABELS, type Problem } from '../problems/types';
import { Markdown, plainText } from '../components/Tex';
import ClientOnly from '../components/ClientOnly';
import GivenView from '../components/practice/GivenView';
import ProblemPlayer from '../components/practice/ProblemPlayer';
import { Component as NotFound } from './NotFound';

function description(p: Problem): string {
  const t = plainText(p.statement);
  return t.length <= 155 ? t : t.slice(0, 152).replace(/\s+\S*$/, '') + '…';
}

export const handle = {
  head: (params: { slug?: string }): Head => {
    const p = problemBySlug(params.slug ?? '');
    if (!p) return { title: 'Problem not found · Computation Model Builder', description: 'This practice problem doesn’t exist.', path: '/404.html', noindex: true };
    const path = `/practice/${p.slug}/`;
    return {
      title: `${p.title} · Practice · Computation Model Builder`,
      description: description(p),
      path,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'LearningResource',
          name: p.title,
          description: description(p),
          url: canonical(path),
          learningResourceType: 'Practice problem',
          educationalLevel: 'First-year university',
          teaches: TOPIC_LABELS[p.topic],
          inLanguage: 'en-AU',
          isAccessibleForFree: true,
          isPartOf: isPartOfSite,
        },
        breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Practice', path: '/practice/' }, { name: p.title, path }]),
      ],
    };
  },
};

export function Component() {
  const { slug } = useParams();
  const p = problemBySlug(slug ?? '');
  if (!p) return <NotFound />;
  return (
    <article className="problem-page">
      <header className="problem-head">
        <nav aria-label="Breadcrumb" className="small"><Link to="/practice/">Practice</Link> /</nav>
        <h1>{p.title}</h1>
        <div className="row">
          <span className={`tier tier-${p.tier}`}>{TIER_LABELS[p.tier]}</span>
          <span className="topic">{TOPIC_LABELS[p.topic]}</span>
        </div>
        <Markdown text={p.statement} className="statement" />
      </header>
      {p.given && (
        <section className="stack" aria-label="Given" style={{ maxWidth: 760, marginBottom: 'var(--sp-6)' }}>
          <GivenView given={p.given} asTable={p.givenAsTable} />
        </section>
      )}
      <ClientOnly key={p.slug} fallback={<p className="muted">Loading the workspace…</p>}>
        {() => <ProblemPlayer key={p.slug} p={p} />}
      </ClientOnly>
    </article>
  );
}
