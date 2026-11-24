import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createBrowserRouter, matchRoutes, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from './routes';
import { BASENAME } from './seo/site';

async function resolveLazy(routes: RouteObject[]) {
  const matches = matchRoutes(routes, window.location, BASENAME) ?? [];
  await Promise.all(matches.map(async (m) => {
    const lazy = m.route.lazy;
    if (typeof lazy === 'function') {
      const mod = await lazy();
      Object.assign(m.route, mod);
      delete m.route.lazy;
    }
  }));
}

async function main() {
  const routes = createRoutes();
  await resolveLazy(routes);
  const router = createBrowserRouter(routes, { basename: BASENAME });
  const root = document.getElementById('root')!;
  const app = <StrictMode><RouterProvider router={router} /></StrictMode>;
  if (root.firstElementChild) hydrateRoot(root, app);
  else createRoot(root).render(app);
}

void main();
