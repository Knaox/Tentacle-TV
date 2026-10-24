/**
 * Octave — ce que les sockets Jellyfin des COMPTES disent de la musique,
 * appliqué à l'index et relayé aux applications (`music:library`,
 * `music:userdata`, `music:playlist`) sur le canal `/api/ws`.
 *
 * Branché en tête de `relayLibraryChanged` / `relayUserDataChanged`
 * (`services/jellyfinUserEvents.ts`) : chaque appareil connecté reçoit le
 * MÊME évènement au même instant — une copie de même contenu dans les 2 s est
 * ignorée. Les évènements se traitent un à la fois (l'index n'a qu'une
 * connexion, et un ajout suivi de son retrait doit garder cet ordre).
 *
 * Chaque compte connecté n'apprend que ce qu'il VOIT (`musicAccess.ts`) ; un
 * compte sans musique n'apprend rien.
 */

import { connectedUserIds, sendToUser } from "../../services/wsManager";
import { musicMessage } from "./musicSend";
import { filterVisible, getMusicAccess } from "../access/musicAccess";
import { applyFavoriteChanges, knownFavorite } from "../access/userFavorites";
import { forgetUserPlaylists, listUserPlaylists } from "../playlists/playlistJellyfin";
import type { MusicLibraryEvent } from "../contract/musicEvents";
import { rowsByIds } from "../index/indexQueries";
import { applyLibraryChange, syncState, type IncrementalResult } from "../index/indexSync";
import { normalizeId } from "../jellyfin/musicJellyfin";

const DUPLICATE_MS = 2_000;
const seen = new Map<string, number>();
let queue: Promise<unknown> = Promise.resolve();

function duplicate(signature: string, now: number): boolean {
  for (const [key, at] of seen) if (now - at > DUPLICATE_MS) seen.delete(key);
  if (seen.has(signature)) return true;
  seen.set(signature, now);
  return false;
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task).catch((error: unknown) => {
    console.warn(`[music] évènement Jellyfin non appliqué : ${error instanceof Error ? error.message : String(error)}`);
  });
  queue = next;
  return next;
}

/** Dit aux comptes connectés ce qu'un passage (évènement ou passage complet) a changé. */
export async function tellLibrary(result: IncrementalResult): Promise<void> {
  const entries = (rows: IncrementalResult["added"]) => rows.map((r) => ({ jellyfinId: r.id, recording: r.recordingMbid }));
  for (const userId of connectedUserIds()) {
    const access = await getMusicAccess(userId);
    if (access.mode === "none") continue;
    const event: MusicLibraryEvent = {
      type: "music:library",
      added: entries(filterVisible(access, result.added, (r) => r.id)),
      updated: entries(filterVisible(access, result.updated, (r) => r.id)),
      // Un retrait ne se juge plus (l'élément n'est plus là) : l'identifiant seul, sans rien dire de plus.
      removed: result.removed,
    };
    if (event.added.length + event.updated.length + event.removed.length > 0) sendToUser(userId, musicMessage(event));
    for (const playlistId of await playlistsSeenBy(userId, result)) sendToUser(userId, musicMessage({ type: "music:playlist", playlistId }));
  }
}

/** Les playlists touchées que CE compte voit (une playlist privée n'est connue que de lui). */
async function playlistsSeenBy(userId: string, result: IncrementalResult): Promise<string[]> {
  const candidates = [...result.playlists, ...result.unresolved];
  if (candidates.length === 0) return [];
  forgetUserPlaylists(userId);
  const visible = new Set((await listUserPlaylists(userId)).map((p) => normalizeId(p.Id)));
  return candidates.filter((id) => visible.has(id));
}

/** `LibraryChanged` d'une socket de compte. Rend la promesse de son traitement (tests). */
export function onJellyfinLibraryChanged(data: unknown, now = Date.now()): Promise<void> {
  const payload = (data ?? {}) as { ItemsAdded?: unknown; ItemsUpdated?: unknown; ItemsRemoved?: unknown };
  const added = ids(payload.ItemsAdded);
  const updated = ids(payload.ItemsUpdated);
  const removed = ids(payload.ItemsRemoved);
  if (added.length + updated.length + removed.length === 0) return Promise.resolve();
  if (duplicate(`lib:${added.join(",")}|${updated.join(",")}|${removed.join(",")}`, now)) return Promise.resolve();
  return enqueue(async () => {
    // Avant le premier passage complet, il le verra de toute façon.
    if (!syncState().ready) return;
    const result = await applyLibraryChange(added, updated, removed);
    if (result) await tellLibrary(result);
  });
}

interface UserDataEntry {
  ItemId?: unknown;
  IsFavorite?: unknown;
}

/** `UserDataChanged` d'une socket de compte : le cœur des titres de CE compte. */
export function onJellyfinUserDataChanged(data: unknown, now = Date.now()): Promise<void> {
  const payload = (data ?? {}) as { UserId?: unknown; UserDataList?: unknown };
  const userId = typeof payload.UserId === "string" ? payload.UserId : "";
  const list = Array.isArray(payload.UserDataList) ? (payload.UserDataList as UserDataEntry[]) : [];
  const changes = list
    .filter((e) => typeof e.ItemId === "string" && typeof e.IsFavorite === "boolean")
    .map((e) => ({ jellyfinId: normalizeId(e.ItemId as string), favorite: e.IsFavorite as boolean }));
  if (!userId || changes.length === 0) return Promise.resolve();
  if (duplicate(`ud:${userId}:${changes.map((c) => `${c.jellyfinId}=${c.favorite}`).join(",")}`, now)) return Promise.resolve();
  return enqueue(async () => {
    const known = await rowsByIds(changes.map((c) => c.jellyfinId));
    // Jellyfin redit toutes les données d'un élément (lecture, note…) : seul un cœur qui CHANGE se relaie.
    const music = changes.filter((c) => known.has(c.jellyfinId) && knownFavorite(userId, c.jellyfinId) !== c.favorite);
    if (music.length === 0) return;
    applyFavoriteChanges(userId, music);
    const target = connectedUserIds().find((id) => normalizeId(id) === normalizeId(userId));
    if (target) sendToUser(target, musicMessage({ type: "music:userdata", changes: music }));
  });
}

/** Un geste du cœur sur une playlist : ses lecteurs relisent (le compte qui l'a fait compris). */
export function tellPlaylistChanged(userId: string, playlistId: string): void {
  sendToUser(userId, musicMessage({ type: "music:playlist", playlistId: normalizeId(playlistId) }));
}

export function resetMusicLiveEventsForTests(): void {
  seen.clear();
  queue = Promise.resolve();
}
