/**
 * Octave (mobile) — D'OÙ joue le lecteur, pour l'en-tête du lecteur plein écran (« Lu depuis la playlist… »,
 * `nowPlayingSource.test.ts`) : la page où l'on retourne d'un toucher. Règle pure, lue sur le contexte de la file
 * (`queue.contextId`, posé par la page qui a lancé la lecture) :
 *
 * - `album:<id>`, `playlist:<id>` (ou `playlist:ext:…`, une playlist d'extension), `artist:<id>`, `liked`,
 *   `mood:<id>` : la page même ;
 * - tout le reste (accueil, recherche, mix du jour, titres sur l'appareil, contexte inconnu) n'a pas de page à
 *   rouvrir : l'ALBUM du titre en cours, s'il en a un où aller — l'accès rapide reste là ;
 * - rien où aller : `null` (l'en-tête garde « En cours de lecture », sans bouton).
 */

import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import type { MusicArtistRef, MusicTrack } from "@tentacle-tv/shared/music";

export type NowPlayingSource =
  | { kind: "album"; target: string; name: string | null }
  | { kind: "playlist"; id: string }
  | { kind: "externalPlaylist"; key: string }
  | { kind: "artist"; target: string; name: string | null }
  | { kind: "liked" }
  | { kind: "mood"; id: string };

type SourceTrack = Pick<MusicTrack, "album" | "artists">;

function rest(contextId: string, prefix: string): string | null {
  if (!contextId.startsWith(prefix)) return null;
  const value = contextId.slice(prefix.length);
  return value === "" ? null : value;
}

function artistName(artists: readonly MusicArtistRef[], target: string): string | null {
  return artists.find((a) => entityTarget(a) === target)?.name ?? null;
}

function albumOf(track: SourceTrack | null): NowPlayingSource | null {
  const album = track?.album;
  if (!album) return null;
  const target = entityTarget(album);
  return target ? { kind: "album", target, name: album.title || null } : null;
}

export function nowPlayingSource(contextId: string | null, track: SourceTrack | null): NowPlayingSource | null {
  if (contextId === "liked" || contextId === "playlist:liked") return { kind: "liked" };
  if (contextId !== null) {
    const album = rest(contextId, "album:");
    if (album !== null) {
      // Le nom : celui de l'album du titre, s'il s'agit bien de lui (une file d'album ne joue que lui).
      const own = track?.album && entityTarget(track.album) === album ? track.album.title : null;
      return { kind: "album", target: album, name: own || null };
    }
    const playlist = rest(contextId, "playlist:");
    if (playlist !== null) return playlist.startsWith("ext:") ? { kind: "externalPlaylist", key: playlist } : { kind: "playlist", id: playlist };
    const artist = rest(contextId, "artist:");
    if (artist !== null) return { kind: "artist", target: artist, name: artistName(track?.artists ?? [], artist) };
    const mood = rest(contextId, "mood:");
    if (mood !== null) return { kind: "mood", id: mood };
  }
  return albumOf(track);
}

/** La clé i18n (espace `music`) de la ligne du dessus : la nature de la source. */
export function sourceKickerKey(source: NowPlayingSource): string {
  switch (source.kind) {
    case "album": return "nowPlayingSource.fromAlbum";
    case "playlist":
    case "externalPlaylist": return "nowPlayingSource.fromPlaylist";
    case "artist": return "nowPlayingSource.fromArtist";
    case "liked": return "nowPlayingSource.fromLiked";
    case "mood": return "nowPlayingSource.fromMood";
  }
}
