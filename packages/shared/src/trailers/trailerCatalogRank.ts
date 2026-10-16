/**
 * Les RÈGLES du catalogue des bandes-annonces — pures, les mêmes pour toutes
 * les plateformes puisque c'est le serveur qui les applique :
 *
 * 1. l'ordre des PORTÉES d'une fiche (`catalogScopes`) : la saison de
 *    l'épisode, puis les saisons d'avant (la plus proche d'abord), la série,
 *    et seulement ensuite les saisons suivantes — elles divulgâchent ;
 * 2. la VERSION d'une vidéo par rapport à la langue du serveur
 *    (`trailerVersionOf`) : dans cette langue, sous-titrée dans elle, ou non
 *    — puis, la vidéo extraite, celle de la piste qu'on entend
 *    (`playedTrailerVersion`) : un doublage par IA n'est jamais une VF ;
 * 3. le RANG (`rankCatalogEntries`) : les saisons SUIVANTES restent en
 *    dernier (elles divulgâchent) ; avant elles, d'abord tout ce qui est DANS
 *    la langue du serveur (la locale, sa langue, sous-titrée dans elle) —
 *    portée par portée —, puis seulement le reste (VO, inconnue). Une VO de
 *    la saison en cours ne passe donc jamais devant la VF de la saison
 *    d'avant (Rick et Morty S7 : la VF de S6, pas les promos anglaises de
 *    S7) ; les saisons suivantes suivent la même règle entre elles. Dans une
 *    même portée : la bande-annonce locale de Jellyfin,
 *    AlloCiné VF puis VOSTFR (un serveur français seulement), les autres
 *    sources dans la langue du serveur, puis sous-titrées, puis la langue
 *    originale ou l'anglais, et AlloCiné VO en tout dernier recours. Une
 *    bande-annonce avant un teaser.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/trailers/` (voir
 * `trailerCatalog.ts`). On le modifie ICI.
 */

import { hasSubtitleMark, trailerLangFit } from "./trailerList";
import {
  TRAILER_CATALOG_MAX_ENTRIES, trailerPlaybackKey, trailerScopeKey,
  type TrailerAudio, type TrailerEntry, type TrailerScope, type TrailerVersion,
} from "./trailerCatalog";

/** Le titre dont on ordonne les portées : un film, une série, ou une saison (celle d'un épisode, ou la saison même). */
export type CatalogTarget =
  | { kind: "movie" }
  | { kind: "series"; seasons: readonly number[] }
  | { kind: "season"; season: number; seasons: readonly number[] };

