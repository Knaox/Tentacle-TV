/**
 * Octave — la JAQUETTE d'une playlist composée par Tentacle (règles pures, partagées par le cœur et ses clients ;
 * recopiées octet pour octet dans `apps/backend/src/music/contract/`).
 *
 * Jellyfin compose seul un collage des PREMIERS titres, un par élément : deux titres du même album à pochette
 * embarquée y font deux fois la même case, et l'image ne change jamais (28/10, playlist « New » : deux fois
 * Arcane, deux fois Imagine Dragons). Ici :
 *
 * - une case par ALBUM, jamais deux fois la même image (une pochette d'artiste, repli d'un titre sans pochette,
 *   n'est pas une pochette d'album : écartée) ;
 * - quatre albums ou plus : quatre cases ; moins : UNE pochette — jamais une case vide ni un doublon pour remplir ;
 * - le choix suit le CONTENU et tourne avec la PÉRIODE (un jour UTC) : chaque album reçoit une note tirée de
 *   (playlist, période, album) et les mieux notés passent. Dans une période, rien ne bouge d'une page ni d'un
 *   rechargement à l'autre ; un ajout n'entre que s'il est mieux noté (jamais tout rebattu), un retrait d'un album
 *   non montré ne change rien, un réordonnancement non plus ;
 * - les AJOUTS RÉCENTS y entrent : une case revient à l'un des albums de la fin de la playlist (le dernier ajouté
 *   y est en bas — `musicSourceOrder.ts`) ; les autres cases varient les artistes tant qu'il y en a assez.
 *
 * Le cœur l'applique aux titres de la bibliothèque (cartes, en-tête : `MusicPlaylist.mosaic`) ; « Sur cet
 * appareil », le client l'applique aux titres GARDÉS, avec leurs pochettes locales : mêmes titres, même jour,
 * mêmes albums.
 */

/** Ce que la règle lit d'un titre (un `MusicTrack` convient). */
export interface MosaicTrack {
  album: { title: string; jellyfinId: string | null } | null;
  artists: readonly { name: string; jellyfinId: string | null }[];
  artworkUrl: string | null;
}

/** Un album candidat : son identité, son artiste, l'image à montrer, et sa place la plus basse dans la playlist. */
export interface MosaicCandidate {
  album: string;
  artist: string | null;
  url: string;
  last: number;
}

export const MOSAIC_CELLS = 4;
/** La rotation : un jour (UTC), le même pour le cœur et l'appareil. */
export const MOSAIC_PERIOD_MS = 86_400_000;
/** Les albums « récents » : la fin de la playlist, au moins ce nombre… */
const RECENT_MIN = 4;
/** … ou cette part des albums. */
const RECENT_SHARE = 0.2;

const ARTWORK_PATH = /\/api\/music\/artwork\/([^/?#]+)/;

/** Le propriétaire d'une pochette du cœur (`/api/music/artwork/<id>`), en minuscules ; `null` ailleurs. */
export function artworkOwner(url: string): string | null {
  const match = ARTWORK_PATH.exec(url);
  return match ? decodeURIComponent(match[1]!).replace(/-/g, "").toLowerCase() : null;
}

const plain = (value: string): string => value.normalize("NFKC").trim().toLowerCase();
const plainId = (id: string): string => id.replace(/-/g, "").toLowerCase();

/** L'identité de l'album d'un titre : son élément Jellyfin, sinon son nom et son premier artiste. */
export function mosaicAlbumKey(track: MosaicTrack): string | null {
  if (track.album?.jellyfinId) return `jf:${plainId(track.album.jellyfinId)}`;
  const title = track.album ? plain(track.album.title) : "";
  return title ? `t:${title}|${plain(track.artists[0]?.name ?? "")}` : null;
}

/** L'image d'un titre est-elle celle d'un de ses artistes (repli de `trackFallbacks.ts`) ? */
function isArtistImage(track: MosaicTrack, url: string): boolean {
  const owner = artworkOwner(url);
  return owner !== null && track.artists.some((a) => a.jellyfinId !== null && plainId(a.jellyfinId) === owner);
}

/**
 * Les albums candidats, dans l'ordre de leur premier titre. `display` donne l'image À MONTRER (la pochette locale
 * d'un titre gardé) ; par défaut, `artworkUrl`. L'éligibilité se juge toujours sur `artworkUrl` (l'image du serveur).
 */
export function mosaicCandidates<T extends MosaicTrack>(tracks: readonly T[], display: (track: T) => string | null = (t) => t.artworkUrl): MosaicCandidate[] {
  const byAlbum = new Map<string, MosaicCandidate>();
  const lastOf = new Map<string, number>();
  const urls = new Set<string>();
  tracks.forEach((track, index) => {
    const album = mosaicAlbumKey(track);
    if (album === null) return;
    lastOf.set(album, index);
    if (byAlbum.has(album) || !track.artworkUrl || isArtistImage(track, track.artworkUrl)) return;
    const url = display(track);
    if (!url || urls.has(url)) return;
    urls.add(url);
    const artist = track.artists[0];
    byAlbum.set(album, { album, artist: artist ? (artist.jellyfinId ? `jf:${plainId(artist.jellyfinId)}` : plain(artist.name)) : null, url, last: index });
  });
  return [...byAlbum.values()].map((c) => ({ ...c, last: lastOf.get(c.album) ?? c.last }));
}

/** FNV-1a 32 bits, puis le brassage final de murmur3 : une note bien répartie, la même partout. */
function score(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** La période d'un instant (jours UTC depuis l'époque). */
export const mosaicPeriod = (now: number): number => Math.floor(now / MOSAIC_PERIOD_MS);

/** Les images de la jaquette (1 ou 4 ; aucune sans candidat), pour `subject` (la playlist) à l'instant `now`. */
export function pickMosaic(candidates: readonly MosaicCandidate[], subject: string, now: number): string[] {
  if (candidates.length === 0) return [];
  const seed = `${subject}|${mosaicPeriod(now)}|`;
  const ranked = candidates
    .map((c) => ({ c, s: score(seed + c.album) }))
    .sort((a, b) => b.s - a.s || (a.c.album < b.c.album ? -1 : 1))
    .map((r) => r.c);
  if (candidates.length < MOSAIC_CELLS) return [ranked[0]!.url];
  const recentCount = Math.max(RECENT_MIN, Math.ceil(candidates.length * RECENT_SHARE));
  const recent = new Set([...candidates].sort((a, b) => b.last - a.last).slice(0, recentCount).map((c) => c.album));
  const fresh = ranked.find((c) => recent.has(c.album))!;
  const chosen = [fresh];
  const artists = new Set([fresh.artist]);
  // D'abord un artiste par case ; s'il n'y en a pas assez, d'autres albums des mêmes artistes.
  for (const c of ranked) {
    if (chosen.length === MOSAIC_CELLS) break;
    if (chosen.includes(c) || artists.has(c.artist)) continue;
    chosen.push(c);
    artists.add(c.artist);
  }
  for (const c of ranked) {
    if (chosen.length === MOSAIC_CELLS) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen.map((c) => c.url);
}

/** La jaquette d'une liste de titres (dans l'ordre de la playlist). */
export function playlistMosaic(tracks: readonly MosaicTrack[], subject: string, now: number): string[] {
  return pickMosaic(mosaicCandidates(tracks), subject, now);
}
