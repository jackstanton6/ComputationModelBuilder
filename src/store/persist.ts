// localStorage persistence under versioned keys (cmb:v1:…). All access is guarded so the app
// still works when storage is unavailable.
import type { MachineDoc } from './machineDoc';

const PREFIX = 'cmb:v1:';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Remove every key belonging to this app with the given sub-prefix. */
export function removePrefix(sub: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + sub)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// ---------- Saved machines ("My machines") ----------

export interface SavedMachine {
  id: string;
  name: string;
  doc: MachineDoc;
  updated: number;
}

export interface MachineLibrary {
  currentId: string | null;
  items: SavedMachine[];
}

export const loadLibrary = (): MachineLibrary => readJSON<MachineLibrary>('machines', { currentId: null, items: [] });
export const saveLibrary = (lib: MachineLibrary) => writeJSON('machines', lib);

// ---------- Grammar workbench ----------

export interface SavedGrammar {
  text: string;
  start: string;
  terminals: string | null;
}

// ---------- "Continue where you left off" ----------

export interface LastVisit {
  path: string;
  label: string;
}
export const setLastVisit = (v: LastVisit) => writeJSON('last', v);
export const getLastVisit = () => readJSON<LastVisit | null>('last', null);

/** Hand-off key: a machine to open as new in the builder (from Kleene's construction). */
export const INCOMING_KEY = 'incoming-machine';
