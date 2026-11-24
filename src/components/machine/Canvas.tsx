// Interactive SVG canvas for drawing state diagrams.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { plainName } from '../../engine/notation';
import { tidyLayout, type MachineDoc } from '../../store/machineDoc';
import { DiagramContent, summary } from './Diagram';
import { angleTo, bounds, R, type Pt } from './geometry';
import { useEditor, useMachine } from './EditorContext';
import TransitionEditor from './TransitionEditor';

interface View {
  tx: number;
  ty: number;
  k: number;
}

type Drag =
  | { type: 'move'; id: string; start: Pt; orig: Pt; snapshot: MachineDoc; moved: boolean }
  | { type: 'edge'; from: string; cur: Pt; over: string | null }
  | { type: 'pan'; start: Pt; orig: View }
  | { type: 'loop'; id: string; snapshot: MachineDoc };

export default function Canvas() {
  const { store } = useEditor();
  const doc = useMachine((s) => s.doc);
  const selection = useMachine((s) => s.selection);
  const sim = useMachine((s) => s.sim);
  const edgeEditor = useMachine((s) => s.edgeEditor);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ tx: 0, ty: 0, k: 1 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const fitted = useRef(false);

  const toWorld = useCallback((clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.tx) / view.k, y: (clientY - r.top - view.ty) / view.k };
  }, [view]);
  const toScreen = (p: Pt): Pt => ({ x: p.x * view.k + view.tx, y: p.y * view.k + view.ty });

  const fit = useCallback((d: MachineDoc = store.getState().doc) => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (d.states.length === 0) {
      setView({ tx: 0, ty: 0, k: 1 });
      return;
    }
    const b = bounds(d.states, 70);
    const k = Math.min(1.4, Math.max(0.3, Math.min(w / b.w, h / b.h)));
    setView({ k, tx: (w - b.w * k) / 2 - b.x * k, ty: (h - b.h * k) / 2 - b.y * k });
  }, [store]);

  useLayoutEffect(() => {
    if (!fitted.current) {
      fitted.current = true;
      fit();
    }
  }, [fit]);

  // Refit when a different machine is loaded.
  useEffect(() => store.subscribe((s, prev) => {
    if (s.past.length === 0 && s.future.length === 0 && s.doc !== prev.doc) requestAnimationFrame(() => fit(s.doc));
  }), [store, fit]);

  // Ctrl+wheel zooms around the pointer; plain wheel pans. Needs a non-passive listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          const k = Math.min(3, Math.max(0.25, v.k * Math.exp(-e.deltaY * 0.002)));
          return { k, tx: px - ((px - v.tx) / v.k) * k, ty: py - ((py - v.ty) / v.k) * k };
        }
        return { ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const S = store.getState;

  const startPan = (e: RPointerEvent) => {
    setDrag({ type: 'pan', start: { x: e.clientX, y: e.clientY }, orig: view });
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onBackgroundDown = (e: RPointerEvent) => {
    wrapRef.current?.focus({ preventScroll: true });
    if (e.button === 1 || space) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    S().select(null);
    S().openEdgeEditor(null);
    setRenaming(null);
    startPan(e); // dragging empty canvas also pans
  };

  const onStateDown = (e: RPointerEvent, id: string) => {
    e.stopPropagation();
    wrapRef.current?.focus({ preventScroll: true });
    if (e.button === 1 || space) {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    if (e.shiftKey) {
      setDrag({ type: 'edge', from: id, cur: p, over: null });
      return;
    }
    const st = S().doc.states.find((s) => s.id === id)!;
    S().select({ type: 'state', id });
    S().openEdgeEditor(null);
    setDrag({ type: 'move', id, start: p, orig: { x: st.x, y: st.y }, snapshot: S().doc, moved: false });
  };

  const onHandleDown = (e: RPointerEvent, id: string) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ type: 'edge', from: id, cur: toWorld(e.clientX, e.clientY), over: null });
  };

  const onEdgeDown = (e: RPointerEvent, from: string, to: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    S().select({ type: 'edge', from, to });
    S().openEdgeEditor({ from, to, isNew: false });
  };

  const onLoopHandleDown = (e: RPointerEvent, id: string) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ type: 'loop', id, snapshot: S().doc });
  };

  const stateAt = (p: Pt): string | null => {
    let best: string | null = null;
    let bestD = R + 8;
    for (const s of S().doc.states) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    return best;
  };

  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    if (drag.type === 'pan') {
      setView({ ...drag.orig, tx: drag.orig.tx + e.clientX - drag.start.x, ty: drag.orig.ty + e.clientY - drag.start.y });
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    if (drag.type === 'move') {
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      if (!drag.moved) setDrag({ ...drag, moved: true });
      S().replace((d) => ({ ...d, states: d.states.map((s) => (s.id === drag.id ? { ...s, x: Math.round(drag.orig.x + dx), y: Math.round(drag.orig.y + dy) } : s)) }));
    } else if (drag.type === 'edge') {
      setDrag({ ...drag, cur: p, over: stateAt(p) });
    } else if (drag.type === 'loop') {
      S().replace((d) => ({ ...d, states: d.states.map((s) => (s.id === drag.id ? { ...s, loopAngle: angleTo(s, p) } : s)) }));
    }
  };

  const onUp = () => {
    if (!drag) return;
    if (drag.type === 'move' && drag.moved) S().checkpoint(drag.snapshot);
    if (drag.type === 'loop') S().checkpoint(drag.snapshot);
    if (drag.type === 'edge' && drag.over) {
      S().select({ type: 'edge', from: drag.from, to: drag.over });
      S().openEdgeEditor({ from: drag.from, to: drag.over, isNew: true });
    }
    setDrag(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.state, .edge')) return;
    const p = toWorld(e.clientX, e.clientY);
    S().addState(Math.round(p.x), Math.round(p.y));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, select, textarea, .popover')) return;
    const st = S();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) st.redo();
      else st.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      st.redo();
      return;
    }
    if (e.key === ' ') {
      setSpace(true);
      e.preventDefault();
      return;
    }
    const sel = st.selection;
    if (e.key === 'Escape') {
      st.select(null);
      st.openEdgeEditor(null);
      setRenaming(null);
      return;
    }
    if (!sel) return;
    if (sel.type === 'state') {
      if (e.key === 's' || e.key === 'S') st.setInitial(sel.id);
      else if ((e.key === 'a' || e.key === 'A') && st.doc.kind !== 'mealy') st.toggleAccepting(sel.id);
      else if (e.key === 'Delete' || e.key === 'Backspace') st.deleteState(sel.id);
      else if (e.key === 'F2' || e.key === 'Enter') setRenaming(sel.id);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        st.update((d) => ({ ...d, states: d.states.map((s) => (s.id === sel.id ? { ...s, x: s.x + dx, y: s.y + dy } : s)) }));
      }
    } else if (sel.type === 'edge' && (e.key === 'Delete' || e.key === 'Backspace')) {
      st.deleteEdge(sel.from, sel.to);
    }
  };

  const selState = selection?.type === 'state' ? doc.states.find((s) => s.id === selection.id) : undefined;
  const fromState = drag?.type === 'edge' ? doc.states.find((s) => s.id === drag.from) : undefined;
  const overlay = drag?.type === 'edge' && fromState ? (
    <g pointerEvents="none">
      <line x1={fromState.x} y1={fromState.y} x2={drag.cur.x} y2={drag.cur.y} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 4" />
      {drag.over && (() => {
        const o = doc.states.find((s) => s.id === drag.over)!;
        return <circle cx={o.x} cy={o.y} r={R + 5} fill="none" stroke="var(--accent)" strokeWidth={2} />;
      })()}
    </g>
  ) : null;

  const editorPos = (() => {
    if (!edgeEditor) return null;
    const a = doc.states.find((s) => s.id === edgeEditor.from);
    const b = doc.states.find((s) => s.id === edgeEditor.to);
    if (!a || !b) return null;
    const p = toScreen({ x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) });
    const el = wrapRef.current;
    const maxX = (el?.clientWidth ?? 800) - 260;
    const maxY = (el?.clientHeight ?? 600) - 220;
    return { x: Math.max(8, Math.min(maxX, p.x - 120)), y: Math.max(8, Math.min(maxY, p.y + 40)) };
  })();

  const barPos = selState ? toScreen({ x: selState.x, y: selState.y - R - 12 }) : null;

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap${space || drag?.type === 'pan' ? ' panning' : ''}`}
      tabIndex={0}
      aria-label="State diagram canvas. Double-click to add a state. Use the Table tab for a keyboard alternative."
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key === ' ' && setSpace(false)}
      onBlur={() => setSpace(false)}
    >
      <svg
        ref={svgRef}
        className="canvas"
        role="img"
        aria-label={summary(doc)}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onDoubleClick}
        onPointerLeave={() => setHover(null)}
      >
        <title>State diagram</title>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            <DiagramContent
            doc={doc}
            selection={selection}
            sim={sim}
            interactive
            hoverState={hover}
            overlay={overlay}
            onStatePointerDown={onStateDown}
            onHandlePointerDown={onHandleDown}
            onEdgePointerDown={onEdgeDown}
            onLoopHandlePointerDown={onLoopHandleDown}
          />
        </g>
      </svg>
      {doc.states.length === 0 && (
        <div className="canvas-empty">
          <p>Double-click anywhere to add a state.</p>
          <p className="small muted">Drag from a state’s handle (or Shift-drag a state) to another state to add a transition.</p>
        </div>
      )}
      {selState && barPos && !drag && (
        <div className="context-bar" style={{ left: barPos.x, top: barPos.y }} onPointerDown={(e) => e.stopPropagation()}>
          {renaming === selState.id ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const v = (new FormData(e.currentTarget).get('name') as string).trim();
                if (v) S().renameState(selState.id, v);
                setRenaming(null);
                wrapRef.current?.focus();
              }}
            >
              <input name="name" type="text" defaultValue={selState.name} aria-label="State name" autoFocus size={8}
                onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} />
              <button type="submit" className="btn btn-sm">OK</button>
            </form>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => S().setInitial(selState.id)} disabled={doc.start === selState.id} title="Shortcut: S">
                Set as initial
              </button>
              {doc.kind !== 'mealy' && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => S().toggleAccepting(selState.id)} title="Shortcut: A">
                  {doc.accepting.includes(selState.id) ? 'Make non-accepting' : 'Make accepting'}
                </button>
              )}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(selState.id)} title="Shortcut: Enter">Rename</button>
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => S().deleteState(selState.id)} title="Shortcut: Delete">Delete</button>
            </>
          )}
        </div>
      )}
      {edgeEditor && editorPos && (
        <TransitionEditor
          from={edgeEditor.from}
          to={edgeEditor.to}
          x={editorPos.x}
          y={editorPos.y}
          onClose={() => {
            S().openEdgeEditor(null);
            wrapRef.current?.focus();
          }}
        />
      )}
      <div className="canvas-tools no-print">
        <button type="button" className="btn btn-sm" onClick={() => {
          const next = tidyLayout(S().doc);
          S().update(() => next);
          requestAnimationFrame(() => fit(next));
        }}>Tidy layout</button>
        <button type="button" className="btn btn-sm" onClick={() => fit()}>Fit</button>
        <span className="xsmall muted zoom-level" aria-live="off">{Math.round(view.k * 100)}%</span>
      </div>
      <span className="sr-only" aria-live="polite">
        {selState ? `Selected ${plainName(selState.name)}` : ''}
      </span>
    </div>
  );
}
