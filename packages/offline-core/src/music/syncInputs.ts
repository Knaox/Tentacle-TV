/**
 * Octave — ce que la tenue à jour demande au serveur : le contenu des playlists
 * gardées, la version Jellyfin des titres d'ailleurs gardés (`POST
 * /api/music/match`, la règle « Jellyfin fait foi » du cœur), et la forme voulue
 * pour les titres de la bibliothèque gardés (le plan, `offline.music`). Une
 * lecture qui échoue (hors ligne, refus, playlist supprimée) ne donne RIEN : la
 * règle laisse alors ce qui est gardé tel quel. Les requêtes sont celles de
 * `@tentacle-tv/api-client`, données par la plateforme (`SyncReadApi`).
 *
 * Une playlist de la bibliothèque se lit COMME ELLE SE MONTRE : ses entrées
 * Jellyfin ET ses titres hors bibliothèque en attente (une playlist importée,
 * `mergePlaylist`). Lue sans eux, elle semblait les avoir perdus et la passe
 * complète les effaçait de l'appareil (relevé du 27/10, « New »). Attentes
 * illisibles : une playlist qui garde des titres d'ailleurs reste intacte.
 */

import { parseTrackKey, type MusicMatchRequest, type MusicMatchResponse, type MusicOfflinePlanResponse, type MusicPage, type MusicPlaylistDetail, type MusicTrack, type PendingMusicItem } from "@tentacle-tv/shared/music";
import { mergePlaylist } from "@tentacle-tv/shared/octave";
import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import { keptToTrack } from "./deviceModel";
import { planLibrary } from "./keepItems";
import type { WantedForm } from "./syncPlan";

/** Ce que la tenue à jour sait d'une extension de musique (le `MusicProvider` d'api-client, réduit). */
export interface SyncProvider {
  pluginId: string;
  music: { pending?: string; playlist?: string };
}

/** Les requêtes, données par la plateforme (celles d'api-client : `musicApi`, `fetchPendingMusic`…). */
export interface SyncReadApi<P extends SyncProvider = SyncProvider> {
  playlist(id: string): Promise<Pick<MusicPlaylistDetail, "entries">>;
  externalPlaylist(provider: P, id: string): Promise<{ tracks?: MusicTrack[] } | null>;
  pending(provider: P): Promise<{ items: PendingMusicItem[] }>;
  matchRequest(tracks: readonly MusicTrack[]): MusicMatchRequest | null;
  match(request: MusicMatchRequest): Promise<Pick<MusicMatchResponse, "tracks">>;
  plan(body: { ids: string[] }): Promise<MusicOfflinePlanResponse>;
  /** Les titres likés, page par page (`GET /api/music/liked`) ; absente : « Titres likés » n'est jamais relue. */
  liked?(cursor: string | null, limit: number): Promise<MusicPage<MusicTrack>>;
}

/**
 * « Titres likés » gardés en entier : une collection `playlist` à cette clé (jamais une playlist Jellyfin), tenue à
 * jour comme une playlist (un cœur posé garde le titre, un cœur retiré le libère s'il n'est retenu ailleurs).
 */
export const LIKED_PLAYLIST_ID = "liked";
export const LIKED_COLLECTION_KEY = `playlist:${LIKED_PLAYLIST_ID}`;
/** Au-delà, on ne lit plus : la collection garde ses 5 000 premiers titres (la borne du moteur). */
export const LIKED_MAX_TRACKS = 5_000;
const LIKED_PAGE = 200;

const noLocal = (): null => null;
const MATCH_BATCH = 200;

/** L'identifiant d'une playlist gardée, d'après la clé de sa collection (`playlist:jf:<id>`, `playlist:ext:<extension>:<id>`). */
export function playlistTarget(
  collectionKey: string,
): { kind: "library"; id: string } | { kind: "external"; pluginId: string; id: string } | { kind: "liked"; id: string } | null {
  if (collectionKey === LIKED_COLLECTION_KEY) return { kind: "liked", id: LIKED_PLAYLIST_ID };
  if (!collectionKey.startsWith("playlist:")) return null;
  const rest = collectionKey.slice("playlist:".length);
  if (rest.startsWith("jf:")) return { kind: "library", id: rest.slice(3) };
  const parsed = parseTrackKey(rest);
  return parsed?.kind === "external" ? { kind: "external", pluginId: parsed.ref.pluginId, id: parsed.ref.id } : null;
}

