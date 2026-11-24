import { useEffect, useState, useSyncExternalStore } from 'react';

/** False during prerender and the hydration pass, true afterwards. */
export function useHydrated(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export type Theme = 'light' | 'dark';
const THEME_KEY = 'cmb:v1:theme';
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage may be unavailable */
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    currentTheme,
    () => 'light',
  );
}

/** Follow the OS theme until the user picks one. */
export function followSystemTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  if (saved) return;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    listeners.forEach((l) => l());
  });
}

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setR(mq.matches);
    const f = (e: MediaQueryListEvent) => setR(e.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return r;
}
