/**
 * Labo d'Octave — les PLAYLISTS factices du compte : une mosaïque de quatre pochettes, une
 * playlist partagée, une playlist d'un autre compte (membre), une playlist vide.
 */

import type { MusicListStats, MusicPlaylist, MusicPlaylistDetail, MusicPlaylistEntry, MusicPlaylistSharing, MusicTrack } from "@tentacle-tv/shared/music";
import { labId } from "./labIds";
import { pickTracks } from "./labTracks";

export const LAB_USER = { userId: labId("user-camille"), name: "Camille" } as const;
const INES = { userId: labId("user-ines"), name: "Inès", imageTag: null } as const;

/** Un jour fixe : les dates d'ajout ne bougent pas d'une capture à l'autre. */
const DAY_MS = 86_400_000;
const LAB_NOW = Date.UTC(2026, 10, 10, 9, 0, 0);

const SHARED_BY_ME: MusicPlaylistSharing = {
  role: "owner",
  right: "owner",
  owner: { ...LAB_USER, imageTag: null },
  members: [
    { ...INES, right: "add" },
    { userId: labId("user-marc"), name: "Marc", imageTag: null, right: "read" },
  ],
};

const SHARED_WITH_ME: MusicPlaylistSharing = {
  role: "member",
  right: "add",
  owner: INES,
  members: [{ ...LAB_USER, imageTag: null, right: "add" }],
};

interface PlaylistSeed {
  /** Le nom lisible (`pl-matins`) ; l'identifiant Jellyfin en est tiré (`labId`). */
  id: string;
  name: string;
  description: string | null;
  tracks: MusicTrack[];
  editable: boolean;
  sharing?: MusicPlaylistSharing;
  favorite?: boolean;
}

const SEEDS: readonly PlaylistSeed[] = [
  { id: "pl-matins", name: "Matins lents", description: "Du piano, des cordes, rien qui presse.", tracks: pickTracks(18, 7, 2), editable: true, favorite: true },
  { id: "pl-route", name: "Route de nuit", description: null, tracks: pickTracks(24, 5, 15), editable: true, favorite: true },
  { id: "pl-dimanche", name: "Dimanche pluvieux", description: "À plusieurs : chacun ajoute ses titres.", tracks: pickTracks(12, 11, 30), editable: true, sharing: SHARED_BY_ME },
  { id: "pl-courir", name: "Pour courir", description: null, tracks: pickTracks(16, 3, 44), editable: true },
  { id: "pl-ines", name: "Les trouvailles d'Inès", description: null, tracks: pickTracks(9, 13, 8), editable: false, sharing: SHARED_WITH_ME },
  { id: "pl-vide", name: "À trier plus tard", description: null, tracks: [], editable: true },
];

/** Quatre pochettes d'albums DIFFÉRENTS (ou une seule, ou aucune) : la mosaïque que le cœur compose. */
function mosaicOf(tracks: readonly MusicTrack[]): string[] {
  const urls = [...new Set(tracks.map((t) => t.artworkUrl).filter((url): url is string => url !== null))];
  return urls.length >= 4 ? urls.slice(0, 4) : urls.slice(0, 1);
}

function summaryOf(seed: PlaylistSeed): MusicPlaylist {
  return {
    jellyfinId: labId(seed.id),
    name: seed.name,
    trackCount: seed.tracks.length,
    durationMs: seed.tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0),
    artworkUrl: null,
    mosaic: mosaicOf(seed.tracks),
    editable: seed.editable,
    description: seed.description,
    favorite: seed.favorite ?? false,
    ...(seed.sharing ? { sharing: seed.sharing } : {}),
  };
}

function statsOf(index: number): MusicListStats {
  return { addedAt: LAB_NOW - index * 3 * DAY_MS, plays: (index * 7) % 23, lastPlayedAt: LAB_NOW - index * DAY_MS };
}

function entriesOf(seed: PlaylistSeed): MusicPlaylistEntry[] {
  return seed.tracks.map((track, position) => ({ entryId: `${seed.id}-e${position + 1}`, position, track, stats: statsOf(position) }));
}

export const LAB_PLAYLISTS: readonly MusicPlaylist[] = SEEDS.map(summaryOf);

export const EMPTY_PLAYLIST_ID = labId("pl-vide");
export const MAIN_PLAYLIST_ID = labId("pl-matins");

export function playlistDetail(id: string): MusicPlaylistDetail | null {
  const seed = SEEDS.find((s) => labId(s.id) === id);
  return seed ? { ...summaryOf(seed), entries: entriesOf(seed) } : null;
}

export function playlistSharing(id: string): MusicPlaylistSharing | null {
  return SEEDS.find((s) => labId(s.id) === id)?.sharing ?? null;
}

/** Les statistiques d'une liste de titres, par identifiant Jellyfin (les likés). */
export function statsById(tracks: readonly MusicTrack[]): Record<string, MusicListStats> {
  return Object.fromEntries(tracks.map((t, i) => [t.jellyfinId ?? t.key, statsOf(i)]));
}
