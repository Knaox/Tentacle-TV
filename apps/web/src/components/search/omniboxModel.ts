/**
 * Ce que l'omnibox propose, dans l'ordre où le clavier le parcourt — pur, sans
 * React : une réponse du moteur (et les épisodes, arrivés à part) devient UNE
 * liste d'options, rangée en sections. Les flèches parcourent cette liste
 * d'un bout à l'autre, sections comprises : c'est ce qui rend l'omnibox
 * entièrement pilotable au clavier.
 */

import type {
  ExternalSearchItem,
  ExternalSearchResult,
  MediaItem,
  SearchFacetHit,
  SearchItemHit,
  SearchMediaItem,
  SearchPersonHit,
  SearchProvider,
  SearchResponse,
  TitleKey,
} from "@tentacle-tv/shared";

export type OmniboxSection =
  | "top" | "movies" | "series" | "collections" | "people" | "episodes" | "missing" | "external" | "facets"
  | "recent" | "resume" | "genres" | "all";

export type OmniboxTarget =
  | { type: "item"; hit: SearchItemHit }
  | { type: "person"; person: SearchPersonHit }
  | { type: "episode"; item: SearchMediaItem }
  | { type: "facet"; kind: "genre" | "studio"; facet: SearchFacetHit }
  | { type: "recent"; query: string }
  | { type: "resume"; item: MediaItem }
  | { type: "external"; item: ExternalSearchItem; provider: SearchProvider }
  | { type: "seasons"; item: SearchMediaItem; key: TitleKey; count: number }
  | { type: "all"; query: string };

/** Une série de la bibliothèque à qui il manque des saisons à demander (`titles.gaps`). */
export interface OmniboxMissing {
  item: SearchMediaItem;
  key: TitleKey;
  count: number;
}

export interface OmniboxOption {
  key: string;
  section: OmniboxSection;
  /** Sépare deux groupes d'une même section — un par plugin hors bibliothèque. */
  group?: string;
  target: OmniboxTarget;
}

function itemOptions(section: OmniboxSection, hits: readonly SearchItemHit[]): OmniboxOption[] {
  return hits.map((hit) => ({ key: `${section}:${hit.item.Id}`, section, target: { type: "item", hit } }));
}

/** Les options d'une réponse, dans l'ordre de l'écran — la dernière mène à tous les résultats. */
export function resultOptions(
  response: SearchResponse | undefined,
  episodes: readonly SearchMediaItem[],
  query: string,
  external: readonly ExternalSearchResult[] = [],
  missing: readonly OmniboxMissing[] = [],
): OmniboxOption[] {
  const out: OmniboxOption[] = [];
  const top = response?.top ?? null;
  if (top?.kind === "item") out.push({ key: `top:${top.hit.item.Id}`, section: "top", target: { type: "item", hit: top.hit } });
  if (top?.kind === "person") out.push({ key: `top:${top.hit.id}`, section: "top", target: { type: "person", person: top.hit } });
  if (response !== undefined) {
    out.push(...itemOptions("movies", response.movies));
    out.push(...itemOptions("series", response.series));
    out.push(...itemOptions("collections", response.collections));
    for (const person of response.people) {
      out.push({ key: `people:${person.id}`, section: "people", target: { type: "person", person } });
    }
  }
  for (const item of episodes) out.push({ key: `episodes:${item.Id}`, section: "episodes", target: { type: "episode", item } });
  // À demander : les saisons qui manquent aux séries trouvées, puis ce que la
  // bibliothèque n'a pas du tout — après tout ce qui se lit ici, jamais devant.
  for (const { item, key, count } of missing) {
    out.push({ key: `missing:${item.Id}`, section: "missing", target: { type: "seasons", item, key, count } });
  }
  for (const result of external) {
    const group = `external:${result.provider.pluginId}`;
    for (const item of result.items) {
      out.push({ key: `${group}:${item.id}`, section: "external", group, target: { type: "external", item, provider: result.provider } });
    }
  }
  for (const facet of response?.genres ?? []) {
    out.push({ key: `genre:${facet.name}`, section: "facets", target: { type: "facet", kind: "genre", facet } });
  }
  for (const facet of response?.studios ?? []) {
    out.push({ key: `studio:${facet.name}`, section: "facets", target: { type: "facet", kind: "studio", facet } });
  }
  const trimmed = query.trim();
  if (trimmed !== "") out.push({ key: "all", section: "all", target: { type: "all", query: trimmed } });
  return out;
}

/** La barre vide : recherches récentes, reprises, genres à parcourir. */
export function zeroOptions(
  recents: readonly string[],
  resume: readonly MediaItem[],
  genres: readonly SearchFacetHit[],
): OmniboxOption[] {
  return [
    ...recents.map((query): OmniboxOption => ({ key: `recent:${query}`, section: "recent", target: { type: "recent", query } })),
    ...resume.map((item): OmniboxOption => ({ key: `resume:${item.Id}`, section: "resume", target: { type: "resume", item } })),
    ...genres.map((facet): OmniboxOption => ({
      key: `genre:${facet.name}`, section: "genres", target: { type: "facet", kind: "genre", facet },
    })),
  ];
}

/**
 * Où mène une option ; `null` pour une recherche récente, qui se rejoue dans la
 * barre, et pour des saisons à demander, qui ouvrent leur feuille.
 */
export function optionPath(target: OmniboxTarget): string | null {
  switch (target.type) {
    case "item":
      return `/media/${target.hit.item.Id}`;
    case "episode":
    case "resume":
      return `/media/${target.item.Id}`;
    case "person":
      return `/search?person=${encodeURIComponent(target.person.id)}&name=${encodeURIComponent(target.person.name)}`;
    case "facet":
      return `/search?${target.kind}=${encodeURIComponent(target.facet.name)}`;
    case "all":
      return `/search?q=${encodeURIComponent(target.query)}`;
    case "external":
      return target.item.href;
    case "recent":
    case "seasons":
      return null;
  }
}

/** Les options regroupées par section, dans l'ordre — pour les en-têtes. */
export function groupBySection(options: readonly OmniboxOption[]): Array<{ section: OmniboxSection; key: string; options: OmniboxOption[] }> {
  const groups: Array<{ section: OmniboxSection; key: string; options: OmniboxOption[] }> = [];
  for (const option of options) {
    const key = option.group ?? option.section;
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) last.options.push(option);
    else groups.push({ section: option.section, key, options: [option] });
  }
  return groups;
}

/** L'indice suivant au clavier, en boucle — `-1` quand il n'y a rien. */
export function stepIndex(current: number, delta: 1 | -1, length: number): number {
  if (length === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : length - 1;
  return (current + delta + length) % length;
}
