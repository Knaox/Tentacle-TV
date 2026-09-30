import type { TFunction } from "i18next";
import {
  completionFor,
  i18n,
  initials,
  inlineCompletion,
  matchReason,
  personMeta,
  suggestionsFrom,
  type MediaItem,
  type SearchDiscoverResponse,
  type SearchItemHit,
  type SearchMediaItem,
  type SearchPersonHit,
  type SearchResponse,
  type SearchTopHit,
} from "@tentacle-tv/shared";
import { tvSearchNotice, tvSearchSections } from "@tentacle-tv/tv-core";
import { EMPTY_MARKERS, type CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import type {
  SearchDiscoverModel,
  SearchInputLabels,
  SearchNoticeModel,
  SearchPersonModel,
  SearchSectionModel,
  SearchSuggestionModel,
  SearchTopModel,
} from "../../../src/redesign/screens/search/searchViewModel";
import type { BenchData } from "./benchData";
import { cardOf, episodeLabel, paletteOf, progressOf, yearOf } from "./models";
import { metaOf } from "./screenModels";

/**
 * Les props de la vue « Recherche », tirées d'une réponse du moteur avec les
 * MÊMES fonctions que l'app : `tvSearchSections` / `tvSearchNotice`
 * (tv-core), `suggestionsFrom` / `completionFor` / `matchReason` /
 * `personMeta` (shared), `resolveCardMarkers` (par `cardOf`).
 */

const t = ((key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string) as unknown as TFunction;
const tr = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** L'élément complet de l'instantané (images, empreintes), sinon celui du moteur. */
const full = (data: BenchData, item: SearchMediaItem): MediaItem =>
  data.item(item.Id) ?? (item as unknown as MediaItem);

export function inputLabels(): SearchInputLabels {
  return {
    placeholder: tr("search:launcher"),
    dictationHint: tr("search:tvDictationHint"),
    suggestions: tr("search:suggestions"),
    space: tr("common:space"),
    delete: tr("search:tvBackspace"),
    clear: tr("search:clear"),
    mic: tr("common:voiceOrType"),
  };
}

/** Comme l'écran : la complétion du meilleur résultat, puis les requêtes du
 *  moteur — cinq au plus (`SearchScreen`). */
export function suggestionsOf(query: string, response: SearchResponse | undefined): {
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
  return { completion, suggestions: list.slice(0, 5) };
}

/** La lumière d'une personne : celle du premier titre qui répond avec elle. */
function personPalette(data: BenchData, response: SearchResponse | undefined, personId: string): ArtworkPalette | undefined {
  const first = response?.movies[0] ?? response?.series[0];
  const credit = first ? full(data, first.item) : data.items(data.snapshot.credits[personId])[0];
  return credit ? paletteOf(data, credit) : undefined;
}

function topOf(data: BenchData, top: SearchTopHit, response: SearchResponse | undefined): SearchTopModel {
  if (top.kind === "person") {
    return {
      kind: "person",
      id: top.hit.id,
      name: top.hit.name,
      imageUri: data.image(top.hit.id, "Primary"),
      initials: initials(top.hit.name),
      detail: personMeta(t, top.hit),
      action: tr("search:filmography"),
      palette: personPalette(data, response, top.hit.id),
    };
  }
  const item = full(data, top.hit.item);
  return {
    kind: "title",
    id: item.Id,
    title: item.Name ?? "",
    logoUri: data.image(item.Id, "Logo"),
    backdropUri: data.image(item.Id, "Backdrop"),
    // Un seul genre : la ligne tient sur une ligne, à côté du logo.
    meta: [tr(`search:type_${top.hit.item.Type}`), ...metaOf(item, { quality: false, genres: 1 })],
    reason: matchReason(t, top.hit.match) ?? undefined,
    progress: progressOf(item),
    palette: paletteOf(data, item),
  };
}

function titleCard(data: BenchData, hit: SearchItemHit): CardModel {
  const item = full(data, hit.item);
  if (hit.item.Type === "BoxSet") {
    // L'instantané n'a aucune collection : celle-ci est une copie d'un titre
    // (son affiche, son propre nom), dite « exemple » sous la carte.
    const example = item.Type !== "BoxSet";
    const count = tr("search:titles", { count: hit.item.ChildCount ?? 0 });
    return {
      ...cardOf(data, item),
      id: `${hit.item.Id}:collection`,
      title: hit.item.Name,
      subtitle: example ? `${count} (exemple)` : count,
      markers: EMPTY_MARKERS,
      progress: undefined,
    };
  }
  return cardOf(data, item, matchReason(t, hit.match) ?? yearOf(item));
}

const personOf = (data: BenchData, person: SearchPersonHit): SearchPersonModel => ({
  id: person.id,
  name: person.name,
  imageUri: data.image(person.id, "Primary"),
  initials: initials(person.name),
  detail: personMeta(t, person),
});

export function sectionsOf(data: BenchData, response: SearchResponse | undefined, episodes: SearchMediaItem[] = []): SearchSectionModel[] {
  return tvSearchSections(response, episodes).map((section): SearchSectionModel => {
    switch (section.key) {
      case "top":
        return { key: "top", label: tr("search:topResult"), top: topOf(data, section.top, response) };
      case "people":
        return { key: "people", title: tr("search:people"), people: section.people.map((p) => personOf(data, p)) };
      case "episodes":
        return {
          key: "episodes",
          title: tr("search:episodes"),
          cards: section.episodes.map((ep) => cardOf(data, full(data, ep), episodeLabel(full(data, ep), true))),
        };
      case "facets":
        return {
          key: "facets",
          title: tr("search:facets"),
          facets: section.facets.map((f) => ({
            kind: f.kind,
            name: f.name,
            detail: `${tr(`search:${f.kind}`)} · ${tr("search:countTitles", { count: f.count })}`,
          })),
        };
      default:
        return {
          key: section.key,
          title: tr(`search:${section.key}`),
          count: tr("search:countTitles", { count: section.total }),
          cards: section.hits.map((hit) => titleCard(data, hit)),
        };
    }
  });
}

export function noticeOf(response: SearchResponse | undefined): SearchNoticeModel | null {
  const notice = tvSearchNotice(response);
  if (!notice) return null;
  if (notice.kind === "correction") return { kind: "correction", lead: tr("search:resultsFor"), correction: notice.correction };
  return { kind: notice.kind, text: tr(notice.kind === "partial" ? "search:partial" : "search:indexing") };
}

/**
 * Les recherches récentes vivent sur l'appareil (`readRecentSearches`) :
 * l'instantané ne les a pas. On en tire d'exemple de ce que le compte a
 * vraiment cherché et regardé : la requête capturée, des séries en cours,
 * une personne de l'instantané.
 */
function recentsOf(data: BenchData): string[] {
  const captured = (data.snapshot.extras?.search as { query?: string } | undefined)?.query;
  const series = data.list("nextUp").map((ep) => ep.SeriesName ?? "").filter(Boolean);
  const person = data.list("people")[0]?.Name;
  return [...new Set([captured, ...series.slice(0, 3), person].filter((q): q is string => !!q))].slice(0, 5);
}

export function discoverOf(data: BenchData, mode: "idle" | "empty", query = ""): SearchDiscoverModel {
  const discover = data.snapshot.extras?.searchDiscover as SearchDiscoverResponse | undefined;
  return {
    title: mode === "idle" ? tr("search:emptyTitle") : tr("search:noResults", { query }),
    hint: mode === "idle" ? tr("search:emptyHint") : tr("search:noResultsHint"),
    recentsTitle: tr("search:recent"),
    recents: recentsOf(data),
    genresTitle: tr("search:browseGenres"),
    genres: (discover?.genres ?? []).map((genre) => ({ name: genre.name, detail: String(genre.count) })),
  };
}

/** La lumière de la page : celle du meilleur résultat, sinon neutre. */
export function paletteOfResponse(data: BenchData, response: SearchResponse | undefined): ArtworkPalette {
  const top = response?.top;
  if (top?.kind === "item") return paletteOf(data, full(data, top.hit.item));
  if (top?.kind === "person") return personPalette(data, response, top.hit.id) ?? NEUTRAL_PALETTE;
  return NEUTRAL_PALETTE;
}
