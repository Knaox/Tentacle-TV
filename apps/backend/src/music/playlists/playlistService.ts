/**
 * Octave — les gestes sur une playlist (une playlist EST une playlist
 * Jellyfin, contrat : rien n'est gardé ailleurs). Tout passe par la clé
 * d'administration avec `userId`, APRÈS le contrôle du droit
 * (`playlistJellyfin.ts`), un geste à la fois par playlist (la réécriture de
 * la queue ne doit pas se croiser avec une autre).
 */

import { jfAdmin, jfWrite, normalizeId, q, type JfItem } from "../jellyfin/musicJellyfin";
import { tellPlaylistChanged } from "../events/musicLiveEvents";
import { forgetUserPlaylists, playlistEntries, playlistFor } from "./playlistJellyfin";
import { chunks, insertedOrder, movedOrder, planRewrite, reorderedOrder, type PlaylistEntryRef } from "./playlistOrder";
import { forgetPlaylistOrder } from "../listOrder/listPrefsStore";

export type PlaylistFailure = "not_found" | "forbidden" | "invalid" | "unavailable";
export type PlaylistResult<T> = { ok: true; value: T } | { ok: false; failure: PlaylistFailure };

const locks = new Map<string, Promise<unknown>>();

function locked<T>(playlistId: string, task: () => Promise<T>): Promise<T> {
  const key = normalizeId(playlistId);
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  const tail = next.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return next;
}

async function editable(userId: string, playlistId: string): Promise<PlaylistFailure | null> {
  const playlist = await playlistFor(userId, playlistId);
  if (!playlist) return "not_found";
  return playlist.CanDelete === true ? null : "forbidden";
}

function done(userId: string, playlistId: string): void {
  forgetUserPlaylists();
  tellPlaylistChanged(userId, playlistId);
}

/** 100 identifiants (~3,3 Kio) par requête : sous la borne de 8 Kio de la ligne de requête de Jellyfin. */
const BATCH = 100;

/** L'ajout à la FIN, au nom du compte, par lots dans l'ordre : Jellyfin y juge ses droits (404/403). */
async function append(userId: string, playlistId: string, itemIds: string[]): Promise<PlaylistFailure | null> {
  for (const batch of chunks(itemIds, BATCH)) {
    let added = await jfWrite(`/Playlists/${q(playlistId)}/Items?ids=${batch.map(q).join(",")}&userId=${q(userId)}`, "POST");
    // Un lot refusé par une panne passagère se retente une fois : la fin retirée ne se perd pas en silence.
    if (!added.ok && added.status !== 404 && added.status !== 403 && added.status !== 401) added = await jfWrite(`/Playlists/${q(playlistId)}/Items?ids=${batch.map(q).join(",")}&userId=${q(userId)}`, "POST");
    if (!added.ok) return added.status === 404 ? "not_found" : added.status === 403 || added.status === 401 ? "forbidden" : "unavailable";
  }
  return null;
}

/**
 * Mène la playlist de `current` à `desired` : retire la fin à partir du premier
 * rang qui diffère, puis la rajoute dans l'ordre voulu (une seconde tentative si
 * le réajout échoue : la fin retirée ne se perd pas en silence).
 */
async function rewriteTo(userId: string, playlistId: string, current: PlaylistEntryRef[], desired: string[]): Promise<boolean> {
  const plan = planRewrite(current, desired);
  if (!plan) return true;
  // Sans contrôle de propriétaire chez Jellyfin : l'appelant a vérifié le droit (`editable`).
  for (const batch of chunks(plan.remove, BATCH)) {
    const removed = await jfWrite(`/Playlists/${q(playlistId)}/Items?entryIds=${batch.map(q).join(",")}`, "DELETE");
    if (!removed.ok) {
      // Ce qui est déjà retiré revient à la fin, dans l'ordre voulu : rien ne se perd.
      const gone = new Set(plan.remove.slice(0, plan.remove.indexOf(batch[0]!)));
      const goneItems = new Set(current.filter((e) => gone.has(e.entryId)).map((e) => e.itemId));
      const back = plan.append.filter((id) => goneItems.has(id));
      if (back.length > 0) await append(userId, playlistId, back);
      return false;
    }
  }
  return (await append(userId, playlistId, plan.append)) === null;
}

