import type { Grammar, Sym } from '../engine/types';

export type WorkerRequest = { id: number; timeLimitMs?: number } & (
  | { type: 'words'; grammar: Grammar; n: number }
  | { type: 'membership'; grammar: Grammar; word: Sym[] }
  | { type: 'check'; slug: string; submission: unknown }
  | { type: 'describe'; grammar: Grammar; n: number }
  | { type: 'synth'; text: string }
);

export type WorkerResponse =
  | { id: number; type: 'progress'; nodes: number }
  | { id: number; type: 'result'; result: unknown }
  | { id: number; type: 'error'; message: string };

/** Distributive Omit so each request variant keeps its own fields. */
export type RequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never;
