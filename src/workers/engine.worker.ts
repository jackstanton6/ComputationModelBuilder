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
    } else if (req.type === 'describe') {
      const { guessLanguage } = await import('../engine/describe');
      const r = wordsUpTo(req.grammar, req.n, { onProgress, shouldStop }, 5000);
      const complete = r.complete && !timedOut;
      const guess = complete ? guessLanguage(r.words, req.grammar.T, Math.min(req.n, 8)) : null;
      post({ id: req.id, type: 'result', result: { words: r.words, complete, guess } });
    } else if (req.type === 'synth') {
      const sbm = await import('../engine/set-builder');
      const { compareWithPredicate } = await import('../engine/language');
      const parsed = sbm.parseSetBuilder(req.text);
      if ('error' in parsed) {
        post({ id: req.id, type: 'result', result: { error: parsed.error } });
        return;
      }
      const syn = sbm.synthesizeGrammar(parsed.sb);
      if ('error' in syn) {
        post({ id: req.id, type: 'result', result: { error: syn.error } });
        return;
      }
      const T = sbm.terminalsOf(parsed.sb);
      const n = T.length <= 2 ? 10 : T.length === 3 ? 8 : 6;
      const cmp = compareWithPredicate(syn.grammar, sbm.predicateOf(parsed.sb, n), T, n, { onProgress, shouldStop });
      post({ id: req.id, type: 'result', result: { grammar: syn.grammar, note: syn.note, check: timedOut ? { kind: 'inconclusive', checkedUpTo: n, message: 'The check timed out.' } : cmp } });
    } else if (req.type === 'check') {
      const { checkSubmission } = await import('../problems/checker');
      const r = checkSubmission(req.slug, req.submission, { onProgress, shouldStop });
      post({ id: req.id, type: 'result', result: timedOut ? { kind: 'timeout' } : r });
    }
  } catch (err) {
    post({ id: req.id, type: 'error', message: (err as Error).message });
  }
};
