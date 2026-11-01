import type { PoolEntry } from "./generationJob";

/**
 * Les PLAFONDS des rangées personnelles (« Pour vous », « Films pour vous »,
 * « Animés », « Dans la bibliothèque », « À découvrir ») : une rangée ne se
 * remplit pas d'un réalisateur, d'un acteur ou d'une saga — huit films d'un
 * même auteur, c'est une rangée « De {personne} », qui a sa logique propre —
 * ni des voisins d'une seule ancre « carrefour ». Purs.
 */

/** Titres au plus par réalisateur ou créateur, par acteur, par saga. */
export const ROW_FACET_MAX = 2;
/** Part d'une rangée qu'une même ancre (le titre aimé cité en raison) peut justifier. */
export const ROW_ANCHOR_MAX_SHARE = 1 / 3;

/** Les facettes plafonnées d'un titre : ses auteurs, ses acteurs mis en avant, sa saga. */
function cappedFacets(entry: PoolEntry): string[] {
  return entry.candidate.facets
    .map((f) => f.key)
    .filter((k) => k.startsWith("director:") || k.startsWith("actor:") || k.startsWith("collection:"));
}

/** L'ancre qui justifie le titre : le premier titre aimé de sa raison (cf. toItem). */
export function reasonAnchorOf(entry: PoolEntry): string | null {
  return entry.breakdown.topAnchors?.find((a) => a.liked !== false && a.title.trim())?.key ?? null;
}

/** Ancres au plus par rangée de `size` titres — deux au moins, une rangée courte reste possible. */
export function anchorMaxFor(size: number): number {
  return Math.max(ROW_FACET_MAX, Math.floor(size * ROW_ANCHOR_MAX_SHARE));
}

class FacetCounter {
  private readonly counts = new Map<string, number>();
  fits(keys: readonly string[], max: number): boolean {
    return keys.every((k) => (this.counts.get(k) ?? 0) < max);
  }
  add(keys: readonly string[]): void {
    for (const k of keys) this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }
}

/**
 * Le classement réduit à ce qu'une rangée de `size` titres peut contenir, dans
 * l'ordre : un titre dont un auteur, un acteur ou la saga a déjà ses deux
 * places sort ; un titre dont l'ancre a déjà son tiers aussi. Comme la
 * sélection ne fait que choisir PARMI ces titres, la rangée tient ses plafonds.
 */
export function capRowDiversity(entries: readonly PoolEntry[], size: number): PoolEntry[] {
  const facets = new FacetCounter();
  const anchors = new FacetCounter();
  const anchorMax = anchorMaxFor(size);
  const kept: PoolEntry[] = [];
  for (const entry of entries) {
    const keys = cappedFacets(entry);
    const anchor = reasonAnchorOf(entry);
    const anchorKeys = anchor ? [anchor] : [];
    if (!facets.fits(keys, ROW_FACET_MAX) || !anchors.fits(anchorKeys, anchorMax)) continue;
    facets.add(keys);
    anchors.add(anchorKeys);
    kept.push(entry);
  }
  return kept;
}

/**
 * Une rangée plafonnée : `select` choisit `size` titres parmi le classement
 * plafonné (éventuellement rétréci par `narrow`, le tirage du jour). Si le
 * plafond d'ancre l'a laissée courte (profil maigre : deux ancres portent
 * tout), le complément vient du reste du classement — auteurs, acteurs et
 * sagas toujours plafonnés, l'ancre non : une rangée pleine vaut mieux qu'un trou.
 */
export function pickCapped(
  entries: readonly PoolEntry[],
  size: number,
  select: (list: PoolEntry[], count: number) => PoolEntry[],
  narrow: (list: PoolEntry[]) => PoolEntry[] = (list) => list
): PoolEntry[] {
  const picked = select(narrow(capRowDiversity(entries, size)), size);
  if (picked.length >= size) return picked;
  const taken = new Set(picked.map((e) => e.candidate.key));
  const facets = new FacetCounter();
  for (const e of picked) facets.add(cappedFacets(e));
  const out = [...picked];
  for (const entry of entries) {
    if (out.length >= size) break;
    const keys = cappedFacets(entry);
    if (taken.has(entry.candidate.key) || !facets.fits(keys, ROW_FACET_MAX)) continue;
    facets.add(keys);
    out.push(entry);
  }
  return out;
}
