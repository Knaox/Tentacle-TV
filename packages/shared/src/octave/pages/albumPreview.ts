/**
 * Octave — l'album qu'une CARTE montrait au moment du clic : la vue Album
 * l'affiche aussitôt (pochette, titre, artistes, année), ses titres arrivant
 * dessous à la réponse de l'extension (~2,5 s à froid : MusicBrainz). Rien
 * n'est inventé : seulement ce que la carte affichait déjà. Borné.
 */

import type { MusicAlbum, MusicTrack } from "../../music";

const MAX_PREVIEWS = 200;
const previews = new Map<string, MusicAlbum>();

/** Retient l'album d'une carte, sous la clé de sa vue (`entityTarget`). */
export function rememberAlbumPreview(key: string, album: MusicAlbum): void {
  previews.delete(key);
  previews.set(key, album);
  while (previews.size > MAX_PREVIEWS) {
    const oldest = previews.keys().next().value;
    if (oldest === undefined) break;
    previews.delete(oldest);
  }
}

/** L'album retenu pour cette vue, sans ses titres (la vue ne montre que ce que la carte montrait). */
export function albumPreview(key: string): MusicAlbum | undefined {
  const album = previews.get(key);
  return album ? { ...album, tracks: undefined, label: undefined } : undefined;
}

/**
 * L'album qu'une RANGÉE de titre montrait (son lien d'album, hors bibliothèque) : son nom, les artistes du titre,
 * sa pochette (celle de la rangée : la vue d'un titre importé rend la même, rien ne saute), son année. `null`
 * sans album ou sans page où aller.
 */
export function albumPreviewOfTrack(key: string, track: Pick<MusicTrack, "album" | "artists"> & Partial<Pick<MusicTrack, "artworkUrl" | "year">>): MusicAlbum | null {
  const album = track.album;
  if (!album || album.jellyfinId || !album.external) return null;
  return {
    key,
    jellyfinId: null,
    external: album.external,
    title: album.title,
    artists: track.artists.map((a) => ({ name: a.name, mbid: a.mbid, jellyfinId: a.jellyfinId })),
    year: track.year ?? null,
    releaseDate: null,
    kind: "album",
    artworkUrl: track.artworkUrl ?? null,
    trackCount: null,
    durationMs: null,
    mbids: { release: album.mbid, releaseGroup: null },
  };
}
