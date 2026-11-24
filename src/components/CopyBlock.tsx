import { useState } from 'react';

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A labelled code block with Copy and (optionally) Download buttons. */
export function CopyBlock({ label, text, filename }: { label: string; text: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-block">
      <div className="row">
        <span className="small">{label}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-sm" onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}>{copied ? 'Copied' : 'Copy'}</button>
        {filename && (
          <button type="button" className="btn btn-sm" onClick={() => download(filename, new Blob([text], { type: 'text/x-tex' }))}>Download</button>
        )}
      </div>
      <pre className="code"><code>{text}</code></pre>
    </div>
  );
}
