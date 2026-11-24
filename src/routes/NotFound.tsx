import { Link } from 'react-router';
import type { Head } from '../seo/site';

export const handle = {
  head: (): Head => ({
    title: 'Page not found · Computation Model Builder',
    description: 'This page doesn’t exist. Head back to the machine builder, grammar workbench or practice problems.',
    path: '/404.html',
    noindex: true,
  }),
};

export function Component() {
  return (
    <div className="page prose">
      <h1>Page not found</h1>
      <p>There’s no page here. f(s₀, this URL) isn’t in F.</p>
      <p>
        Try the <Link to="/">home page</Link>, the <Link to="/machines/">machine builder</Link>,
        the <Link to="/grammars/">grammar workbench</Link> or the <Link to="/practice/">practice problems</Link>.
      </p>
    </div>
  );
}
