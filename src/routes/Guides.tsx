import { Link } from 'react-router';
import { breadcrumbs, canonical, isPartOfSite, type Head } from '../seo/site';
import { guides } from '../guides';

const DESCRIPTION = 'Short guides to finite state machines and grammars for MATH1064/1964: subset construction, Kleene’s theorem, the Chomsky hierarchy, non-regular languages and more.';

export const handle = {
  head: (): Head => ({
    title: 'Guides: FSMs, grammars and the Chomsky hierarchy · Computation Model Builder',
    description: DESCRIPTION,
    path: '/guides/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Guides to finite state machines and grammars',
        description: DESCRIPTION,
        url: canonical('/guides/'),
        isPartOf: isPartOfSite,
        hasPart: guides.map((g) => ({ '@type': 'LearningResource', name: g.title, url: canonical(`/guides/${g.slug}/`) })),
      },
      breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/' }]),
    ],
  }),
};

export function Component() {
  return (
    <div className="page">
      <h1>Guides</h1>
      <p className="prose">
        Short explainers for the finite state machine and grammar topics of MATH1064/1964, in the course’s notation.
        Each one links to the tools and to practice problems on the same idea.
      </p>
      <ul className="guide-list">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link to={`/guides/${g.slug}/`} className="card">
              <h2>{g.h1}</h2>
              <p>{g.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
