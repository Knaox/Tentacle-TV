import {
  completionFor,
  formatEpisodeCode,
  initials,
  inlineCompletion,
  matchReason,
  personMeta,
  suggestionsFrom,
  type MediaItem,
  type SearchItemHit,
  type SearchMediaItem,
  type SearchPersonHit,
  type SearchResponse,
  type SearchTopHit,
} from "@tentacle-tv/shared";
import { tvSearchNotice, tvSearchSections } from "@tentacle-tv/tv-core";
import type { TFunction } from "i18next";
import { EMPTY_MARKERS, type CardModel } from "../../redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../redesign/color/artworkPalette";
import type { MetaItem } from "../../redesign/hero/MetaLine";
import type {
  SearchDiscoverModel,
  SearchInputLabels,
  SearchNoticeModel,
  SearchPersonModel,
  SearchSectionModel,
  SearchSuggestionModel,
  SearchTopModel,
} from "../../redesign/screens/search/searchViewModel";

/**
 * Les props de la vue « Recherche », tirées d'une réponse du moteur
 * (`/api/search`) avec les fonctions communes aux téléviseurs :
 * `tvSearchSections` / `tvSearchNotice` (tv-core), `suggestionsFrom` /
 * `completionFor` / `matchReason` / `personMeta` (shared). Pur : ce qui
 * dépend de l'app — cartes, lumière, images — arrive par `SearchModelSources`
 * (l'écran les tire du socle et du client Jellyfin, le banc de son instantané).
 */

/** Cinq suggestions au plus : au D-pad, chaque ligne coûte un appui. */
const MAX_SUGGESTIONS = 5;

export interface SearchModelSources {
  t: TFunction;
  /** Le titre complet quand on l'a ; sinon le résultat du moteur, qui en est un sous-ensemble. */
  full: (item: SearchMediaItem) => MediaItem;
  /** La carte d'un titre : images, marqueurs, lumière — et sa légende. */
  card: (item: MediaItem, subtitle?: string) => CardModel;
  palette: (item: MediaItem) => ArtworkPalette;
  /** La ligne d'identité du meilleur résultat : année, durée, genre, note. */
  meta: (item: MediaItem) => MetaItem[];
  backdrop: (item: MediaItem) => string | undefined;
  logo: (item: MediaItem) => string | undefined;
  portrait: (person: { id: string; imageTag: string | null }) => string | undefined;
  /** Un titre de la personne, quand la réponse n'en porte aucun (la lumière de son portrait). */
  creditOf?: (personId: string) => MediaItem | undefined;
}

export function searchInputLabels(t: TFunction): SearchInputLabels {
  return {
    placeholder: t("search:launcher"),
    dictationHint: t("search:tvDictationHint"),
    suggestions: t("search:suggestions"),
    space: t("common:space"),
    delete: t("search:tvBackspace"),
    clear: t("search:clear"),
    mic: t("common:voiceOrType"),
  };
}

/** La complétion suit la saisie brute ; les suggestions, la réponse du moteur :
 *  d'abord le titre que la saisie commence, puis les requêtes proposées. */
export function searchSuggestions(query: string, response: SearchResponse | undefined): {
  completion: string | null;
  suggestions: SearchSuggestionModel[];
} {
  if (!query.trim()) return { completion: null, suggestions: [] };
  const model = suggestionsFrom(query, response, { correction: false });
  const completion = completionFor(query, model);
  const list: SearchSuggestionModel[] = [];
  if (completion) {
    const names = model.lead !== null ? [model.lead] : [...model.best.map((h) => h.item.Name), ...model.people.map((p) => p.name)];
    const whole = names.find((name) => inlineCompletion(query, name) !== null);
    if (whole) list.push({ query: whole, kind: "complete" });
  }
  for (const q of model.queries) list.push({ query: q, kind: "query" });
  return { completion, suggestions: list.slice(0, MAX_SUGGESTIONS) };
}

/** 0 à 1 : une lecture entamée. Le moteur donne la position, pas le pourcentage. */
function progressOf(item: MediaItem): number | undefined {
  const data = item.UserData;
  if (!data || data.Played) return undefined;
  const ticks = data.PlaybackPositionTicks ?? 0;
  const pct = data.PlayedPercentage ?? (item.RunTimeTicks ? (ticks / item.RunTimeTicks) * 100 : 0);
  return pct > 0 ? Math.min(1, pct / 100) : undefined;
}

/** La lumière d'une personne : celle du premier titre qui répond avec elle. */
function personPalette(src: SearchModelSources, response: SearchResponse | undefined, personId: string): ArtworkPalette | undefined {
  const first = response?.movies[0] ?? response?.series[0];
  const credit = first ? src.full(first.item) : src.creditOf?.(personId);
  return credit ? src.palette(credit) : undefined;
}

