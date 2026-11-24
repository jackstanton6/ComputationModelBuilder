import { createContext, useContext } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { MachineState } from '../../store/machineStore';
import type { MachineKind } from '../../engine/types';

export interface EditorOptions {
  /** Machine kinds the user may switch between (practice problems may fix it). */
  kinds: MachineKind[];
  /** Lock the alphabets (practice problems). */
  lockAlphabet: boolean;
  /** Called when the user wants to open a grammar in the workbench. */
  onOpenGrammar?: (text: string) => void;
  /** Other saved machines, for "Compare with…". */
  savedMachines?: () => { id: string; name: string; doc: import('../../store/machineDoc').MachineDoc }[];
  /** Open a doc as a new saved machine (subset construction, minimise). */
  onOpenAsNew?: (doc: import('../../store/machineDoc').MachineDoc, name: string) => void;
}

export interface EditorCtx {
  store: StoreApi<MachineState>;
  options: EditorOptions;
}

export const EditorContext = createContext<EditorCtx | null>(null);

export function useEditor(): EditorCtx {
  const c = useContext(EditorContext);
  if (!c) throw new Error('No editor context');
  return c;
}

export function useMachine<T>(selector: (s: MachineState) => T): T {
  return useStore(useEditor().store, selector);
}
