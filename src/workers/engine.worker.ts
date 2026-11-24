/// <reference lib="webworker" />
// Heavy engine work off the main thread: word listing, membership search and practice checks.
import { membership, wordsUpTo } from '../engine/language';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const post = (r: WorkerResponse) => self.postMessage(r);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const deadline = req.timeLimitMs ? Date.now() + req.timeLimitMs : Infinity;
  let timedOut = false;
  const shouldStop = () => {
    if (Date.now() > deadline) timedOut = true;
    return timedOut;
  };
  const onProgress = (nodes: number) => post({ id: req.id, type: 'progress', nodes });
  try {
    if (req.type === 'words') {
      const r = wordsUpTo(req.grammar, req.n, { onProgress, shouldStop }, 5000);
      post({ id: req.id, type: 'result', result: { words: r.words, complete: r.complete && !timedOut } });
    } else if (req.type === 'membership') {
      const r = membership(req.grammar, req.word, { onProgress, shouldStop });
      post({ id: req.id, type: 'result', result: { ...r, timedOut } });
    } else if (req.type === 'check') {
      const { checkSubmission } = await import('../problems/checker');
      const r = checkSubmission(req.slug, req.submission, { onProgress, shouldStop });
      post({ id: req.id, type: 'result', result: timedOut ? { kind: 'timeout' } : r });
    }
  } catch (err) {
    post({ id: req.id, type: 'error', message: (err as Error).message });
  }
};
