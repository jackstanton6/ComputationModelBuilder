import type { ReactNode } from 'react';
import { useHydrated } from './hooks';

/** Renders `fallback` in prerendered HTML and during hydration, then the children. */
export default function ClientOnly({ children, fallback }: { children: () => ReactNode; fallback: ReactNode }) {
  const hydrated = useHydrated();
  return <>{hydrated ? children() : fallback}</>;
}
