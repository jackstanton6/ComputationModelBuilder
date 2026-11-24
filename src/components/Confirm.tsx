// Promise-based confirm dialog using the native <dialog> element (focus trapping and Esc for free).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Extra choices besides confirm/cancel; resolves with their value. */
  choices?: { label: string; value: string }[];
}

type Resolver = (v: boolean | string) => void;
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean | string>;

const Ctx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<Resolver | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise((res) => {
      resolver.current = res;
    });
  }, []);

  useEffect(() => {
    if (opts && ref.current && !ref.current.open) ref.current.showModal();
  }, [opts]);

  const close = (v: boolean | string) => {
    ref.current?.close();
    setOpts(null);
    resolver.current?.(v);
    resolver.current = null;
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); close(false); }} aria-labelledby="confirm-title">
          <h2 id="confirm-title" className="dialog-title">{opts.title}</h2>
          {opts.body && <div className="dialog-body">{opts.body}</div>}
          <div className="row dialog-actions">
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => close(false)}>{opts.cancelLabel ?? 'Cancel'}</button>
            {opts.choices?.map((c) => (
              <button key={c.value} type="button" className="btn" onClick={() => close(c.value)}>{c.label}</button>
            ))}
            {opts.confirmLabel !== '' && (
              <button type="button" className="btn btn-primary" onClick={() => close(true)} autoFocus>{opts.confirmLabel ?? 'OK'}</button>
            )}
          </div>
        </dialog>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const c = useContext(Ctx);
  if (!c) throw new Error('ConfirmProvider missing');
  return c;
}