export async function createPlaylist(userId: string, name: string, itemIds: string[]): Promise<PlaylistResult<string>> {
  // Privée par défaut (`IsPublic: false`) : sans lui, Jellyfin l'ouvre à tous les comptes (relevé du banc).
  const result = await jfAdmin<{ Id?: string }>("/Playlists", {
    method: "POST",
    body: { Name: name, Ids: itemIds, UserId: userId, MediaType: "Audio", IsPublic: false },
  });
  if (!result.ok || !result.data.Id) return { ok: false, failure: "unavailable" };
  done(userId, result.data.Id);
  return { ok: true, value: normalizeId(result.data.Id) };
}

export function renamePlaylist(userId: string, playlistId: string, name: string): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const refusal = await editable(userId, playlistId);
    if (refusal) return { ok: false, failure: refusal };
    // `POST /Playlists/{id}` exige le jeton du compte ; la fiche de l'élément, la clé suffit.
    const item = await jfAdmin<JfItem & Record<string, unknown>>(`/Items/${q(playlistId)}?userId=${q(userId)}`);
    if (!item.ok) return { ok: false, failure: "unavailable" };
    const saved = await jfWrite(`/Items/${q(playlistId)}`, "POST", { ...item.data, Name: name });
    if (!saved.ok) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

export function deletePlaylist(userId: string, playlistId: string): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const refusal = await editable(userId, playlistId);
    if (refusal) return { ok: false, failure: refusal };
    const removed = await jfWrite(`/Items/${q(playlistId)}`, "DELETE");
    if (!removed.ok) return { ok: false, failure: "unavailable" };
    await forgetPlaylistOrder(playlistId).catch(() => undefined);
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

export function insertIntoPlaylist(userId: string, playlistId: string, itemIds: string[], position?: number): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const refusal = await editable(userId, playlistId);
    if (refusal) return { ok: false, failure: refusal };
    const before = await playlistEntries(userId, playlistId);
    if (!before) return { ok: false, failure: "unavailable" };
    const ids = itemIds.map(normalizeId);
    const desired = insertedOrder(before, ids, position);
    // L'AJOUT d'abord : Jellyfin dit si ce compte peut écrire ; refusé, rien n'a été retiré.
    const fresh = ids.filter((id) => !before.some((e) => e.itemId === id));
    const refused = await append(userId, playlistId, fresh);
    if (refused) return { ok: false, failure: refused };
    const after = await playlistEntries(userId, playlistId);
    if (!after || !(await rewriteTo(userId, playlistId, after, desired))) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

export function moveInPlaylist(userId: string, playlistId: string, entryId: string, position: number): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const refusal = await editable(userId, playlistId);
    if (refusal) return { ok: false, failure: refusal };
    const current = await playlistEntries(userId, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    if (!current.some((e) => e.entryId === entryId)) return { ok: false, failure: "not_found" };
    // `Move` de Jellyfin refuse la clé (400) : la fin se réécrit dans l'ordre voulu.
    const desired = movedOrder(current, entryId, position);
    if (desired && !(await rewriteTo(userId, playlistId, current, desired))) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

/** L'ordre COMPLET voulu par le client (glisser dans Octave), écrit dans la playlist Jellyfin elle-même. */
export function reorderPlaylist(userId: string, playlistId: string, entryIds: string[]): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const refusal = await editable(userId, playlistId);
    if (refusal) return { ok: false, failure: refusal };
    const current = await playlistEntries(userId, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    if (!(await rewriteTo(userId, playlistId, current, reorderedOrder(current, entryIds)))) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

export function removeFromPlaylist(userId: string, playlistId: string, entryId: string): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const refusal = await editable(userId, playlistId);
    if (refusal) return { ok: false, failure: refusal };
    const current = await playlistEntries(userId, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    if (!current.some((e) => e.entryId === entryId)) return { ok: false, failure: "not_found" };
    const removed = await jfWrite(`/Playlists/${q(playlistId)}/Items?entryIds=${q(entryId)}`, "DELETE");
    if (!removed.ok) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}
