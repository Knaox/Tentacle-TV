import type { Anchor } from "./anchors";
import type { Candidate } from "./scoring/strategy";

/**
 * L'aversion par l'exposition, au grain des THÈMES (mots-clés TMDB) : un thème
 * que la bibliothèque offre en masse — l'isekai, la réincarnation, l'académie
 * de magie d'une saison d'animés — mais que le compte ne regarde presque
 * jamais est un remplissage pour lui. Même règle que les univers (aversion.ts),
 * restreinte aux thèmes DENSES : un mot-clé rare ne dit rien.
 */
export type ThemeAversion = ReadonlyMap<string, number>;

/** Titres de la bibliothèque qui doivent porter un thème pour qu'il compte. */
const DENSE_MIN_TITLES = 12;
const SMOOTHING = 0.02;
const FULL_CONFIDENCE_ANCHORS = 12;
/** Au-dessus, le compte regarde ce thème : aucune aversion. */
const LIFT_NEUTRAL = 1;

/** Pur : la pénalité des thèmes denses (clé « kw:… » → 0..1). */
export function themeAversion(
  anchors: readonly Anchor[],
  facetsOf: (anchor: Anchor) => readonly { key: string }[] | null,
  candidates: readonly Candidate[]
): Map<string, number> {
  const library = candidates.filter((c) => !!c.jellyfinItemId);
  const offered = new Map<string, number>();
  for (const c of library) {
    for (const f of new Set(c.facets.map((x) => x.key))) if (f.startsWith("kw:")) offered.set(f, (offered.get(f) ?? 0) + 1);
  }
  const watched = new Map<string, number>();
  let consumed = 0;
  for (const a of anchors) {
    if (!a.consumption || a.weight <= 0) continue;
    consumed++;
    for (const f of new Set((facetsOf(a) ?? []).map((x) => x.key))) if (f.startsWith("kw:")) watched.set(f, (watched.get(f) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  if (library.length === 0 || consumed === 0) return out;
  const confidence = Math.min(1, consumed / FULL_CONFIDENCE_ANCHORS);
  for (const [key, n] of offered) {
    if (n < DENSE_MIN_TITLES) continue;
    const lift = ((watched.get(key) ?? 0) / consumed + SMOOTHING) / (n / library.length + SMOOTHING);
    if (lift >= LIFT_NEUTRAL) continue;
    out.set(key, Math.round(confidence * (1 - lift) * 1000) / 1000);
  }
  return out;
}

/** La pénalité d'un titre : la moyenne de ses deux thèmes denses les plus évités (un seul thème ne suffit pas à condamner). */
export function themeAversionOf(facetKeys: Iterable<string>, aversion: ThemeAversion | undefined): number {
  if (!aversion || aversion.size === 0) return 0;
  const hits = [...new Set(facetKeys)].map((k) => aversion.get(k) ?? 0).filter((v) => v > 0).sort((a, b) => b - a);
  if (hits.length < 2) return 0;
  return (hits[0] + hits[1]) / 2;
}
