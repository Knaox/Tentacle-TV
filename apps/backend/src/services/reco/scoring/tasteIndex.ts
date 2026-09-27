import type { FacetEntry } from "../facets";

/** Vecteur TF-IDF d'un titre, normalisé (norme 1) — clé de facette → poids. */
export function normalizedVector(
  facets: readonly FacetEntry[],
  idfFor: (key: string) => number
): Map<string, number> {
  const vec = new Map<string, number>();
  for (const f of facets) {
    const w = f.mult * idfFor(f.key);
    if (w !== 0) vec.set(f.key, (vec.get(f.key) ?? 0) + w);
  }
  let norm = 0;
  for (const v of vec.values()) norm += v * v;
  if (norm === 0) return new Map();
  const inv = 1 / Math.sqrt(norm);
  for (const [k, v] of vec) vec.set(k, v * inv);
  return vec;
}

export interface IndexedAnchor {
  key: string;
  title: string;
  /** Poids signé de l'ancre (cf. anchors.ts). */
  weight: number;
  mediaType: "movie" | "tv";
  /** Vu, noté ou aimé — pas seulement dans Ma liste : seul un titre aimé
   *  peut signer « Parce que vous avez aimé… ». */
  liked?: boolean;
}

/**
 * Index inversé des ancres d'un compte : facette → ancres qui la portent.
 * La similarité d'un candidat à CHAQUE ancre (cosinus TF-IDF) se calcule en
 * ne parcourant que les ancres qui partagent au moins une facette avec lui.
 */
export class TasteIndex {
  readonly anchors: IndexedAnchor[] = [];
  private readonly postings = new Map<string, Array<{ anchor: number; value: number }>>();

  constructor(private readonly idfFor: (key: string) => number) {}

  get size(): number {
    return this.anchors.length;
  }

  add(anchor: IndexedAnchor, facets: readonly FacetEntry[]): void {
    const vec = normalizedVector(facets, this.idfFor);
    if (vec.size === 0) return;
    const index = this.anchors.length;
    this.anchors.push(anchor);
    for (const [key, value] of vec) {
      let list = this.postings.get(key);
      if (!list) {
        list = [];
        this.postings.set(key, list);
      }
      list.push({ anchor: index, value });
    }
  }

  /** Cosinus candidat ↔ ancre, pour les ancres qui partagent une facette. */
  similarities(facets: readonly FacetEntry[]): Map<number, number> {
    const vec = normalizedVector(facets, this.idfFor);
    const sims = new Map<number, number>();
    for (const [key, value] of vec) {
      const list = this.postings.get(key);
      if (!list) continue;
      for (const p of list) sims.set(p.anchor, (sims.get(p.anchor) ?? 0) + value * p.value);
    }
    return sims;
  }
}
