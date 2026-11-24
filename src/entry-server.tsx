// Server entry used only by scripts/prerender.mjs.
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { createRoutes, routeFiles } from './routes';
import { BASENAME, type Head } from './seo/site';
import { problems } from './problems';
import { guides } from './guides';

export { routeFiles };

export function prerenderPaths(): string[] {
  return [
    '/', '/machines/', '/grammars/', '/practice/', '/notation/', '/guides/', '/about/',
    ...guides.map((g) => `/guides/${g.slug}/`),
    ...problems.map((p) => `/practice/${p.slug}/`),
  ];
}

export interface RenderResult {
  html: string;
  head: Head;
  routeIds: string[];
}

export async function render(path: string): Promise<RenderResult> {
  const handler = createStaticHandler(createRoutes(), { basename: BASENAME });
  const context = await handler.query(new Request('http://localhost' + BASENAME + path));
  if (context instanceof Response) throw new Error(`Unexpected response for ${path}`);
  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(<StaticRouterProvider router={router} context={context} hydrate={false} />);
  const leaf = context.matches[context.matches.length - 1];
  const handle = leaf.route.handle as { head: (params: Record<string, string | undefined>) => Head } | undefined;
  if (!handle) throw new Error(`No head for ${path}`);
  return { html, head: handle.head(leaf.params), routeIds: context.matches.map((m) => m.route.id) };
}
export { headToHtml } from './seo/head';
