import {
  isRelayedPlayback, trailerOriginLabel, trailerPlaybackKey, trailerScopeKey, trailerVersionLabelKey, type TrailerEntry,
} from "../trailers";
import { youtubeThumbUrl } from "./extraEntries";
import type { RelayedTrailerEntry } from "./trailerTarget";

/**
 * Les rangées « Extras » nourries par le CATALOGUE du serveur : une portée
 * (le film, la série, une saison) par rangée, ses vidéos en ligne dans
 * l'ordre du serveur — la langue du serveur d'abord. Les bandes-annonces
 * locales du catalogue sont déjà les tuiles locales de la rangée. Web,
 * bureau, miroir et mobile : la même lecture.
 */
export interface CatalogRow {
  entries: readonly RelayedTrailerEntry[];
  language: string | null;
}

export interface CatalogScopes {
  byScope: ReadonlyMap<string, RelayedTrailerEntry[]>;
  language: string | null;
}

/** Le catalogue d'une fiche, rangé par portée (`movie`, `series`, `s3`) — vidéos en ligne seulement. */
export function catalogEntriesByScope(entries: readonly TrailerEntry[], language: string | null): CatalogScopes {
  const byScope = new Map<string, RelayedTrailerEntry[]>();
  for (const entry of entries) {
    if (!isRelayedPlayback(entry.playback)) continue;
    const key = trailerScopeKey(entry.scope);
    const list = byScope.get(key) ?? [];
    list.push(entry as RelayedTrailerEntry);
    byScope.set(key, list);
  }
  return { byScope, language };
}

/** La rangée d'une portée, ou `null` quand le catalogue n'y a rien (la rangée garde alors ses vidéos d'avant). */
export function catalogRowFor(scopes: CatalogScopes | null, scopeKey: string): CatalogRow | null {
  if (!scopes) return null;
  const entries = scopes.byScope.get(scopeKey);
  return entries && entries.length > 0 ? { entries, language: scopes.language } : null;
}

/** La clé de la portée d'une saison (son numéro), `null` sans numéro. */
export function seasonScopeKey(seasonNumber: number | null | undefined): string | null {
  return typeof seasonNumber === "number" && seasonNumber > 0 ? `s${seasonNumber}` : null;
}

export interface CatalogTile {
  key: string;
  entry: RelayedTrailerEntry;
  title: string;
  /** « VF · AlloCiné », « Teaser · YouTube »… */
  subtitle: string;
  thumbUrl: string;
  /** La vidéo YouTube : sa vignette dit si elle est retirée. */
  youtubeId: string | null;
}

/** La vignette d'une vidéo Dailymotion (servie publiquement par Dailymotion). */
export function dailymotionThumbUrl(videoId: string): string {
  return `https://www.dailymotion.com/thumbnail/video/${encodeURIComponent(videoId)}`;
}

/**
 * Les tuiles d'une rangée du catalogue (`t` : clés de l'espace `common`,
 * préfixées). `scopeLabel` : dans un carrousel qui réunit plusieurs portées
 * (une série et ses saisons), le nom de la portée en tête (« Saison 6 »).
 */
export function catalogTiles(
  t: (key: string) => string,
  row: CatalogRow,
  scopeLabel?: (scope: TrailerEntry["scope"]) => string | null,
): CatalogTile[] {
  return row.entries.map((entry) => {
    const versionKey = trailerVersionLabelKey(entry.version, row.language);
    const parts = [
      scopeLabel?.(entry.scope) ?? null,
      versionKey ? t(`common:trailerVersion_${versionKey}`) : null,
      entry.type === "teaser" ? t("common:extraKindTeaser") : null,
      t(`common:trailerOrigin_${trailerOriginLabel(entry)}`),
    ].filter((part): part is string => !!part);
    const youtubeId = entry.playback.kind === "youtube" ? entry.playback.ytId : null;
    return {
      key: trailerPlaybackKey(entry.playback),
      entry,
      title: entry.name,
      subtitle: parts.join(" · "),
      thumbUrl: entry.playback.kind === "youtube" ? youtubeThumbUrl(entry.playback.ytId) : dailymotionThumbUrl(entry.playback.videoId),
      youtubeId,
    };
  });
}
