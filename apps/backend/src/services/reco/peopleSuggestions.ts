import type { TitleMeta } from "../tmdb/metaCache";
import type { Anchor } from "./anchors";

/**
 * Les SUGGESTIONS de personnes (« Vos acteurs ») : d'abord les acteurs qui
 * reviennent dans ce que le compte a regardé — chez qui a vu trois films d'un même
 * acteur, cet acteur — puis, pour compléter, les personnalités
 * populaires de TMDB. Jamais une personne ou une filmographie pour adultes :
 * `/person/popular` en liste, et une suggestion d'acteur ne doit pas en être.
 */
export interface RawPerson {
  id: number;
  name?: string;
  adult?: boolean;
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: Array<{ title?: string; name?: string; adult?: boolean }>;
}

export interface PersonSuggestion {
  personId: number;
  name: string;
  profilePath: string | null;
  knownFor: string[];
}

/** Une personne pour adultes, ou connue pour un titre pour adultes : jamais proposée. */
export function isAdultPerson(p: Pick<RawPerson, "adult" | "known_for">): boolean {
  return p.adult === true || (p.known_for ?? []).some((k) => k.adult === true);
}

export function toSuggestion(p: RawPerson): PersonSuggestion {
  return {
    personId: p.id,
    name: p.name ?? "",
    profilePath: p.profile_path ?? null,
    knownFor: (p.known_for ?? []).map((k) => k.title ?? k.name ?? "").filter(Boolean).slice(0, 3),
  };
}

/** Titres regardés où un acteur doit revenir pour être suggéré. */
const RECURRING_MIN = 2;

/** Pur : les acteurs récurrents de l'historique, les plus présents d'abord. */
export function recurringActors(
  anchors: readonly Anchor[],
  metaOf: (a: Anchor) => TitleMeta | undefined,
  exclude: ReadonlySet<number>
): PersonSuggestion[] {
  const tally = new Map<number, { name: string; profilePath: string | null; titles: string[]; weight: number }>();
  for (const a of anchors) {
    if (!a.consumption || a.weight <= 0) continue;
    const meta = metaOf(a);
    if (!meta || meta.genres.some((g) => g.id === 16)) continue; // une voix d'animation n'est pas un visage
    for (const p of meta.topCast) {
      if (!p.name || exclude.has(p.id)) continue;
      const cur = tally.get(p.id) ?? { name: p.name, profilePath: p.profilePath ?? null, titles: [], weight: 0 };
      cur.titles.push(meta.title);
      cur.weight += a.weight;
      tally.set(p.id, cur);
    }
  }
  return [...tally.entries()]
    .filter(([, t]) => t.titles.length >= RECURRING_MIN)
    .sort((x, y) => y[1].titles.length - x[1].titles.length || y[1].weight - x[1].weight || x[0] - y[0])
    .map(([personId, t]) => ({ personId, name: t.name, profilePath: t.profilePath, knownFor: t.titles.slice(0, 3) }));
}

/** Pur : le complément populaire, sans adultes, sans portrait manquant, comédiens seulement. */
export function popularSuggestions(people: readonly RawPerson[], exclude: ReadonlySet<number>): PersonSuggestion[] {
  return people
    .filter((p) => !exclude.has(p.id) && !isAdultPerson(p) && !!p.profile_path && (p.known_for_department ?? "Acting") === "Acting")
    .map(toSuggestion);
}