/** Tous les titres likés, dans l'ordre du serveur ; `null` : illisibles (route absente, hors ligne, refus). */
export async function readLikedWith(api: Pick<SyncReadApi, "liked">, max = LIKED_MAX_TRACKS): Promise<MusicTrack[] | null> {
  if (!api.liked) return null;
  const out: MusicTrack[] = [];
  let cursor: string | null = null;
  try {
    do {
      const page: MusicPage<MusicTrack> = await api.liked(cursor, LIKED_PAGE);
      out.push(...page.items);
      cursor = page.cursor;
    } while (cursor !== null && out.length < max);
  } catch {
    return null;
  }
  return out.slice(0, max);
}

/** Les attentes du compte chez l'extension (`music.pending`) ; `null` : illisibles (sans extension, sans route, refus). */
export async function readPendingWith<P extends SyncProvider>(api: SyncReadApi<P>, provider: P | null): Promise<PendingMusicItem[] | null> {
  if (!provider?.music.pending) return null;
  try {
    return (await api.pending(provider)).items;
  } catch {
    return null;
  }
}

/** Les titres d'extension que garde cette collection viennent-ils tous de celle qu'on sait lire ? */
function externalsReadable(c: KeptMusicCollection, provider: SyncProvider | null, pending: readonly PendingMusicItem[] | null): boolean {
  const externals = c.trackKeys.filter((k) => k.startsWith("ext:"));
  if (externals.length === 0) return true;
  return pending !== null && provider !== null && externals.every((k) => k.startsWith(`ext:${provider.pluginId}:`));
}

/**
 * Le contenu d'aujourd'hui des playlists gardées (celles de `only` s'il est donné), une playlist de la bibliothèque
 * avec ses attentes (`pending`, lues une fois pour le passage par `readPendingWith`).
 */
export async function readPlaylistsWith<P extends SyncProvider>(
  api: SyncReadApi<P>,
  collections: readonly KeptMusicCollection[],
  provider: P | null,
  only: ReadonlySet<string> | null = null,
  pending: readonly PendingMusicItem[] | null = null,
): Promise<Map<string, MusicTrack[]>> {
  const out = new Map<string, MusicTrack[]>();
  for (const c of collections) {
    const target = c.kind === "playlist" ? playlistTarget(c.key) : null;
    if (!target || (only && !only.has(target.id))) continue;
    try {
      if (target.kind === "liked") {
        const liked = await readLikedWith(api);
        if (liked) out.set(c.key, liked);
      } else if (target.kind === "library") {
        if (!externalsReadable(c, provider, pending)) continue;
        const entries = (await api.playlist(target.id)).entries;
        out.set(c.key, mergePlaylist(entries, pending ?? [], target.id).map((row) => row.track));
      } else if (provider && provider.pluginId === target.pluginId && provider.music.playlist) {
        const playlist = await api.externalPlaylist(provider, target.id);
        if (playlist?.tracks) out.set(c.key, playlist.tracks);
      }
    } catch {
      // Hors ligne, playlist supprimée, refus : elle reste telle qu'elle est gardée.
    }
  }
  return out;
}

/** La version Jellyfin des titres d'ailleurs gardés, par leur clé `ext:`. */
export async function readTwinsWith(api: Pick<SyncReadApi, "matchRequest" | "match">, kept: readonly KeptMusicTrack[]): Promise<Map<string, MusicTrack>> {
  const outside = [...new Map(kept.filter((k) => k.origin === "external").map((k) => [k.trackKey, keptToTrack(k, noLocal)])).values()];
  const out = new Map<string, MusicTrack>();
  for (let i = 0; i < outside.length; i += MATCH_BATCH) {
    const request = api.matchRequest(outside.slice(i, i + MATCH_BATCH));
    if (!request) continue;
    try {
      for (const m of (await api.match(request)).tracks) out.set(m.ref, m.track);
    } catch {
      // Sans réponse : rien de remplacé ce tour-ci.
    }
  }
  return out;
}

/** La forme que le serveur veut aujourd'hui pour les titres de la bibliothèque gardés, par clé `jf:`. */
export async function readWantedWith(api: Pick<SyncReadApi, "plan">, kept: readonly KeptMusicTrack[]): Promise<Map<string, WantedForm>> {
  // L'identifiant de l'item (normalisé par le moteur, comme par le plan) → la clé du titre gardé.
  const keyOf = new Map(kept.filter((k) => k.origin === "library").map((k) => [k.itemId, k.trackKey]));
  const out = new Map<string, WantedForm>();
  if (keyOf.size === 0) return out;
  try {
    for (const [id, plan] of await planLibrary([...keyOf.keys()], api.plan)) {
      const key = keyOf.get(id);
      if (key) out.set(key, { variant: plan.variant, preset: plan.preset });
    }
  } catch {
    // Plan refusé (droit retiré) ou serveur muet : la forme gardée ne bouge pas.
  }
  return out;
}
