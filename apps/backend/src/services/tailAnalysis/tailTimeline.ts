/**
 * La FRISE de la fin d'un média : une case d'image toutes les dix secondes — et
 * les lectures élémentaires qu'on en fait. Le son n'y est plus : l'analyse
 * audio est retirée, la frise ne porte que les vignettes.
 *
 * Pur, sans E/S : c'est ce qui permet de rejouer au banc, sur des frises
 * relevées une fois, toutes les règles de `tailSkeleton.ts` et `tailScenes.ts`.
 */

import type { CellKind } from "./tailCells";

export interface TailInput {
  runtimeMs: number;
  /** Le pas des vignettes (l'`Interval` du manifeste trickplay). */
  intervalMs: number;
  /** Position de la première case d'image. */
  cellsFromMs: number;
  /** Une lettre `CellKind` par vignette, à partir de `cellsFromMs`. */
  cells: string;
  /** Les génériques annoncés par les fournisseurs (Jellyfin, chapitres, greffons). */
  providerSpans: ReadonlyArray<ProviderSpan>;
  /** Les mesures brutes de chaque case, alignées sur `cells` (`null` où la planche manquait). */
  measures?: ReadonlyArray<CellMeasure | null>;
}

/** Ce qu'on garde des mesures d'une vignette (`tailCells.ts`) pour les lectures fines. */
export interface CellMeasure {
  /** Part de pixels quasi noirs. */
  dark: number;
  /** Part des pixels à ±10 de la luminance médiane : un fond uni. */
  modal: number;
}

export interface ProviderSpan {
  startMs: number;
  endMs: number;
}

export class Timeline {
  constructor(readonly input: TailInput) {}

  get runtimeMs(): number {
    return this.input.runtimeMs;
  }

  get step(): number {
    return this.input.intervalMs;
  }

  get firstCellMs(): number {
    return this.input.cellsFromMs;
  }

  /**
   * La fin de la dernière image connue. Elle précède parfois de une à deux minutes la
   * durée annoncée : des pistes de sous-titres plus longues que la vidéo allongent le
   * fichier (« Marvel's Daredevil » S1E1, « Stranger Things » S4E9) — au-delà, plus
   * de vignette, et ce qui la précède est bien la fin.
   */
  get knownEndMs(): number {
    const cells = this.input.cells;
    let last = cells.length - 1;
    while (last >= 0 && cells[last] === "?") last--;
    if (last < 0) return this.input.runtimeMs;
    return Math.min(this.input.runtimeMs, this.input.cellsFromMs + (last + 1) * this.input.intervalMs);
  }

  /** La case d'image qui couvre `ms`, ou `?` hors de la frise. */
  cell(ms: number): CellKind | "?" {
    const i = Math.floor((ms - this.input.cellsFromMs) / this.input.intervalMs);
    return i >= 0 && i < this.input.cells.length ? (this.input.cells[i] as CellKind) : "?";
  }

  /** Les mesures de la case qui couvre `ms`, ou `null`. */
  measure(ms: number): CellMeasure | null {
    const i = Math.floor((ms - this.input.cellsFromMs) / this.input.intervalMs);
    return this.input.measures?.[i] ?? null;
  }

  /** Les cases d'image de [from, to), alignées sur la grille. */
  cellsBetween(from: number, to: number): string {
    let out = "";
    const start = from - ((from - this.input.cellsFromMs) % this.input.intervalMs);
    for (let t = start; t < to; t += this.input.intervalMs) out += this.cell(t);
    return out;
  }
}

export const count = (text: string, letters: string): number => {
  let n = 0;
  for (const c of text) if (letters.includes(c)) n++;
  return n;
};

/** Une vignette de texte : défilement, texte clair, carton. */
export const isText = (c: string): boolean => c === "T" || c === "L" || c === "C";
/** Une vignette de générique : du texte, ou un aplat. */
export const isCredits = (c: string): boolean => isText(c) || c === "U";