function topOf(src: SearchModelSources, top: SearchTopHit, response: SearchResponse | undefined): SearchTopModel {
  const { t } = src;
  if (top.kind === "person") {
    return {
      kind: "person",
      id: top.hit.id,
      name: top.hit.name,
      imageUri: src.portrait(top.hit),
      initials: initials(top.hit.name),
      detail: personMeta(t, top.hit),
      action: t("search:filmography"),
      palette: personPalette(src, response, top.hit.id),
    };
  }
  const item = src.full(top.hit.item);
  return {
    kind: "title",
    id: item.Id,
    title: item.Name ?? "",
    logoUri: src.logo(item),
    backdropUri: src.backdrop(item),
    meta: [t(`search:type_${top.hit.item.Type}`), ...src.meta(item)],
    reason: matchReason(t, top.hit.match) ?? undefined,
    progress: progressOf(item),
    palette: src.palette(item),
  };
}

function titleCard(src: SearchModelSources, hit: SearchItemHit): CardModel {
  const item = src.full(hit.item);
  if (hit.item.Type === "BoxSet") {
    // Une collection : ni état de lecture ni marqueurs, le nombre de ses titres.
    return {
      ...src.card(item),
      id: hit.item.Id,
      title: hit.item.Name,
      subtitle: src.t("search:titles", { count: hit.item.ChildCount ?? 0 }),
      markers: EMPTY_MARKERS,
      progress: undefined,
    };
  }
  const year = item.ProductionYear ? String(item.ProductionYear) : undefined;
  return src.card(item, matchReason(src.t, hit.match) ?? year);
}

const personOf = (src: SearchModelSources, person: SearchPersonHit): SearchPersonModel => ({
  id: person.id,
  name: person.name,
  imageUri: src.portrait(person),
  initials: initials(person.name),
  detail: personMeta(src.t, person),
});

/** « S1E2 · Le nom de l'épisode ». */
function episodeLabel(item: MediaItem): string {
  const code = formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber);
  return item.Name ? `${code} · ${item.Name}` : code;
}

/** Les rangées, dans l'ordre commun aux téléviseurs (`tvSearchSections`). */
export function searchSections(src: SearchModelSources, response: SearchResponse | undefined, episodes: SearchMediaItem[] = []): SearchSectionModel[] {
  const { t } = src;
  return tvSearchSections(response, episodes).map((section): SearchSectionModel => {
    switch (section.key) {
      case "top":
        return { key: "top", label: t("search:topResult"), top: topOf(src, section.top, response) };
      case "people":
        return { key: "people", title: t("search:people"), people: section.people.map((p) => personOf(src, p)) };
      case "episodes":
        return {
          key: "episodes",
          title: t("search:episodes"),
          cards: section.episodes.map((episode) => {
            const item = src.full(episode);
            return src.card(item, episodeLabel(item));
          }),
        };
      case "facets":
        return {
          key: "facets",
          title: t("search:facets"),
          facets: section.facets.map((f) => ({
            kind: f.kind,
            name: f.name,
            detail: `${t(`search:${f.kind}`)} · ${t("search:countTitles", { count: f.count })}`,
          })),
        };
      default:
        return {
          key: section.key,
          title: t(`search:${section.key}`),
          count: t("search:countTitles", { count: section.total }),
          cards: section.hits.map((hit) => titleCard(src, hit)),
        };
    }
  });
}

export function searchNotice(t: TFunction, response: SearchResponse | undefined): SearchNoticeModel | null {
  const notice = tvSearchNotice(response);
  if (!notice) return null;
  if (notice.kind === "correction") return { kind: "correction", lead: t("search:resultsFor"), correction: notice.correction };
  return { kind: notice.kind, text: t(notice.kind === "partial" ? "search:partial" : "search:indexing") };
}

/** Sans résultats à montrer — rien de tapé, ou rien de trouvé : ce que le
 *  moteur comprend, les recherches récentes, les genres à parcourir. */
export function searchDiscover(
  t: TFunction,
  mode: "idle" | "empty",
  query: string,
  recents: string[],
  genres: ReadonlyArray<{ name: string; count: number }>,
): SearchDiscoverModel {
  return {
    title: mode === "idle" ? t("search:emptyTitle") : t("search:noResults", { query }),
    hint: mode === "idle" ? t("search:emptyHint") : t("search:noResultsHint"),
    recentsTitle: t("search:recent"),
    recents,
    genresTitle: t("search:browseGenres"),
    genres: genres.map((genre) => ({ name: genre.name, detail: String(genre.count) })),
  };
}

/** La lumière de la page : celle du meilleur résultat, sinon neutre. */
export function searchPalette(src: SearchModelSources, response: SearchResponse | undefined): ArtworkPalette {
  const top = response?.top;
  if (top?.kind === "item") return src.palette(src.full(top.hit.item));
  if (top?.kind === "person") return personPalette(src, response, top.hit.id) ?? NEUTRAL_PALETTE;
  return NEUTRAL_PALETTE;
}
