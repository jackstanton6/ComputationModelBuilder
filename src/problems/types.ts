// Practice problem schema (SPEC §12.1).
import type { Grammar, Machine, MachineKind, Sym } from '../engine/types';
import type { GrammarType } from '../engine/classify';

export type Tier = 'warm-up' | 'standard' | 'exam' | 'challenge';
export type Topic = 'fsm-without-output' | 'nondeterministic' | 'fsm-with-output'
  | 'grammars' | 'grammar-types' | 'conversions' | 'reading-machines';
export type Format = 'build-machine' | 'build-grammar' | 'trace' | 'describe-language'
  | 'classify-grammar' | 'fill-table' | 'possible';

export type TraceField =
  | { id: string; label: string; type: 'state'; expected: string }
  | { id: string; label: string; type: 'set'; expected: string[] }
  | { id: string; label: string; type: 'word'; expected: string }
  | { id: string; label: string; type: 'yesno'; expected: boolean };

export interface Option {
  /** Markdown + KaTeX. */
  text: string;
  /** For describe-language options: the language the option describes (used in tests). */
  predicate?: (w: Sym[]) => boolean;
}

export type AnswerKey =
  | { kind: 'trace'; fields: TraceField[] }
  | { kind: 'describe'; options: Option[]; correct: number }
  | { kind: 'classify'; type: GrammarType }
  | { kind: 'fill-table'; mode: 'table' | 'subset' }
  | { kind: 'possible'; options: Option[]; correct: number };

export interface Constraints {
  machineKind?: MachineKind | 'dfa-or-nfa';
  maxStates?: number;
  /** Exactly this many states (e.g. drawing a machine from its table). */
  exactStates?: number;
  requiredGrammarType?: GrammarType;
  inputAlphabet?: Sym[];
  outputAlphabet?: Sym[];
  terminals?: Sym[];
  checkLength?: number;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  tier: Tier;
  topic: Topic;
  format: Format;
  /** Markdown + KaTeX, course notation. */
  statement: string;
  given?: Machine | Grammar;
  /** Show the given machine only as a state table (no diagram). */
  givenAsTable?: boolean;
  constraints?: Constraints;
  predicate?: (w: Sym[]) => boolean;
  transducer?: (w: Sym[]) => Sym[];
  reference: Machine | Grammar | AnswerKey;
  hints: [string, string, string];
  explanation: string;
  tags?: string[];
  /** Grammar problems: an initial editor text. */
  starter?: string;
}

export const TIER_LABELS: Record<Tier, string> = {
  'warm-up': 'Warm-up', standard: 'Standard', exam: 'Exam', challenge: 'Challenge',
};

export const TOPIC_LABELS: Record<Topic, string> = {
  'fsm-without-output': 'FSMs without output',
  nondeterministic: 'Non-deterministic FSMs',
  'fsm-with-output': 'FSMs with output',
  grammars: 'Grammars',
  'grammar-types': 'Types of grammars',
  conversions: 'Conversions and tables',
  'reading-machines': 'Reading machines',
};

export const isMachine = (x: unknown): x is Machine => typeof x === 'object' && x !== null && 'kind' in x && ['dfa', 'nfa', 'mealy'].includes((x as Machine).kind);
export const isGrammar = (x: unknown): x is Grammar => typeof x === 'object' && x !== null && 'P' in x && 'S' in x;
