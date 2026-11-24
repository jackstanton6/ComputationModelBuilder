// Route table shared by the client and the prerenderer. Each route module exports `Component`
// and `handle = { head }` with its SEO head data.
import type { RouteObject } from 'react-router';
import Layout from './components/Layout';
import * as Home from './routes/Home';

/** Route id -> source module, used by the prerenderer to find each route's CSS and JS. */
export const routeFiles: Record<string, string> = {
  machines: 'src/routes/Machines.tsx',
  grammars: 'src/routes/Grammars.tsx',
  practice: 'src/routes/Practice.tsx',
  problem: 'src/routes/Problem.tsx',
  notation: 'src/routes/Notation.tsx',
  about: 'src/routes/About.tsx',
  notfound: 'src/routes/NotFound.tsx',
};

export function createRoutes(): RouteObject[] {
  return [
    {
      id: 'root',
      element: <Layout />,
      children: [
        { id: 'home', index: true, Component: Home.Component, handle: Home.handle },
        { id: 'machines', path: 'machines', lazy: () => import('./routes/Machines') },
        { id: 'grammars', path: 'grammars', lazy: () => import('./routes/Grammars') },
        { id: 'practice', path: 'practice', lazy: () => import('./routes/Practice') },
        { id: 'problem', path: 'practice/:slug', lazy: () => import('./routes/Problem') },
        { id: 'notation', path: 'notation', lazy: () => import('./routes/Notation') },
        { id: 'about', path: 'about', lazy: () => import('./routes/About') },
        { id: 'notfound', path: '*', lazy: () => import('./routes/NotFound') },
      ],
    },
  ];
}
