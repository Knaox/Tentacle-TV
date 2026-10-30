/**
 * Octave — la jaquette GARDÉE d'une playlist, règles pures (`coverPlan.test.ts`).
 *
 * « Sur cet appareil » montre EXACTEMENT la jaquette en ligne (Damien, 28/10) : la même image posée à la main, ou
 * la même mosaïque du jour — mêmes albums, même règle, même graine (`coverUrlsOf`). L'appareil garde donc, pour
 * chaque playlist gardée, ce que le cœur sait de sa jaquette (`MusicPlaylistDetail.cover`) et chaque image qu'elle
 * PEUT montrer un jour (`coverImagesOf`) : la pochette gardée d'un titre quand c'est la même adresse (même image),
 * sinon une copie à elle.
 *
 * Rien ne part au repos : la couverture se prend sur le détail déjà lu (vue de la playlist) ; elle ne se relit que
 * si la jaquette qu'elle donne aujourd'hui n'est plus celle de la liste des playlists (déjà chargée par le rail).
 */

import { coverImagesOf, coverUrlsOf, type MusicPlaylist, type MusicPlaylistCover, type MusicPlaylistDetail } from "@tentacle-tv/shared/music";
import type { KeptMusicTrack } from "../core/musicLibrary";

/** Ce que l'appareil garde de la jaquette d'une playlist. */
export interface KeptCover {
  playlistId: string;
  artworkUrl: string | null;
  cover: MusicPlaylistCover;
  savedAt: number;
}

/** La couverture d'un détail lu ; `null` face à un serveur d'avant (rien à garder : le repli calculé reste). */
export function keptCoverOf(detail: Pick<MusicPlaylistDetail, "jellyfinId" | "artworkUrl" | "cover">, now: number): KeptCover | null {
  return detail.cover ? { playlistId: detail.jellyfinId, artworkUrl: detail.artworkUrl, cover: detail.cover, savedAt: now } : null;
}

/** Les images que la jaquette gardée montre à l'instant `now` (adresses du serveur). */
export function keptCoverUrls(kept: KeptCover, now: number): string[] {
  return coverUrlsOf(kept.cover, kept.artworkUrl, kept.playlistId, now);
}

/** Deux couvertures qui donnent la même jaquette tous les jours : inutile de réécrire. */
export function sameCover(a: KeptCover | undefined, b: KeptCover): boolean {
  return !!a && a.artworkUrl === b.artworkUrl && JSON.stringify(a.cover) === JSON.stringify(b.cover);
}

/** La jaquette de la liste (la mosaïque du cœur, sinon l'image de Jellyfin) : ce que montre la carte en ligne. */
function listCoverUrls(playlist: Pick<MusicPlaylist, "mosaic" | "artworkUrl">): string[] {
  if (playlist.mosaic && playlist.mosaic.length > 0) return playlist.mosaic;
  return playlist.artworkUrl ? [playlist.artworkUrl] : [];
}

/**
 * Les playlists gardées dont la couverture est à (re)lire : jamais lue, ou qui ne donne plus aujourd'hui la jaquette
 * de la liste. Une playlist que la liste ne connaît pas (supprimée, hors de vue) n'est pas relue.
 */
export function coversToRead(keptIds: Iterable<string>, covers: ReadonlyMap<string, KeptCover>, list: readonly MusicPlaylist[], now: number): string[] {
  const byId = new Map(list.map((p) => [p.jellyfinId, p]));
  const out: string[] = [];
  for (const id of keptIds) {
    const online = byId.get(id);
    if (!online) continue;
    const kept = covers.get(id);
    if (!kept || keptCoverUrls(kept, now).join("\n") !== listCoverUrls(online).join("\n")) out.push(id);
  }
  return out;
}

/** La pochette gardée d'un titre, par l'adresse que le serveur lui donnait (la même adresse = la même image). */
export function localCoversByUrl(kept: readonly KeptMusicTrack[], localUrl: (rel: string) => string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const k of kept) {
    if (!k.coverRel) continue;
    let url: unknown;
    try {
      url = (JSON.parse(k.trackJson) as { artworkUrl?: unknown }).artworkUrl;
    } catch {
      continue;
    }
    const local = localUrl(k.coverRel);
    if (typeof url === "string" && local && !out.has(url)) out.set(url, local);
  }
  return out;
}

/** Les images à garder (les couvertures gardées), celles à copier (ni pochette gardée, ni copie), celles à oublier. */
export function imagePlan(covers: Iterable<KeptCover>, local: ReadonlyMap<string, string>, stored: ReadonlySet<string>): { fetch: string[]; drop: string[] } {
  const needed = new Set<string>();
  for (const c of covers) for (const url of coverImagesOf(c.cover, c.artworkUrl)) needed.add(url);
  return {
    fetch: [...needed].filter((url) => !local.has(url) && !stored.has(url)),
    drop: [...stored].filter((url) => !needed.has(url) || local.has(url)),
  };
}

/** Les images à MONTRER : la pochette gardée, sinon la copie, sinon (avec du réseau) l'adresse du serveur ; `null` : rien. */
export function shownCoverUrls(urls: readonly string[], local: ReadonlyMap<string, string>, copies: ReadonlyMap<string, string>, remote: boolean): (string | null)[] {
  return urls.map((url) => local.get(url) ?? copies.get(url) ?? (remote ? url : null));
}

/**
 * La pochette à MONTRER pour une adresse du serveur, partout dans Octave (listes, lecteur, écran verrouillé) :
 * hors ligne, la pochette gardée avec un titre quand c'est la MÊME adresse (même image — un album et ses titres
 * partagent la leur) ; en ligne, ou sans pochette gardée, l'adresse telle quelle.
 */
export function shownArtworkUrl(url: string | null | undefined, local: ReadonlyMap<string, string>, offline: boolean): string | null {
  if (!url) return null;
  return offline ? (local.get(url) ?? url) : url;
}
