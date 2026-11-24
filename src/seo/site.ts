// Site-wide constants. Change SITE_URL or REPO_URL here only.
export const SITE_URL = 'https://jackstanton.dev/cmb';
export const BASENAME = '/cmb';
export const SITE_NAME = 'Computation Model Builder';
export const SUBTITLE = 'A learning aid for students of MATH1064/1964 at the University of Sydney';
export const REPO_URL = 'https://github.com/jackstanton6/ComputationModelBuilder';
export const DISCLAIMER =
  'Unofficial. Not affiliated with or endorsed by the University of Sydney. Notation follows the ' +
  'MATH1064/1964 lecture notes and Rosen, Discrete Mathematics and Its Applications (7th ed.). ' +
  'Always check against your official course materials.';

export interface Head {
  title: string;
  description: string;
  /** Path under the site, starting and ending with "/", e.g. "/machines/". */
  path: string;
  jsonLd?: object[];
  noindex?: boolean;
}

export const canonical = (path: string) => SITE_URL + path;

export function breadcrumbs(items: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: canonical(it.path),
    })),
  };
}

export const isPartOfSite = { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL + '/' };
