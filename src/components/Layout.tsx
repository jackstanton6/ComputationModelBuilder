import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router';
import { DISCLAIMER, REPO_URL, SUBTITLE, type Head } from '../seo/site';
import { applyHead } from '../seo/head';
import { followSystemTheme, setTheme, useHydrated, useTheme } from './hooks';
import { ConfirmProvider } from './Confirm';

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="8" cy="16" r="5.5" />
      <circle cx="24" cy="16" r="5.5" />
      <circle cx="24" cy="16" r="2.6" />
      <path d="M13.8 16h3.6" />
      <path d="M16.4 13.2 19.2 16l-2.8 2.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ThemeToggle() {
  const theme = useTheme();
  const hydrated = useHydrated();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={hydrated ? `Switch to ${next} theme` : 'Switch theme'}
      title={hydrated ? `Switch to ${next} theme` : 'Switch theme'}
    >
      {/* Sun/moon: one icon, drawn with currentColor. */}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {hydrated && theme === 'dark'
          ? <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>
          : <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
      </svg>
    </button>
  );
}

const NOTICE_KEY = 'cmb:v1:small-screen-dismissed';

function SmallScreenNotice() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(NOTICE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);
  if (dismissed) return null;
  return (
    <div className="small-screen-notice" role="note">
      <span>Computation Model Builder is designed for laptop and desktop screens. The editors may be hard to use here.</span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(NOTICE_KEY, '1');
          } catch {
            /* ignore */
          }
        }}
      >
        Continue anyway
      </button>
    </div>
  );
}

function HeadSync() {
  const matches = useMatches();
  const location = useLocation();
  useEffect(() => {
    const leaf = matches[matches.length - 1];
    const handle = leaf?.handle as { head?: (p: typeof leaf.params) => Head } | undefined;
    if (handle?.head) applyHead(handle.head(leaf.params));
  }, [matches, location.pathname]);
  return null;
}

export default function Layout() {
  const { pathname } = useLocation();
  const wide = /\/(machines|grammars)\/?$/.test(pathname);
  useEffect(() => followSystemTheme(), []);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SmallScreenNotice />
      <header className="site-header">
        <Link to="/" className="wordmark">
          <Mark />
          <span>Computation Model Builder</span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <NavLink to="/machines/">Machines</NavLink>
          <NavLink to="/grammars/">Grammars</NavLink>
          <NavLink to="/practice/">Practice</NavLink>
          <NavLink to="/notation/">Notation</NavLink>
        </nav>
        <span className="spacer" />
        <ThemeToggle />
      </header>
      <main id="main" className={wide ? 'main-wide' : undefined}>
        <ConfirmProvider>
          <Outlet />
        </ConfirmProvider>
      </main>
      <footer className="site-footer">
        <p>{SUBTITLE}.</p>
        <p>{DISCLAIMER}</p>
        <p>
          <a href={REPO_URL}>Source on GitHub</a> · MIT licence · <Link to="/about/">About</Link>
        </p>
      </footer>
      <HeadSync />
      <ScrollRestoration />
    </>
  );
}
