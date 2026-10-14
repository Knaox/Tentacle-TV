import { isRelayedPlayback, trailerScopeKey, type TrailerEntry } from "../trailers";
import type { CatalogRow } from "./catalogExtras";
import type { RelayedTrailerEntry } from "./trailerTarget";

/** Ce que le plan lit d'une saison (une entrée de `useSeasons`). */
export interface FicheSeason {
  Id: string;
  Name?: string;
  IndexNumber?: number;
  LocalTrailerCount?: number;
  SpecialFeatureCount?: number;
  RemoteTrailers?: ReadonlyArray<{ Url?: string }>;
}

export interface FicheExtrasPlan<S extends FicheSeason> {
  /** Les saisons dont les extras LOCAUX entrent dans le carrousel (après le titre lui-même). */
  seasons: S[];
  /** La série entre-t-elle aussi (ses extras locaux, ses vidéos d'avant) ? */
  withSeries: boolean;
  /** Le carrousel ne montre que la saison de l'épisode : son nom en titre. */
  seasonOnly: S | null;
  /** Les vidéos du catalogue du carrousel (lecteur complet), dans l'ordre du serveur ; `null` sans catalogue. */
  catalog: CatalogRow | null;
}

/** La saison a-t-elle des extras SÛRS : comptés par Jellyfin, ou au catalogue. */
function seasonOwns<S extends FicheSeason>(season: S, entries: readonly RelayedTrailerEntry[]): boolean {
  const key = typeof season.IndexNumber === "number" ? `s${season.IndexNumber}` : null;
  return (season.LocalTrailerCount ?? 0) > 0
    || (season.SpecialFeatureCount ?? 0) > 0
    || (season.RemoteTrailers?.length ?? 0) > 0
    || (key !== null && entries.some((entry) => trailerScopeKey(entry.scope) === key));
}

/** Une saison qui en a peut-être (compteurs absents compris : `seasonHasExtras`). */
function seasonMayOwn(season: FicheSeason): boolean {
  return season.SpecialFeatureCount === undefined || seasonOwns(season, []);
}

/**
 * UN carrousel « Extras » par fiche (décision de Damien, 14/10) — jamais une
 * rangée par saison empilée :
 * - film : ses extras ;
 * - série : les siens et ceux de TOUTES ses saisons, réunis ;
 * - épisode : ceux de SA saison s'il y en a, sinon tous les autres (la série,
 *   les autres saisons).
 * `entries` : le catalogue de la fiche (vide sans lui), `language` : celle du serveur.
 */
export function ficheExtrasPlan<S extends FicheSeason>(input: {
  type: string | undefined;
  /** Le numéro de saison d'un épisode (`ParentIndexNumber`). */
  seasonNumber?: number | null;
  seasons: readonly S[];
  entries: readonly TrailerEntry[];
  language: string | null;
  /** Le catalogue se lit (lecteur complet) : ses vidéos remplacent celles d'avant. */
  catalog: boolean;
}): FicheExtrasPlan<S> {
  const relayed = input.catalog ? input.entries.filter((entry): entry is RelayedTrailerEntry => isRelayedPlayback(entry.playback)) : [];
  const row = (entries: readonly RelayedTrailerEntry[]): CatalogRow | null =>
    entries.length > 0 ? { entries, language: input.language } : null;
  if (input.type === "Series") {
    return { seasons: input.seasons.filter(seasonMayOwn), withSeries: false, seasonOnly: null, catalog: row(relayed) };
  }
  if (input.type !== "Episode") return { seasons: [], withSeries: false, seasonOnly: null, catalog: row(relayed) };
  const current = input.seasonNumber != null ? input.seasons.find((season) => season.IndexNumber === input.seasonNumber) : undefined;
  if (current && seasonOwns(current, relayed)) {
    const key = `s${current.IndexNumber}`;
    return { seasons: [current], withSeries: false, seasonOnly: current, catalog: row(relayed.filter((entry) => trailerScopeKey(entry.scope) === key)) };
  }
  const others = input.seasons.filter((season) => season !== current && seasonMayOwn(season));
  return { seasons: others, withSeries: true, seasonOnly: null, catalog: row(relayed) };
}
