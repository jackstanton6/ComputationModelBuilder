// KaTeX rendering (works in prerender too, so maths ships as HTML).
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useMemo, type ReactNode } from 'react';

export function texToHtml(tex: string, display = false): string {
  return katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore' });
}

export function Tex({ children, display = false, className }: { children: string; display?: boolean; className?: string }) {
  const html = useMemo(() => texToHtml(children, display), [children, display]);
  const Tag = display ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline text with $…$ maths, **bold**, *italics* and `code`. */
export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  const re = /\$([^$]+)\$|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<Tex key={k++}>{m[1]}</Tex>);
    else if (m[2] !== undefined) out.push(<strong key={k++}><Inline text={m[2]} /></strong>);
    else if (m[3] !== undefined) out.push(<em key={k++}><Inline text={m[3]} /></em>);
    else out.push(<code key={k++}>{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</>;
}

/** Minimal Markdown: paragraphs, "- " lists, $$display maths$$, and inline formatting. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (t.startsWith('$$') && t.endsWith('$$')) return <Tex key={i} display>{t.slice(2, -2).trim()}</Tex>;
        if (t.startsWith('## ')) {
          const text = t.slice(3).trim();
          const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          return <h2 key={i} id={id}><Inline text={text} /></h2>;
        }
        const lines = t.split('\n');
        if (lines.every((l) => /^\s*[-*] /.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*[-*] /, '')} /></li>)}</ul>;
        }
        if (lines.every((l) => /^\s*\d+\. /.test(l))) {
          return <ol key={i}>{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*\d+\. /, '')} /></li>)}</ol>;
        }
        return <p key={i}><Inline text={t.replace(/\n/g, ' ')} /></p>;
      })}
    </div>
  );
}

/** Plain text version of a Markdown/KaTeX string (for meta descriptions). */
export function plainText(md: string): string {
  return md
    .replace(/\$\$?([^$]+)\$\$?/g, (_, t: string) => texToPlain(t))
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

const TEX_SYMBOLS: Record<string, string> = {
  lambda: 'λ', in: '∈', notin: '∉', mid: '|', geq: '≥', leq: '≤', neq: '≠', to: '→', star: '⋆', times: '×',
  emptyset: '∅', cap: '∩', cup: '∪', subseteq: '⊆', Rightarrow: '⇒', ldots: '…', dots: '…', cdot: '·',
  '{': '{', '}': '}', ',': ' ', ';': ' ', quad: ' ', mathcal: '', text: '', mathit: '', mathrm: '', ge: '≥', le: '≤', ne: '≠',
};
const SUP: Record<string, string> = { n: 'ⁿ', m: 'ᵐ', k: 'ᵏ', '2': '²', '3': '³', '+': '⁺', i: 'ⁱ', '*': '*', '1': '¹', '0': '⁰' };
const SUBS: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };

export function texToPlain(t: string): string {
  return t
    .replace(/\\([A-Za-z]+|[{},;])/g, (_, c: string) => TEX_SYMBOLS[c] ?? c)
    .replace(/\^\{([^}]*)\}|\^(\w)/g, (_, a: string, b: string) => [...(a ?? b)].map((c) => SUP[c] ?? c).join(''))
    .replace(/_\{([^}]*)\}|_(\w)/g, (_, a: string, b: string) => [...(a ?? b)].map((c) => SUBS[c] ?? c).join(''))
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
