/**
 * Octave — ce que la tenue à jour demande au serveur, sans React : le contenu des
 * playlists gardées, la version Jellyfin des titres d'ailleurs gardés
 * (`POST /api/music/match`, la règle « Jellyfin fait foi » du cœur), et la forme
 * voulue pour les titres de la bibliothèque gardés (le plan, `offline.music`).
 * Une lecture qui échoue (hors ligne, refus, playlist supprimée) ne donne RIEN :
 * la règle laisse alors ce qui est gardé tel quel.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { fetchExternalPlaylist, libraryMatchRequest, musicApi, type MusicProvider } from "@tentacle-tv/api-client";
import { parseTrackKey, type MusicTrack } from "@tentacle-tv/shared/music";
import { keptToTrack } from "../deviceModel";
import { planLibrary } from "../keepMusic";
import type { WantedForm } from "./syncPlan";

const noLocal = (): null => null;
const MATCH_BATCH = 200;

/** L'identifiant d'une playlist gardée, d'après la clé de sa collection (`playlist:jf:<id>`, `playlist:ext:<extension>:<id>`). */
export function playlistTarget(collectionKey: string): { kind: "library"; id: string } | { kind: "external"; pluginId: string; id: string } | null {
  if (!collectionKey.startsWith("playlist:")) return null;
  const rest = collectionKey.slice("playlist:".length);
  if (rest.startsWith("jf:")) return { kind: "library", id: rest.slice(3) };
  const parsed = parseTrackKey(rest);
  return parsed?.kind === "external" ? { kind: "external", pluginId: parsed.ref.pluginId, id: parsed.ref.id } : null;
}

/** Le contenu d'aujourd'hui des playlists gardées (celles de `only` s'il est donné). */
export async function readPlaylists(collections: readonly KeptMusicCollection[], provider: MusicProvider | null, only: ReadonlySet<string> | null = null): Promise<Map<string, MusicTrack[]>> {
  const out = new Map<string, MusicTrack[]>();
  for (const c of collections) {
    const target = c.kind === "playlist" ? playlistTarget(c.key) : null;
    if (!target || (only && !only.has(target.id))) continue;
    try {
      if (target.kind === "library") {
        out.set(c.key, (await musicApi.playlist(target.id)).entries.map((e) => e.track));
      } else if (provider && provider.pluginId === target.pluginId && provider.music.playlist) {
        const playlist = await fetchExternalPlaylist(provider, target.id);
        if (playlist?.tracks) out.set(c.key, playlist.tracks);
      }
    } catch {
      // Hors ligne, playlist supprimée, refus : elle reste telle qu'elle est gardée.
    }
  }
  return out;
}

/** La version Jellyfin des titres d'ailleurs gardés, par leur clé `ext:`. */
export async function readTwins(kept: readonly KeptMusicTrack[]): Promise<Map<string, MusicTrack>> {
  const outside = [...new Map(kept.filter((k) => k.origin === "external").map((k) => [k.trackKey, keptToTrack(k, noLocal)])).values()];
  const out = new Map<string, MusicTrack>();
  for (let i = 0; i < outside.length; i += MATCH_BATCH) {
    const request = libraryMatchRequest(outside.slice(i, i + MATCH_BATCH), []);
    if (!request) continue;
    try {
      for (const m of (await musicApi.match(request)).tracks) out.set(m.ref, m.track);
    } catch {
      // Sans réponse : rien de remplacé ce tour-ci.
    }
  }
  return out;
}

/** La forme que le serveur veut aujourd'hui pour les titres de la bibliothèque gardés, par clé `jf:`. */
export async function readWanted(kept: readonly KeptMusicTrack[]): Promise<Map<string, WantedForm>> {
  // L'identifiant de l'item (normalisé par le moteur, comme par le plan) → la clé du titre gardé.
  const keyOf = new Map(kept.filter((k) => k.origin === "library").map((k) => [k.itemId, k.trackKey]));
  const out = new Map<string, WantedForm>();
  if (keyOf.size === 0) return out;
  try {
    for (const [id, plan] of await planLibrary([...keyOf.keys()])) {
      const key = keyOf.get(id);
      if (key) out.set(key, { variant: plan.variant, preset: plan.preset });
    }
  } catch {
    // Plan refusé (droit retiré) ou serveur muet : la forme gardée ne bouge pas.
  }
  return out;
}
