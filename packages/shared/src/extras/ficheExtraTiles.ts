import type { TFunction } from "i18next";
import type { RichTrailer } from "../trailers";
import { catalogTiles, type CatalogRow } from "./catalogExtras";
import { buildExtraEntries, type LocalExtraSource } from "./extraEntries";
import { scopeName, withSeasonNames } from "./extrasSeasonNames";
import type { TrailerTarget } from "./trailerTarget";

/** Une tuile du carrousel « Extras » d'une fiche, et ce qu'elle lance. */
export interface FicheExtraTile {
  key: string;
  title: string;
  /** « Saison 2 · Coulisses », « VF · AlloCiné »… vide quand rien n'est à dire. */
  subtitle: string;
  /** La vignette d'une vidéo en ligne ; `null` pour un extra local (son image Jellyfin). */
  thumbUrl: string | null;
  /** La vidéo YouTube : sa vignette dit si elle est retirée. */
  youtubeId: string | null;
  /** Ce que lance la tuile — les mêmes genres que le bouton « Bande-annonce ». */
  target: TrailerTarget;
}

export interface FicheExtraTilesInput {
  /** Les extras locaux des titres du carrousel (`useItemsExtras`). */
  local: readonly LocalExtraSource[];
  /** Le titre (saison…) d'où vient chaque extra local. */
  ownerOf: ReadonlyMap<string, string>;
  /** Les vidéos d'avant le catalogue, déjà triées pour la langue ; ignorées avec lui. */
  remote: readonly RichTrailer[];
  /** Le catalogue du serveur (TMDB, AlloCiné…), `null` sans lui. */
  catalog: CatalogRow | null;
  /** Le carrousel réunit plusieurs saisons : chaque tuile dit la sienne. */
  seasonNames: ReadonlyMap<string, string> | null;
}

/**
 * Les tuiles du carrousel « Extras » d'une fiche (`useFicheExtras`), dans
 * l'ordre de toutes les plateformes : les extras locaux, puis les vidéos du
 * catalogue du serveur — AlloCiné compris —, sinon celles d'avant (Jellyfin
 * et TMDB) — la composition du bureau et du miroir (`ExtrasRow`, qui la
 * recomposent encore à la main), lue telle quelle par les téléviseurs.
 */
export function ficheExtraTiles(t: TFunction, input: FicheExtraTilesInput): FicheExtraTile[] {
  const { local, ownerOf, remote, catalog, seasonNames } = input;
  const entries = withSeasonNames(buildExtraEntries(t, local, catalog ? [] : remote), ownerOf, seasonNames);
  const tiles: FicheExtraTile[] = entries.map((entry) => entry.source === "local"
    ? { key: entry.key, title: entry.title, subtitle: entry.subtitle, thumbUrl: null, youtubeId: null, target: { kind: "local", itemId: entry.itemId } }
    : { key: entry.key, title: entry.title, subtitle: entry.subtitle, thumbUrl: entry.thumbUrl, youtubeId: entry.youtubeId, target: { kind: "remote", trailer: entry.trailer } });
  if (!catalog) return tiles;
  const label = seasonNames ? (scope: Parameters<typeof scopeName>[1]) => scopeName(t, scope) : undefined;
  for (const tile of catalogTiles(t, catalog, label)) {
    tiles.push({
      key: tile.key, title: tile.title, subtitle: tile.subtitle, thumbUrl: tile.thumbUrl, youtubeId: tile.youtubeId,
      target: { kind: "relay", entry: tile.entry },
    });
  }
  return tiles;
}
