import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { breadcrumbs, type Head } from '../seo/site';
import ClientOnly from '../components/ClientOnly';
import { Tabs } from '../components/Tabs';
import { Tex } from '../components/Tex';
import GrammarEditor from '../components/grammar/GrammarEditor';
import TupleEditor from '../components/grammar/TupleEditor';
import LanguagePanel from '../components/grammar/LanguagePanel';
import FromLanguageTab from '../components/grammar/FromLanguageTab';
import { ConvertTabG, DeriveTab, ExportTabG, TestTabG, TypeTab, WordsTab } from '../components/grammar/GrammarTabs';
import { grammarToText, nonTerminals, parseGrammar } from '../engine/grammar';
import type { Grammar } from '../engine/types';
import { grammarTexParts, texSym } from '../engine/latex';
import type { Derivation } from '../engine/derivation';
import { INCOMING_KEY, readJSON, setLastVisit, writeJSON, type SavedGrammar } from '../store/persist';
import type { MachineDoc } from '../store/machineDoc';

export const handle = {
  head: (): Head => ({
    title: 'Grammar workbench: derivations & Chomsky types · Computation Model Builder',
    description: 'Write phrase-structure grammars G = (V, T, S, P), classify them as type 0–3, derive words step by step and test membership.',
    path: '/grammars/',
    jsonLd: [breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Grammars', path: '/grammars/' }])],
  }),
};

function Intro() {
  return (
    <div className="page prose">
      <h1>Grammar workbench</h1>
      <p>
        Write a phrase-structure grammar G = (V, T, S, P) one production per line, exactly as in lectures.
        See it in course form, classify it with the Type 0–3 table (the Chomsky hierarchy, with the λ rules done
        right), list the words of L(G), build derivations step by step, test membership, and convert a regular
        grammar to a non-deterministic FSM with Kleene’s construction.
      </p>
      <p className="muted">Loading the workbench…</p>
    </div>
  );
}

const DEFAULT: SavedGrammar = { text: 'S -> 0S1 | 01', start: 'S', terminals: null };
const TAB_DEFS = [
  { id: 'type', label: 'Type' }, { id: 'words', label: 'Words' }, { id: 'derive', label: 'Derive' },
  { id: 'test', label: 'Test' }, { id: 'convert', label: 'Convert' }, { id: 'from', label: 'From L' }, { id: 'export', label: 'Export' },
];

const set = (xs: string[]) => (xs.length ? `\\{${xs.map(texSym).join(', ')}\\}` : '\\emptyset');

function Workbench() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState<SavedGrammar>(() => readJSON('grammar', DEFAULT));
  const [tab, setTab] = useState('type');
  const split = (x: string) => x.split(/[\s,]+/).filter(Boolean);
  const override = {
    ...(saved.terminals != null ? { T: split(saved.terminals) } : {}),
    ...(saved.vocab ? { V: split(saved.vocab) } : {}),
  };
  const mode = saved.mode ?? 'lines';
  const [tupleKey, setTupleKey] = useState(0);
  const parsed = useMemo(() => parseGrammar(saved.text, saved.start || 'S', override), [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = parsed.grammar;
  const valid = parsed.errors.length === 0;
  const gKey = JSON.stringify(g);
  const [derivation, setDerivation] = useState<Derivation>({ forms: [[g.S]], steps: [] });

  useEffect(() => writeJSON('grammar', saved), [saved]);
  useEffect(() => setLastVisit({ path: '/grammars/', label: 'Grammar workbench' }), []);
  useEffect(() => setDerivation({ forms: [[g.S]], steps: [] }), [gKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const tex = grammarTexParts(g);
  const update = (p: Partial<SavedGrammar>) => setSaved((s) => ({ ...s, ...p }));

  const openMachine = (doc: MachineDoc, name = 'From grammar (Kleene)') => {
    writeJSON(INCOMING_KEY, { doc, name });
    navigate('/machines/');
  };

  const fromTuple = (g2: Grammar) => {
    const used = new Set([g2.S, ...g2.T, ...g2.P.flatMap((p) => [...p.lhs, ...p.rhs])]);
    update({ text: grammarToText(g2), start: g2.S, terminals: g2.T.join(', '), vocab: g2.V.filter((x) => !used.has(x)).join(', ') || null });
  };

  const loadGrammar = (g2: Grammar) => {
    setSaved((s) => ({ ...s, text: grammarToText(g2), start: g2.S, terminals: null, vocab: null }));
    setTupleKey((k) => k + 1);
    setTab('type');
  };

  return (
    <div className="grammar-page">
      <div className="grammar-left">
        <h1 className="h-sm">Grammar workbench</h1>
        <fieldset className="mode-switch row" aria-label="How to enter the grammar">
          <legend className="sr-only">Input mode</legend>
          <label className={`seg${mode === 'lines' ? ' on' : ''}`}>
            <input type="radio" name="g-mode" checked={mode === 'lines'} onChange={() => update({ mode: 'lines' })} /> Productions
          </label>
          <label className={`seg${mode === 'tuple' ? ' on' : ''}`}>
            <input type="radio" name="g-mode" checked={mode === 'tuple'} onChange={() => { update({ mode: 'tuple' }); setTupleKey((k) => k + 1); }} /> G = (V, T, S, P)
          </label>
        </fieldset>
        {mode === 'tuple' ? <TupleEditor key={tupleKey} initial={g} onValid={fromTuple} /> : (<>
        <GrammarEditor value={saved.text} onChange={(text) => update({ text })} errors={parsed.errors} />
        <div className="row">
          <label className="row small" htmlFor="start-symbol">Start symbol</label>
          <input id="start-symbol" type="text" value={saved.start} onChange={(e) => update({ start: e.target.value.trim() })} size={6} className="mono" />
        </div>
        <section className="vocab-panel" aria-label="Vocabulary">
          <h2 className="h-sm">Vocabulary</h2>
          <Tex>{`V = ${set(g.V)}`}</Tex>
          <Tex>{`T = ${set(g.T)}`}</Tex>
          <Tex>{`N = V - T = ${set(nonTerminals(g))}`}</Tex>
          <label className="check small">
            <input type="checkbox" checked={saved.terminals !== null} onChange={(e) => update({ terminals: e.target.checked ? g.T.join(', ') : null })} />
            Set T explicitly
          </label>
          {saved.terminals !== null && (
            <label className="field">
              <span className="xsmall muted">Terminals, separated by commas or spaces. Every other symbol is a non-terminal.</span>
              <input type="text" className="mono" value={saved.terminals} onChange={(e) => update({ terminals: e.target.value })} />
            </label>
          )}
        </section>
        </>)}
        <section className="course-form" aria-label="Grammar in course form">
          <Tex display>{tex.tuple}</Tex>
          <Tex display>{tex.V}</Tex>
          <Tex display>{tex.T}</Tex>
          <Tex display>{tex.P}</Tex>
        </section>
        {valid && <LanguagePanel g={g} gKey={gKey} />}
      </div>
      <div className="grammar-right">
        <Tabs tabs={TAB_DEFS} value={tab} onChange={setTab} label="Grammar panels">
          {tab === 'from' ? (
            <FromLanguageTab onUse={loadGrammar} onOpenMachine={(doc) => openMachine(doc, 'From a pattern')} />
          ) : !valid ? (
            <p className="inline-msg">Fix the errors in the grammar first.</p>
          ) : (
            <>
              {tab === 'type' && <TypeTab g={g} />}
              {tab === 'words' && <WordsTab g={g} key={gKey} />}
              {tab === 'derive' && <DeriveTab g={g} derivation={derivation} setDerivation={setDerivation} />}
              {tab === 'test' && <TestTabG g={g} key={gKey} />}
              {tab === 'convert' && <ConvertTabG g={g} onOpenMachine={openMachine} />}
              {tab === 'export' && <ExportTabG g={g} derivation={derivation} />}
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export function Component() {
  return <ClientOnly fallback={<Intro />}>{() => <Workbench />}</ClientOnly>;
}
