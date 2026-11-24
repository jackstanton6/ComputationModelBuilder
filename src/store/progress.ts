// Practice progress, stored under cmb:v1:progress.
import { useSyncExternalStore } from 'react';
import { readJSON, removePrefix, writeJSON } from './persist';

export type Status = 'not-started' | 'attempted' | 'solved' | 'solved-viewed';

export interface ProblemProgress {
  attempted?: boolean;
  solved?: boolean;
  /** The solution was viewed. */
  viewed?: boolean;
  /** The problem was solved only after viewing the solution. */
  solvedAfterViewing?: boolean;
  hints?: number;
}

type Progress = Record<string, ProblemProgress>;

const KEY = 'progress';
const listeners = new Set<() => void>();
let cache: Progress | null = null;
const EMPTY: Progress = {};

function load(): Progress {
  if (cache === null) cache = readJSON<Progress>(KEY, {});
  return cache;
}

function save(p: Progress) {
  cache = p;
  writeJSON(KEY, p);
  listeners.forEach((l) => l());
}

export function updateProgress(slug: string, fn: (p: ProblemProgress) => ProblemProgress) {
  const all = load();
  save({ ...all, [slug]: fn(all[slug] ?? {}) });
}

export function statusOf(p: ProblemProgress | undefined): Status {
  if (!p) return 'not-started';
  if (p.solved) return p.solvedAfterViewing ? 'solved-viewed' : 'solved';
  if (p.attempted || p.viewed || p.hints) return 'attempted';
  return 'not-started';
}

export const STATUS_LABELS: Record<Status, string> = {
  'not-started': 'Not started',
  attempted: 'Attempted',
  solved: 'Solved',
  'solved-viewed': 'Solved (after viewing solution)',
};

export function useProgress(): Progress {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key?.endsWith(KEY)) {
          cache = null;
          cb();
        }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    load,
    () => EMPTY,
  );
}

export function resetProgress() {
  removePrefix('ws:');
  save({});
}
