// Main-thread client for the engine worker. Each job can be cancelled (which restarts the worker)
// and reports progress. A hook shows a spinner only for jobs that take longer than ~150 ms.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestBody, WorkerResponse } from './protocol';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (n: number) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const r = e.data;
      const p = pending.get(r.id);
      if (!p) return;
      if (r.type === 'progress') p.onProgress?.(r.nodes);
      else {
        pending.delete(r.id);
        if (r.type === 'result') p.resolve(r.result);
        else p.reject(new Error(r.message));
      }
    };
    worker.onerror = (e) => {
      pending.forEach((p) => p.reject(new Error(e.message || 'Worker error')));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export class Cancelled extends Error {
  constructor() {
    super('Cancelled');
  }
}

export interface Job<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export function runJob<T>(body: RequestBody, onProgress?: (n: number) => void): Job<T> {
  const id = nextId++;
  const w = getWorker();
  const promise = new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
  });
  w.postMessage({ ...body, id });
  return {
    promise,
    cancel: () => {
      const p = pending.get(id);
      if (!p) return;
      // Terminating is the only way to stop a busy worker; other jobs are rejected too.
      worker?.terminate();
      worker = null;
      pending.forEach((q, qid) => q.reject(qid === id ? new Cancelled() : new Error('Interrupted by another job. Try again.')));
      pending.clear();
    },
  };
}

export interface JobState<T> {
  running: boolean;
  /** True once the job has run longer than 150 ms (show progress). */
  slow: boolean;
  progress: number;
  result: T | null;
  error: string | null;
}

/** Run worker jobs from a component; starting a new job cancels the previous one. */
export function useJob<T>() {
  const [state, setState] = useState<JobState<T>>({ running: false, slow: false, progress: 0, result: null, error: null });
  const current = useRef<Job<T> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = useCallback(() => {
    current.current?.cancel();
    current.current = null;
    clearTimeout(timer.current);
    setState((s) => ({ ...s, running: false, slow: false }));
  }, []);

  const start = useCallback((body: RequestBody) => {
    current.current?.cancel();
    clearTimeout(timer.current);
    setState({ running: true, slow: false, progress: 0, result: null, error: null });
    const job = runJob<T>(body, (n) => setState((s) => ({ ...s, progress: n })));
    current.current = job;
    timer.current = setTimeout(() => setState((s) => (s.running ? { ...s, slow: true } : s)), 150);
    job.promise.then(
      (result) => {
        if (current.current !== job) return;
        clearTimeout(timer.current);
        setState({ running: false, slow: false, progress: 0, result, error: null });
      },
      (err: Error) => {
        if (current.current !== job || err instanceof Cancelled) return;
        clearTimeout(timer.current);
        setState({ running: false, slow: false, progress: 0, result: null, error: err.message });
      },
    );
    return job.promise;
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { ...state, start, cancel };
}
