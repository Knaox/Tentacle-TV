/**
 * Octave — LA bibliothèque musique du serveur : une bibliothèque Jellyfin
 * DÉDIÉE (`CollectionType = music`). Plusieurs ? La première par nom, sauf si
 * `TENTACLE_MUSIC_LIBRARY_ID` en désigne une (un identifiant de dossier virtuel,
 * tel que `/Library/VirtualFolders` le rend dans `ItemId`).
 *
 * Relue au plus toutes les minutes ; une bibliothèque créée ou retirée se voit
 * donc sans redémarrage, sans relevé de plus qu'une requête par minute au
 * moment où la musique est demandée.
 */

import { jfAdmin, normalizeId } from "./musicJellyfin";

export interface MusicLibrary {
  libraryId: string;
  name: string;
  /** Les dossiers, tels que JELLYFIN les voit (chemins de son conteneur). */
  paths: string[];
}

interface VirtualFolder {
  Name?: string;
  ItemId?: string;
  CollectionType?: string;
  Locations?: string[];
}

const TTL_MS = 60_000;
let cached: { at: number; library: MusicLibrary | null } | null = null;
let inflight: Promise<MusicLibrary | null> | null = null;

/** Pur, pour les tests : le choix parmi les dossiers virtuels. */
export function pickMusicLibrary(folders: VirtualFolder[], forcedId: string | undefined): MusicLibrary | null {
  const music = folders
    .filter((f) => f.ItemId && (f.CollectionType ?? "").toLowerCase() === "music")
    .map((f) => ({ libraryId: normalizeId(f.ItemId!), name: f.Name ?? "", paths: f.Locations ?? [] }));
  if (forcedId) {
    const wanted = normalizeId(forcedId);
    // Forcée : celle-là ou aucune — jamais une autre en silence.
    return music.find((m) => m.libraryId === wanted) ?? null;
  }
  music.sort((a, b) => a.name.localeCompare(b.name));
  return music[0] ?? null;
}

async function load(): Promise<MusicLibrary | null> {
  const result = await jfAdmin<VirtualFolder[]>("/Library/VirtualFolders");
  // Jellyfin muet : on garde ce qu'on savait plutôt que de faire disparaître la musique.
  if (!result.ok) return cached?.library ?? null;
  return pickMusicLibrary(Array.isArray(result.data) ? result.data : [], process.env.TENTACLE_MUSIC_LIBRARY_ID?.trim() || undefined);
}

export async function getMusicLibrary(now = Date.now()): Promise<MusicLibrary | null> {
  if (cached && now - cached.at < TTL_MS) return cached.library;
  inflight ??= load()
    .then((library) => {
      cached = { at: Date.now(), library };
      return library;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** La dernière connue, sans requête (les évènements en ont besoin tout de suite). */
export function knownMusicLibrary(): MusicLibrary | null {
  return cached?.library ?? null;
}

export function resetMusicLibraryForTests(): void {
  cached = null;
  inflight = null;
}
