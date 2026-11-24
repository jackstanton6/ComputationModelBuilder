import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Head } from '../seo/site';
import { breadcrumbs } from '../seo/site';
import ClientOnly from '../components/ClientOnly';
import MachineEditor from '../components/machine/MachineEditor';
import { emptyDoc, type MachineDoc } from '../store/machineDoc';
import { createMachineStore } from '../store/machineStore';
import { INCOMING_KEY, loadLibrary, readJSON, removeKey, saveLibrary, setLastVisit, writeJSON, type MachineLibrary, type SavedMachine } from '../store/persist';
import { newId } from '../store/machineDoc';
import { useConfirm } from '../components/Confirm';

export const handle = {
  head: (): Head => ({
    title: 'Finite state machine builder & simulator · Computation Model Builder',
    description: 'Draw FSMs with and without output and non-deterministic FSMs, step through inputs, convert with the subset construction and export to TikZ.',
    path: '/machines/',
    jsonLd: [breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Machines', path: '/machines/' }])],
  }),
};

function Intro() {
  return (
    <div className="page prose">
      <h1>Finite state machine builder</h1>
      <p>
        Draw an FSM without output (a deterministic finite automaton), a non-deterministic FSM or an FSM with output,
        in the MATH1064/1964 notation: M = (S, I, f, s₀, F) or M = (S, I, O, f, g, s₀). Step through input strings,
        edit the state table, convert a non-deterministic FSM with the subset construction, minimise, compare
        machines and export to TikZ.
      </p>
      <p className="muted">Loading the editor…</p>
    </div>
  );
}

function Builder() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [lib, setLib] = useState<MachineLibrary>(() => {
    const l = loadLibrary();
    const incoming = readJSON<{ doc: MachineDoc; name: string } | null>(INCOMING_KEY, null);
    if (incoming) {
      removeKey(INCOMING_KEY);
      const item: SavedMachine = { id: newId('m'), name: incoming.name, doc: incoming.doc, updated: Date.now() };
      return { currentId: item.id, items: [item, ...l.items] };
    }
    if (l.items.length === 0) {
      const item: SavedMachine = { id: newId('m'), name: 'Untitled machine', doc: emptyDoc(), updated: Date.now() };
      return { currentId: item.id, items: [item] };
    }
    if (!l.items.some((i) => i.id === l.currentId)) return { ...l, currentId: l.items[0].id };
    return l;
  });
  const [drawer, setDrawer] = useState(false);
  const current = lib.items.find((i) => i.id === lib.currentId)!;
  const store = useMemo(() => createMachineStore(current.doc), []); // eslint-disable-line react-hooks/exhaustive-deps
  const libRef = useRef(lib);
  libRef.current = lib;

  useEffect(() => saveLibrary(lib), [lib]);
  useEffect(() => setLastVisit({ path: '/machines/', label: current.name }), [current.name]);

  // Autosave the current machine.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = store.subscribe((s, prev) => {
      if (s.doc === prev.doc) return;
      clearTimeout(t);
      t = setTimeout(() => {
        setLib((l) => ({ ...l, items: l.items.map((i) => (i.id === l.currentId ? { ...i, doc: s.doc, updated: Date.now() } : i)) }));
      }, 250);
    });
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, [store]);

  const flush = (): MachineLibrary => {
    const doc = store.getState().doc;
    const l = libRef.current;
    return { ...l, items: l.items.map((i) => (i.id === l.currentId ? { ...i, doc, updated: Date.now() } : i)) };
  };

  const open = (id: string, base: MachineLibrary = flush()) => {
    const item = base.items.find((i) => i.id === id)!;
    setLib({ ...base, currentId: id });
    store.getState().load(item.doc);
    setDrawer(false);
  };

  const addNew = (doc: MachineDoc, name: string) => {
    const base = flush();
    const used = new Set(base.items.map((i) => i.name));
    let n = name;
    for (let k = 2; used.has(n); k++) n = `${name} ${k}`;
    const item: SavedMachine = { id: newId('m'), name: n, doc, updated: Date.now() };
    open(item.id, { ...base, items: [item, ...base.items] });
  };

  const rename = (id: string, name: string) => setLib((l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, name } : i)) }));

  const options = {
    kinds: ['dfa', 'nfa', 'mealy'] as const,
    lockAlphabet: false,
    onOpenGrammar: (text: string) => {
      writeJSON('grammar', { text, start: 'S', terminals: null });
      navigate('/grammars/');
    },
    savedMachines: () => flush().items.filter((i) => i.id !== libRef.current.currentId).map((i) => ({ id: i.id, name: i.name, doc: i.doc })),
    onOpenAsNew: (doc: MachineDoc, name: string) => addNew(doc, name),
  };

  const toolbarExtra = (
    <div className="machine-name">
      <label className="xsmall muted" htmlFor="machine-name">Machine</label>
      <input id="machine-name" type="text" value={current.name} onChange={(e) => rename(current.id, e.target.value)} />
      <button type="button" className="btn btn-sm" aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>My machines ({lib.items.length})</button>
    </div>
  );

  return (
    <div className="builder-page">
      <h1 className="sr-only">Finite state machine builder</h1>
      <MachineEditor store={store} options={{ ...options, kinds: [...options.kinds] }} toolbarExtra={toolbarExtra} fileBase={current.name} />
      {drawer && (
        <div className="drawer" role="dialog" aria-label="My machines">
          <div className="row drawer-head">
            <h2 className="h-sm">My machines</h2>
            <span className="spacer" />
            <button type="button" className="btn btn-sm btn-ghost" aria-label="Close" onClick={() => setDrawer(false)}>×</button>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => addNew(emptyDoc(), 'Untitled machine')}>New machine</button>
          <ul className="drawer-list">
            {[...lib.items].sort((a, b) => b.updated - a.updated).map((i) => (
              <li key={i.id} className={i.id === lib.currentId ? 'current' : undefined}>
                <button type="button" className="link-btn" onClick={() => open(i.id)} aria-current={i.id === lib.currentId}>{i.name}</button>
                <span className="xsmall muted">{i.doc.states.length} states · {new Date(i.updated).toLocaleDateString('en-AU')}</span>
                <div className="row">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => addNew(structuredClone(i.id === lib.currentId ? store.getState().doc : i.doc), `${i.name} copy`)}>Duplicate</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={async () => {
                    const v = await renamePrompt(confirm, i.name);
                    if (v) rename(i.id, v);
                  }}>Rename</button>
                  <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={async () => {
                    const ok = await confirm({ title: `Delete “${i.name}”?`, body: 'This can’t be undone.', confirmLabel: 'Delete' });
                    if (!ok) return;
                    const base = flush();
                    const items = base.items.filter((x) => x.id !== i.id);
                    if (items.length === 0) {
                      const fresh: SavedMachine = { id: newId('m'), name: 'Untitled machine', doc: emptyDoc(), updated: Date.now() };
                      open(fresh.id, { currentId: fresh.id, items: [fresh] });
                    } else if (i.id === base.currentId) {
                      open(items[0].id, { ...base, items });
                    } else {
                      setLib({ ...base, items });
                    }
                  }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

async function renamePrompt(confirm: ReturnType<typeof useConfirm>, current: string): Promise<string | null> {
  let value = current;
  const ok = await confirm({
    title: 'Rename machine',
    body: <input type="text" defaultValue={current} aria-label="New name" autoFocus onChange={(e) => { value = e.target.value; }} />,
    confirmLabel: 'Rename',
  });
  return ok && value.trim() ? value.trim() : null;
}

export function Component() {
  return <ClientOnly fallback={<Intro />}>{() => <Builder />}</ClientOnly>;
}
