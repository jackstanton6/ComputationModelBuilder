import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { breadcrumbs, type Head } from '../seo/site';
import { problems } from '../problems';
import { TIER_LABELS, TOPIC_LABELS, type Tier, type Topic } from '../problems/types';
import { STATUS_LABELS, statusOf, useProgress, type Status } from '../store/progress';

export const handle = {
  head: (): Head => ({
    title: 'Practice problems: FSMs, grammars, conversions · Computation Model Builder',
    description: 'About 70 auto-checked problems from warm-up to challenge: build FSMs, write grammars, classify types, trace outputs and convert machines.',
    path: '/practice/',
    jsonLd: [breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Practice', path: '/practice/' }])],
  }),
};

const TIERS = Object.keys(TIER_LABELS) as Tier[];
const TOPICS = Object.keys(TOPIC_LABELS) as Topic[];
const STATUSES = Object.keys(STATUS_LABELS) as Status[];
const isSolved = (s: Status) => s === 'solved' || s === 'solved-viewed';

export function Component() {
  const progress = useProgress();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<'' | Topic>('');
  const [tier, setTier] = useState<'' | Tier>('');
  const [status, setStatus] = useState<'' | Status>('');
  const [q, setQ] = useState('');

  const shown = useMemo(() => problems.filter((p) =>
    (!topic || p.topic === topic)
    && (!tier || p.tier === tier)
    && (!status || statusOf(progress[p.slug]) === status)
    && (!q || p.title.toLowerCase().includes(q.toLowerCase()))), [topic, tier, status, q, progress]);

  const solvedCount = problems.filter((p) => isSolved(statusOf(progress[p.slug]))).length;

  const random = () => {
    const pool = problems.filter((p) => !isSolved(statusOf(progress[p.slug])));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) navigate(`/practice/${pick.slug}/`);
  };

  return (
    <div className="page">
      <h1>Practice problems</h1>
      <p className="prose">
        {problems.length} auto-checked problems on finite state machines, non-deterministic FSMs, FSMs with output,
        grammars, the Chomsky hierarchy and the conversions between them. Wrong answers come with the shortest
        counterexample. Your progress is saved in this browser: {solvedCount} of {problems.length} solved.
      </p>
      <div className="progress-bars">
        {TIERS.map((t) => {
          const all = problems.filter((p) => p.tier === t);
          const done = all.filter((p) => isSolved(statusOf(progress[p.slug]))).length;
          return (
            <div key={t} className="progress-bar">
              <span>{TIER_LABELS[t]}: {done} of {all.length}</span>
              <progress max={all.length} value={done} aria-label={`${TIER_LABELS[t]} problems solved`} />
            </div>
          );
        })}
      </div>
      <div className="filters">
        <label>Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value as Topic | '')}>
            <option value="">All topics</option>
            {TOPICS.map((t) => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Tier
          <select value={tier} onChange={(e) => setTier(e.target.value as Tier | '')}>
            <option value="">All tiers</option>
            {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label>Search
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title" />
        </label>
        <span className="spacer" />
        <button type="button" className="btn" onClick={random} disabled={solvedCount === problems.length}>Random unsolved problem</button>
      </div>
      <p className="small muted" aria-live="polite">{shown.length} problem{shown.length === 1 ? '' : 's'}</p>
      <ul className="problem-list">
        {shown.map((p) => {
          const st = statusOf(progress[p.slug]);
          return (
            <li key={p.slug}>
              <Link to={`/practice/${p.slug}/`} className="problem-card">
                <span className={`status-dot ${st === 'solved' ? 'solved' : st === 'solved-viewed' ? 'viewed' : st === 'attempted' ? 'attempted' : ''}`} title={STATUS_LABELS[st]} />
                <span>
                  <span className="sr-only">{STATUS_LABELS[st]}: </span>
                  {p.title}
                  <span className="meta"><span className="topic">{TOPIC_LABELS[p.topic]}</span></span>
                </span>
                <span className={`tier tier-${p.tier}`}>{TIER_LABELS[p.tier]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="xsmall muted">Status: ○ not started · amber ring attempted · green solved · amber solved after viewing the solution.</p>
    </div>
  );
}
