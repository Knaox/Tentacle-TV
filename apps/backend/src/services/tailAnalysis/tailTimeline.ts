/**
 * La FRISE de la fin d'un média : une case d'image toutes les dix secondes, une
 * case de son chaque seconde — et les lectures élémentaires qu'on en fait.
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
  /** La frise audio (`speechModel.ts`) — `null` quand on n'a rien pu écouter. */
  audio: { fromMs: number; classes: string } | null;
  /** Les génériques annoncés par les fournisseurs (Jellyfin, chapitres, greffons). */
  providerSpans: ReadonlyArray<ProviderSpan>;
  /** Un épisode : son générique peut se clore sur l'aperçu du suivant (`tailPreview.ts`). */
  episode?: boolean;
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
  /** Tiré d'un chapitre NOMMÉ générique : il dit où le générique commence, illustré compris. */
  named?: boolean;
}

export class Timeline {
  /** La frise d'image, texte clair tranché par le son (voir `resolveLightText`). */
  private readonly kinds: string;

  constructor(readonly input: TailInput) {
    this.kinds = resolveLightText(input);
  }

  get runtimeMs(): number {
    return this.input.runtimeMs;
  }

  get step(): number {
    return this.input.intervalMs;
  }

  get firstCellMs(): number {
    return this.input.cellsFromMs;
  }

  get hasAudio(): boolean {
    return this.input.audio !== null;
  }

  /**
   * La fin de la dernière image connue. Elle précède parfois de une à deux minutes la
   * durée annoncée : des pistes de sous-titres plus longues que la vidéo allongent le
   * fichier (« Marvel's Daredevil » S1E1, « Stranger Things » S4E9) — au-delà, ni
   * vignette ni son, et ce qui la précède est bien la fin.
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
    return i >= 0 && i < this.kinds.length ? (this.kinds[i] as CellKind) : "?";
  }

  /** Les mesures de la case qui couvre `ms`, ou `null`. */
  measure(ms: number): CellMeasure | null {
    const i = Math.floor((ms - this.input.cellsFromMs) / this.input.intervalMs);
    return this.input.measures?.[i] ?? null;
  }

  /** La seconde de son qui couvre `ms`, ou `?`. */
  sound(ms: number): string {
    const audio = this.input.audio;
    if (audio === null) return "?";
    const i = Math.floor((ms - audio.fromMs) / 1000);
    return i >= 0 && i < audio.classes.length ? audio.classes[i] : "?";
  }

  /** Part des secondes de [from, to) qui portent la classe `kind`. */
  share(from: number, to: number, kind: "S" | "M" | "Q"): number {
    let n = 0;
    let hits = 0;
    for (let t = from; t < to; t += 1000) {
      n++;
      if (this.sound(t) === kind) hits++;
    }
    return n > 0 ? hits / n : 0;
  }

  /** Les cases d'image de [from, to), alignées sur la grille. */
  cellsBetween(from: number, to: number): string {
    let out = "";
    const start = from - ((from - this.input.cellsFromMs) % this.input.intervalMs);
    for (let t = start; t < to; t += this.input.intervalMs) out += this.cell(t);
    return out;
  }

  /** Les plages continues de la frise audio : [début, fin, classe]. */
  soundRuns(): Array<[number, number, string]> {
    const audio = this.input.audio;
    if (audio === null) return [];
    const runs: Array<[number, number, string]> = [];
    let i = 0;
    while (i < audio.classes.length) {
      let j = i;
      while (j < audio.classes.length && audio.classes[j] === audio.classes[i]) j++;
      runs.push([audio.fromMs + i * 1000, audio.fromMs + j * 1000, audio.classes[i]]);
      i = j;
    }
    return runs;
  }
}

/**
 * Le texte sur fond clair (`L`) n'est du générique que sous de la musique : un
 * aplat cerné sous un dialogue est un dessin animé. Sans audio, on le garde
 * pour du texte — c'est ce que faisait la lecture des seules vignettes.
 */
function resolveLightText(input: TailInput): string {
  const audio = input.audio;
  if (audio === null) return input.cells;
  let out = "";
  for (let i = 0; i < input.cells.length; i++) {
    const c = input.cells[i];
    if (c !== "L") {
      out += c;
      continue;
    }
    const from = input.cellsFromMs + i * input.intervalMs;
    let speech = 0;
    let known = 0;
    for (let t = from; t < from + input.intervalMs; t += 1000) {
      const k = Math.floor((t - audio.fromMs) / 1000);
      if (k < 0 || k >= audio.classes.length) continue;
      known++;
      if (audio.classes[k] === "S") speech++;
    }
    out += known > 0 && speech * 2 > known ? "E" : "L";
  }
  return out;
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
