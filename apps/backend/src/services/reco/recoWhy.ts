import type { PoolEntry } from "./generationJob";
import type { RecoWhy } from "./recoPageTypes";

/**
 * Le POURQUOI d'un titre, tiré du score : des faits (le client les met en
 * mots, FR/EN), jamais une phrase. Ce que le moteur ne sait pas dire de façon
 * fiable ne se dit pas : un thème n'est cité que s'il est le premier
 * contributeur, une pépite qu'avec ses vrais chiffres.
 */
const WHY_MAX = 3;
const HIDDEN_GEM_RATING = 7.8;
const HIDDEN_GEM_VOTES = { min: 100, max: 1500 };
const ACCLAIMED_RATING = 8.2;

function idOf(key: string): number {
  return Number(key.slice(key.indexOf(":") + 1));
}

export function whyOf(
  entry: PoolEntry,
  labels: Readonly<Record<string, string>>,
  exploration = false,
  lovedPeople: ReadonlyArray<{ key: string; id: number; name: string; role: "actor" | "director" | "creator" }> = []
): RecoWhy[] {
  const { candidate, breakdown } = entry;
  const out: RecoWhy[] = [];
  if (exploration) out.push({ kind: "exploration" });
  // Une personne qu'il ADORE au générique : la raison la plus parlante, rôle compris.
  const facetKeys = new Set(candidate.facets.map((f) => f.key));
  const person = lovedPeople.find((p) => facetKeys.has(p.key));
  const loved = (breakdown.topAnchors ?? []).filter((a) => a.liked !== false && a.title.trim());
  if (loved.length) {
    out.push({
      kind: "similarTo",
      titles: loved.slice(0, 2).map((a) => ({ key: a.key, title: a.title })),
      signal: loved[0].loved ? "loved" : "watched",
    });
  }
  const via = loved[0] ? { key: loved[0].key, title: loved[0].title } : undefined;
  if (person) out.push({ kind: "person", person: { id: person.id, name: person.name }, role: person.role });
  const top = person ? undefined : breakdown.topContributors.find((c) => c.contribution > 0 && labels[c.key]);
  if (top) {
    const name = labels[top.key];
    if (top.key.startsWith("director:")) {
      out.push({ kind: "person", person: { id: idOf(top.key), name }, role: candidate.mediaType === "movie" ? "director" : "creator", ...(via ? { via } : {}) });
    } else if (top.key.startsWith("actor:")) {
      out.push({ kind: "person", person: { id: idOf(top.key), name }, role: "actor", ...(via ? { via } : {}) });
    } else if (top.key.startsWith("kw:")) {
      out.push({ kind: "theme", theme: { key: top.key, label: name }, ...(via ? { via } : {}) });
    } else if (top.key.startsWith("studio:") || top.key.startsWith("network:")) {
      out.push({ kind: "company", company: { id: idOf(top.key), name, kind: top.key.startsWith("network:") ? "network" : "studio" }, ...(via ? { via } : {}) });
    }
  }
  const rating = candidate.voteAverage ?? 0;
  const votes = candidate.voteCount ?? 0;
  if (rating >= HIDDEN_GEM_RATING && votes >= HIDDEN_GEM_VOTES.min && votes < HIDDEN_GEM_VOTES.max) {
    out.push({ kind: "hiddenGem", rating: Math.round(rating * 10) / 10, votes });
  } else if (rating >= ACCLAIMED_RATING && votes >= HIDDEN_GEM_VOTES.max) {
    out.push({ kind: "acclaimed", rating: Math.round(rating * 10) / 10, votes });
  }
  return out.slice(0, WHY_MAX);
}

/**
 * La correspondance (0..100) : portée par l'entrée du pool, monotone avec son
 * rang (95 en tête, 50 en queue — cf. poolCompute). Un vieux pool n'en a pas.
 */
export function matchOf(entry: PoolEntry): number | undefined {
  return entry.match;
}
