// Export the diagram (SVG/PNG) and LaTeX (TikZ, state table, formal definition).
import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { docToMachine, type MachineDoc } from '../../store/machineDoc';
import { machineDefinitionLatex, stateTableLatex } from '../../engine/latex';
import { machineTikz, TIKZ_PREAMBLE } from '../../engine/tikz';
import { computedPalette, DiagramContent, lightPalette, summary, type Palette } from './Diagram';
import { bounds } from './geometry';
import { useMachine } from './EditorContext';
import { CopyBlock, download } from '../CopyBlock';

export function diagramSvgString(doc: MachineDoc, palette: Palette): string {
  const b = bounds(doc.states);
  const div = document.createElement('div');
  const root = createRoot(div);
  flushSync(() => {
    root.render(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} width={Math.round(b.w)} height={Math.round(b.h)}>
        <title>State diagram</title>
        <desc>{summary(doc)}</desc>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={palette.bg} />
        <DiagramContent doc={doc} palette={palette} />
      </svg>,
    );
  });
  const svg = div.innerHTML;
  root.unmount();
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
}

export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Could not render the image.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ExportTab({ fileBase = 'machine' }: { fileBase?: string }) {
  const doc = useMachine((s) => s.doc);
  const [theme, setTheme] = useState<'light' | 'current'>('light');
  const [error, setError] = useState('');
  const m = useMemo(() => docToMachine(doc), [doc]);
  const positions = Object.fromEntries(doc.states.map((s) => [s.id, s]));
  const tikz = machineTikz(m, positions);
  const table = stateTableLatex(m);
  const def = machineDefinitionLatex(m);
  const palette = () => (theme === 'light' ? lightPalette : computedPalette());
  const name = fileBase.replace(/[^\w-]+/g, '-').toLowerCase() || 'machine';
  const all = [
    '% Computation Model Builder export',
    ...TIKZ_PREAMBLE,
    '',
    '% State diagram',
    machineTikz(m, positions).split('\n').filter((l) => !l.startsWith('% ')).join('\n'),
    '',
    '% State table',
    table,
    '',
    '% Formal definition (needs amsmath)',
    def,
  ].join('\n');

  if (doc.states.length === 0) return <p className="muted">Add some states to export the machine.</p>;

  return (
    <div className="stack export-tab">
      <section className="stack">
        <h3 className="h-sm">Image</h3>
        <fieldset className="row">
          <legend className="xsmall muted">Colours</legend>
          <label className="check small"><input type="radio" name="exp-theme" checked={theme === 'light'} onChange={() => setTheme('light')} /> Light (best for assignments)</label>
          <label className="check small"><input type="radio" name="exp-theme" checked={theme === 'current'} onChange={() => setTheme('current')} /> Current theme</label>
        </fieldset>
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => download(`${name}.svg`, new Blob([diagramSvgString(doc, palette())], { type: 'image/svg+xml' }))}>Download SVG</button>
          <button type="button" className="btn btn-sm" onClick={async () => {
            try {
              setError('');
              download(`${name}.png`, await svgToPng(diagramSvgString(doc, palette()), 2));
            } catch (e) {
              setError((e as Error).message);
            }
          }}>Download PNG (2×)</button>
        </div>
        {error && <p className="xsmall reject" role="alert">{error}</p>}
      </section>
      <section className="stack">
        <h3 className="h-sm">LaTeX</h3>
        <CopyBlock label="Diagram (TikZ)" text={tikz} filename={`${name}-diagram.tex`} />
        <CopyBlock label="State table (tabular)" text={table} filename={`${name}-table.tex`} />
        <CopyBlock label="Formal definition" text={def} filename={`${name}-definition.tex`} />
        <button type="button" className="btn btn-sm" onClick={() => download(`${name}.tex`, new Blob([all], { type: 'text/x-tex' }))}>Download everything as .tex</button>
      </section>
    </div>
  );
}
