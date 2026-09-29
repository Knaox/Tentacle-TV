import type { TFunction } from "i18next";
import { parseYouTubeId, type RichTrailer } from "../trailers";
import { extraKind, extraKindLabel, localExtraKind, localExtraTitle } from "./extraLabels";

/** Ce que les tuiles lisent d'un extra local — un `MediaItem` de Jellyfin suffit. */
export interface LocalExtraSource {
  Id: string;
  Name?: string;
  Type?: string;
  ExtraType?: string;
}

/** Un extra LOCAL : un fichier du serveur, lu dans le lecteur de l'app. */
export interface LocalExtraEntry {
  source: "local";
  key: string;
  itemId: string;
  title: string;
  /** Son genre traduit — vide quand le titre le dit déjà. */
  subtitle: string;
}

/** Une vidéo DISTANTE (YouTube) : Jellyfin (`RemoteTrailers`) ou TMDB. */
export interface RemoteExtraEntry {
  source: "remote";
  key: string;
  trailer: RichTrailer;
  youtubeId: string | null;
  /** La vignette YouTube — `null` hors YouTube : la tuile garde son fond. */
  thumbUrl: string | null;
  title: string;
  subtitle: string;
}

export type ExtraEntry = LocalExtraEntry | RemoteExtraEntry;

/** L'hôte des vignettes YouTube : `hqdefault` rend un gris 120×90 pour une vidéo retirée. */
export function youtubeThumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

/**
 * Les tuiles d'une rangée « Extras », dans l'ordre de TOUTES les plateformes :
 * les bandes-annonces locales, puis les bonus, puis les vidéos distantes.
 *
 * Les bandes-annonces locales n'apparaissaient nulle part hors du bouton
 * « Bande-annonce », qui n'en lance que la première : la seconde d'un film
 * (un teaser, par exemple) et celles d'une saison restaient introuvables.
 */
export function buildExtraEntries(
  t: TFunction,
  local: readonly LocalExtraSource[],
  remote: readonly RichTrailer[],
): ExtraEntry[] {
  const entries: ExtraEntry[] = [];
  const seen = new Set<string>();
  for (const extra of local) {
    const key = `local-${extra.Id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = localExtraTitle(t, extra);
    const kind = extraKindLabel(t, localExtraKind(extra));
    // Un extra que Jellyfin 12 n'a nommé que par son genre (« Trailer ») ne
    // répète pas « Bande-annonce » sous « Bande-annonce » : sous-titre vide.
    entries.push({ source: "local", key, itemId: extra.Id, title, subtitle: kind === title ? "" : kind });
  }
  for (const trailer of remote) {
    if (!trailer.Url) continue;
    const youtubeId = parseYouTubeId(trailer.Url);
    const key = `remote-${youtubeId ?? trailer.Url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Le genre que TMDB donne, puis la plateforme : « Teaser · YouTube ».
    const where = youtubeId ? "YouTube" : null;
    const kind = trailer.type ? extraKindLabel(t, extraKind(trailer.type)) : null;
    entries.push({
      source: "remote",
      key,
      trailer,
      youtubeId,
      thumbUrl: youtubeId ? youtubeThumbUrl(youtubeId) : null,
      title: trailer.Name?.trim() || t("common:trailer"),
      subtitle: [kind, where].filter(Boolean).join(" · ") || t("common:trailer"),
    });
  }
  return entries;
}
