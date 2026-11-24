// Fixed grammar templates used by the language → grammar builder.
import type { Sym } from './types';

/**
 * Context-sensitive grammar for {xⁿyⁿzⁿ | n ≥ 1} with start symbol R (each production is lAr → lwr).
 * CB is swapped to BC through fresh letters H and K so overlapping swaps can't interfere.
 */
export function ABC_TEMPLATE(x: Sym, y: Sym, z: Sym): [string[], string[]][] {
  return [
    [['R'], [x, 'R', 'B', 'C']],
    [['R'], [x, 'B', 'C']],
    [['C', 'B'], ['H', 'B']],
    [['H', 'B'], ['H', 'K']],
    [['H', 'K'], ['B', 'K']],
    [['B', 'K'], ['B', 'C']],
    [[x, 'B'], [x, y]],
    [[y, 'B'], [y, y]],
    [[y, 'C'], [y, z]],
    [[z, 'C'], [z, z]],
  ];
}