/** Les saisons numérotées (1 et plus), sans doublon, dans l'ordre : les spéciaux (0) n'ont pas de bande-annonce à eux. */
function numberedSeasons(seasons: readonly number[]): number[] {
  return [...new Set(seasons.filter((n) => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b);
}

/** La règle 1 : les portées à parcourir, dans l'ordre où leurs bandes-annonces se proposent. */
export function catalogScopes(target: CatalogTarget): TrailerScope[] {
  if (target.kind === "movie") return [{ kind: "movie" }];
  const seasons = numberedSeasons(target.seasons);
  const asScope = (season: number): TrailerScope => ({ kind: "season", season });
  // Un épisode des spéciaux, ou sans numéro de saison : la fiche vaut celle de la série.
  if (target.kind === "series" || !Number.isInteger(target.season) || target.season < 1) {
    return [{ kind: "series" }, ...seasons.map(asScope)];
  }
  const current = target.season;
  const before = seasons.filter((n) => n < current).reverse();
  const after = seasons.filter((n) => n > current);
  return [asScope(current), ...before.map(asScope), { kind: "series" }, ...after.map(asScope)];
}

/**
 * La règle 2 : la version d'une vidéo pour un serveur de langue `serverLang`
 * — la règle de la liste (`trailerLangFit` : le LIBELLÉ l'emporte sur le code
 * de langue, TMDB étiquette `fr` une VOST), traduite en version. Hors de la
 * langue du serveur : `original` si quelque chose le dit (un code, une
 * marque de sous-titres), sinon `unknown`.
 */
export function trailerVersionOf(video: { name?: string; lang?: string | null }, serverLang: string | null | undefined): TrailerVersion {
  const fit = trailerLangFit({ Url: "", Name: video.name, lang: video.lang ?? undefined }, serverLang ?? undefined);
  if (fit === "dubbed") return "localized";
  if (fit === "subtitled") return "subtitled";
  return video.lang || hasSubtitleMark(video.name) ? "original" : "unknown";
}

/**
 * La version de ce qu'on ENTEND. Le catalogue dit ce que la vidéo prétend
 * (TMDB étiquette `fr` une bande-annonce anglaise que YouTube double par IA
 * pour qui la regarde en France) ; la piste que le relais joue dit la vérité :
 * dans la langue du serveur → `localized` ; sinon `subtitled` reste (ses
 * sous-titres sont dans l'image), tout le reste est `original`. Sans piste
 * connue (une seule piste, Dailymotion) ou sans langue de serveur : la
 * version du catalogue.
 */
export function playedTrailerVersion(
  claimed: TrailerVersion, audio: TrailerAudio | null | undefined, serverLang: string | null | undefined,
): TrailerVersion {
  const server = (serverLang ?? "").split("-")[0].toLowerCase();
  if (!audio || !server) return claimed;
  if (audio.lang.split("-")[0].toLowerCase() === server) return "localized";
  return claimed === "subtitled" ? "subtitled" : "original";
}

/** La règle 3 : le palier d'une entrée dans sa portée — le plus petit d'abord. */
function tierOf(entry: TrailerEntry): number {
  if (entry.source === "local") return 0;
  if (entry.source === "allocine") {
    if (entry.version === "localized") return 1;
    if (entry.version === "subtitled") return 2;
    return entry.version === "unknown" ? 6 : 7;
  }
  if (entry.version === "localized") return 3;
  if (entry.version === "subtitled") return 4;
  return entry.version === "original" ? 5 : 6;
}

/** Les paliers de la langue du serveur (locale, sa langue, sous-titrée dans elle) : servis avant tout le reste. */
const LAST_SERVER_LANGUAGE_TIER = 4;

/**
 * La liste rendue au client : seulement les portées de la fiche ; les
 * saisons suivantes en dernier ; avant elles (et entre elles), d'abord ce qui
 * est dans la langue du serveur, portée par portée, puis le reste ; dans une portée, le palier, la bande-annonce avant le
 * teaser, et l'ordre des sources à égalité (tri stable). Une même vidéo
 * rendue par deux sources ne compte qu'une fois, à sa meilleure place.
 */
export function rankCatalogEntries(
  entries: readonly TrailerEntry[],
  scopes: readonly TrailerScope[],
  limit = TRAILER_CATALOG_MAX_ENTRIES,
): TrailerEntry[] {
  const scopeRank = new Map(scopes.map((scope, index) => [trailerScopeKey(scope), index]));
  // Une fiche de saison (ou d'épisode) : ce qui suit la série, ce sont les saisons suivantes.
  const seriesAt = scopes[0]?.kind === "season" ? scopes.findIndex((scope) => scope.kind === "series") : -1;
  const later = (scope: number) => (seriesAt >= 0 && scope > seriesAt ? 1 : 0);
  const foreign = (tier: number) => (tier > LAST_SERVER_LANGUAGE_TIER ? 1 : 0);
  const ranked = entries
    .map((entry, index) => ({ entry, index, tier: tierOf(entry), scope: scopeRank.get(trailerScopeKey(entry.scope)) }))
    .filter((row): row is { entry: TrailerEntry; index: number; tier: number; scope: number } => row.scope !== undefined)
    .sort((a, b) =>
      later(a.scope) - later(b.scope)
      || foreign(a.tier) - foreign(b.tier)
      || a.scope - b.scope
      || a.tier - b.tier
      || (a.entry.type === "trailer" ? 0 : 1) - (b.entry.type === "trailer" ? 0 : 1)
      || a.index - b.index);
  const seen = new Set<string>();
  const result: TrailerEntry[] = [];
  for (const { entry } of ranked) {
    const key = trailerPlaybackKey(entry.playback);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
    if (result.length >= limit) break;
  }
  return result;
}
