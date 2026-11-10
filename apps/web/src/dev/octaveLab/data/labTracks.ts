/**
 * Labo d'Octave — les TITRES factices de chaque album (durées stables, un titre explicite, un
 * titre indisponible grisé) et leurs sources de lecture (jamais chargées : le moteur est factice).
 */

import type { MusicAlbum, MusicAudioFormat, MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { ALBUM_SEEDS, albumOf, artOf, artistRef, type AlbumSeed } from "./labCatalog";
import { labId } from "./labIds";

/** « FLAC 24 bits / 96 kHz », sans perte : ce que la barre de lecture dit du titre en cours. */
export const LAB_FLAC: MusicAudioFormat = { codec: "flac", container: "flac", sampleRate: 96_000, bitDepth: 24, bitrate: 2_800_000, channels: 2, lossless: true };
const LAB_CD: MusicAudioFormat = { codec: "flac", container: "flac", sampleRate: 44_100, bitDepth: 16, bitrate: 950_000, channels: 2, lossless: true };
const LAB_AAC: MusicAudioFormat = { codec: "aac", container: "m4a", sampleRate: 44_100, bitDepth: null, bitrate: 256_000, channels: 2, lossless: false };

/** Le titre en cours des scènes de lecture : 3:45, lu à 1:12. */
export const CURRENT_ALBUM_ID = labId("al-marees");
const CURRENT_TRACK_SLUG = "al-marees-04";
export const CURRENT_TRACK_ID = labId(CURRENT_TRACK_SLUG);
export const CURRENT_DURATION_MS = 225_000;
export const CURRENT_POSITION_MS = 72_000;

/** Une durée plausible et STABLE (2:28 à 5:10), tirée de la place du titre. */
function durationOf(albumIndex: number, trackIndex: number): number {
  return 148_000 + ((albumIndex * 37 + trackIndex * 53) % 163) * 1_000;
}

function formatOf(albumIndex: number): MusicAudioFormat {
  if (albumIndex % 4 === 3) return LAB_AAC;
  return albumIndex % 2 === 0 ? LAB_FLAC : LAB_CD;
}

function trackOf(seed: AlbumSeed, albumIndex: number, title: string, trackIndex: number): MusicTrack {
  // Le nom lisible du titre (`al-marees-04`) ; son identifiant Jellyfin en est tiré.
  const slug = `${seed.id}-${String(trackIndex + 1).padStart(2, "0")}`;
  const id = labId(slug);
  const track: MusicTrack = {
    key: `jf:${id}`,
    jellyfinId: id,
    external: null,
    title,
    artists: [artistRef(seed.artistId)],
    album: { title: seed.title, mbid: null, jellyfinId: labId(seed.id) },
    durationMs: slug === CURRENT_TRACK_SLUG ? CURRENT_DURATION_MS : durationOf(albumIndex, trackIndex),
    trackNumber: trackIndex + 1,
    discNumber: 1,
    year: seed.year,
    artworkUrl: artOf(seed),
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: "library",
    format: formatOf(albumIndex),
    favorite: (albumIndex + trackIndex) % 4 === 0,
  };
  // Un titre explicite, un duo, et un titre qui ne se lit pas (grisé) dans le premier album.
  if (slug === "al-marees-03") track.explicit = true;
  if (slug === "al-marees-05") track.artists = [artistRef(seed.artistId), artistRef("ar-marchand")];
  if (slug === "al-marees-07") track.unavailable = "notPublic";
  return track;
}

const TRACKS_BY_ALBUM: ReadonlyMap<string, readonly MusicTrack[]> = new Map(
  ALBUM_SEEDS.map((seed, albumIndex) => [labId(seed.id), seed.tracks.map((title, i) => trackOf(seed, albumIndex, title, i))]),
);

export const LAB_TRACKS: readonly MusicTrack[] = [...TRACKS_BY_ALBUM.values()].flat();

export function tracksOfAlbum(albumId: string): MusicTrack[] {
  return [...(TRACKS_BY_ALBUM.get(albumId) ?? [])];
}

/** Un titre par son nom lisible (`al-neon-03` : le troisième titre de cet album). */
export function trackBySlug(slug: string): MusicTrack {
  const track = LAB_TRACKS.find((t) => t.jellyfinId === labId(slug));
  if (!track) throw new Error(`labo d'Octave : titre inconnu ${slug}`);
  return track;
}

/** Un album AVEC ses titres (la vue album). */
export function albumDetail(albumId: string): MusicAlbum | null {
  const seed = ALBUM_SEEDS.find((s) => labId(s.id) === albumId);
  if (!seed) return null;
  const tracks = tracksOfAlbum(albumId);
  return {
    ...albumOf(seed),
    durationMs: tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0),
    description: seed.id === "al-marees" ? "Enregistré en une semaine dans une maison face à la rade, piano droit et quatuor à cordes." : null,
    tracks,
  };
}

/** Un choix STABLE de titres à travers le catalogue (accueil, likés, playlists). */
export function pickTracks(count: number, step: number, offset = 0): MusicTrack[] {
  const playable = LAB_TRACKS.filter((t) => !t.unavailable);
  return Array.from({ length: count }, (_, i) => playable[(offset + i * step) % playable.length] as MusicTrack);
}

/** La source d'un titre : une adresse du serveur que le moteur factice ne charge jamais. */
export function sourceOf(track: MusicTrack): PlaybackSource {
  return {
    trackKey: track.key,
    url: `/api/music/stream/${track.jellyfinId ?? ""}`,
    origin: "library",
    complete: true,
    sizeBytes: 48_000_000,
    durationMs: track.durationMs,
    format: track.format,
    replayGain: null,
    expiresAt: null,
  };
}
