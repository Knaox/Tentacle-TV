/**
 * Octave — les gestes sur une playlist (une playlist EST une playlist
 * Jellyfin, contrat : rien n'est gardé ailleurs). Tout passe par la clé
 * d'administration avec `userId`, APRÈS le contrôle du droit
 * (`playlistJellyfin.ts`), un geste à la fois par playlist (la réécriture de
 * la queue ne doit pas se croiser avec une autre).
 */

import { jfAdmin, jfWrite, normalizeId, q, type JfItem } from "../jellyfin/musicJellyfin";
import { tellPlaylistChanged } from "../events/musicLiveEvents";
import { forgetUserPlaylists, playlistEntries } from "./playlistJellyfin";
import { chunks, insertedOrder, movedOrder, planRewrite, reorderedOrder, type PlaylistEntryRef } from "./playlistOrder";
import { forgetPlaylistOrder } from "../listOrder/listPrefsStore";
import { forgetPlaylistSource } from "../playlistSource/sourceStore";
import { forgetPlaylistShares } from "../playlistShare/shareStore";
import { accessAllows, isShared, playlistAccess, type PlaylistGesture } from "../playlistMembers/playlistAccess";
import { forgetPlaylistMembers } from "../playlistMembers/memberStore";
import { tellPlaylistPeople } from "../playlistMembers/memberEvents";

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

interface Authorized {
  /** Le compte au nom duquel Jellyfin est lu et écrit (le propriétaire, pour un membre). */
  actor: string;
  /** Une playlist partagée : son ordre est à chacun, Jellyfin n'est jamais réordonné. */
  shared: boolean;
}

/** Le droit vérifié AVANT tout geste (`playlistAccess.ts`) : la clé d'administration, elle, ne contrôle rien. */
async function authorize(userId: string, playlistId: string, gesture: PlaylistGesture): Promise<Authorized | PlaylistFailure> {
  const access = await playlistAccess(userId, playlistId);
  if (!access) return "not_found";
  if (!accessAllows(access.right, gesture)) return "forbidden";
  return { actor: access.readerId, shared: await isShared(playlistId) };
}

/** Le propriétaire et chacun des membres relisent la playlist ; `also` : des comptes qui n'en sont plus (déjà retirés). */
function done(userId: string, playlistId: string, also: readonly string[] = []): void {
  forgetUserPlaylists();
  for (const account of new Set([userId, ...also])) tellPlaylistChanged(account, playlistId);
  void tellPlaylistPeople(playlistId, [userId, ...also]);
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
  // Sans contrôle de propriétaire chez Jellyfin : l'appelant a vérifié le droit (`authorize`).
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

export interface PlaylistDetailsChange {
  name?: string;
  /** `""` efface la description. */
  description?: string;
}

/** Le nom et/ou la description (Jellyfin `Overview`) : la fiche de l'élément, relue puis réécrite entière. */
export function updatePlaylistDetails(userId: string, playlistId: string, change: PlaylistDetailsChange): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "manage");
    if (typeof auth === "string") return { ok: false, failure: auth };
    // `POST /Playlists/{id}` exige le jeton du compte ; la fiche de l'élément, la clé suffit.
    const item = await jfAdmin<JfItem & Record<string, unknown>>(`/Items/${q(playlistId)}?userId=${q(userId)}`);
    if (!item.ok) return { ok: false, failure: "unavailable" };
    const next = { ...item.data, ...(change.name !== undefined && { Name: change.name }), ...(change.description !== undefined && { Overview: change.description }) };
    const saved = await jfWrite(`/Items/${q(playlistId)}`, "POST", next);
    if (!saved.ok) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

export function deletePlaylist(userId: string, playlistId: string): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "manage");
    if (typeof auth === "string") return { ok: false, failure: auth };
    const removed = await jfWrite(`/Items/${q(playlistId)}`, "DELETE");
    if (!removed.ok) return { ok: false, failure: "unavailable" };
    await forgetPlaylistOrder(playlistId).catch(() => undefined);
    await forgetPlaylistSource(playlistId).catch(() => undefined);
    // Le lien de partage d'une playlist supprimée ne sert plus rien : il part avec elle.
    await forgetPlaylistShares(playlistId).catch(() => undefined);
    // Ses membres la perdent aussi : chacun relit sa liste.
    const members = await forgetPlaylistMembers(playlistId).catch(() => []);
    done(userId, playlistId, members);
    return { ok: true, value: true };
  });
}

export function insertIntoPlaylist(userId: string, playlistId: string, itemIds: string[], position?: number): Promise<PlaylistResult<true>> {
  return insertAt(userId, playlistId, itemIds, () => position).then((result) => (result.ok ? { ok: true, value: true } : result));
}

/**
 * Insère `itemIds` à la place que `place` choisit d'après la playlist TELLE QU'ELLE EST (absente : la fin), sous le
 * verrou de la playlist — deux insertions ne se croisent jamais ; `settled` aussi, une fois l'insertion écrite
 * (l'ordre de la source d'une playlist importée y garde sa liaison). Rend la place prise.
 */
export function insertAt(
  userId: string,
  playlistId: string,
  itemIds: string[],
  place: (before: readonly PlaylistEntryRef[]) => Promise<number | undefined> | number | undefined,
  settled?: (position: number) => Promise<void>,
): Promise<PlaylistResult<number>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "add");
    if (typeof auth === "string") return { ok: false, failure: auth };
    const { actor, shared } = auth;
    const before = await playlistEntries(actor, playlistId);
    if (!before) return { ok: false, failure: "unavailable" };
    const ids = itemIds.map(normalizeId);
    // Partagée : chaque ajout entre au BOUT (l'ordre est à chacun), rien de déjà là ne bouge.
    const desired = shared ? null : insertedOrder(before, ids, await place(before));
    // L'AJOUT d'abord : Jellyfin dit si ce compte peut écrire ; refusé, rien n'a été retiré.
    const fresh = ids.filter((id) => !before.some((e) => e.itemId === id));
    const refused = await append(actor, playlistId, fresh);
    if (refused) return { ok: false, failure: refused };
    const after = await playlistEntries(actor, playlistId);
    if (!after || (desired && !(await rewriteTo(actor, playlistId, after, desired)))) return { ok: false, failure: "unavailable" };
    const at = Math.max(0, (desired ?? after.map((e) => e.itemId)).indexOf(ids[0]!));
    await settled?.(at);
    done(userId, playlistId);
    return { ok: true, value: at };
  });
}

export function moveInPlaylist(userId: string, playlistId: string, entryId: string, position: number): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "manage");
    if (typeof auth === "string") return { ok: false, failure: auth };
    const current = await playlistEntries(auth.actor, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    if (!current.some((e) => e.entryId === entryId)) return { ok: false, failure: "not_found" };
    // Partagée : l'ordre est à chacun (sa préférence de liste), Jellyfin ne bouge pas.
    if (auth.shared) return { ok: true, value: true };
    // `Move` de Jellyfin refuse la clé (400) : la fin se réécrit dans l'ordre voulu.
    const desired = movedOrder(current, entryId, position);
    if (desired && !(await rewriteTo(auth.actor, playlistId, current, desired))) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

/**
 * Sous le verrou de la playlist : lire ses entrées, en tirer l'ordre voulu (`plan` : les éléments dans l'ordre, ou
 * `null` pour ne rien écrire — il peut garder ce qu'il en a appris), puis l'écrire. Aucune insertion ne s'y croise.
 */
export function rewritePlaylist(userId: string, playlistId: string, plan: (current: readonly PlaylistEntryRef[]) => Promise<string[] | null>): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "manage");
    if (typeof auth === "string") return { ok: false, failure: auth };
    const current = await playlistEntries(auth.actor, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    const desired = await plan(current);
    if (desired && !(await rewriteTo(auth.actor, playlistId, current, desired))) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

/** L'ordre COMPLET voulu par le client (glisser dans Octave), écrit dans la playlist Jellyfin elle-même. */
export function reorderPlaylist(userId: string, playlistId: string, entryIds: string[]): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "manage");
    if (typeof auth === "string") return { ok: false, failure: auth };
    // Partagée : l'ordre glissé ne vaut que pour celui qui l'a glissé (sa préférence de liste, déjà gardée).
    if (auth.shared) return { ok: true, value: true };
    const current = await playlistEntries(auth.actor, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    if (!(await rewriteTo(auth.actor, playlistId, current, reorderedOrder(current, entryIds)))) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}

export function removeFromPlaylist(userId: string, playlistId: string, entryId: string): Promise<PlaylistResult<true>> {
  return locked(playlistId, async () => {
    const auth = await authorize(userId, playlistId, "remove");
    if (typeof auth === "string") return { ok: false, failure: auth };
    const current = await playlistEntries(auth.actor, playlistId);
    if (!current) return { ok: false, failure: "unavailable" };
    if (!current.some((e) => e.entryId === entryId)) return { ok: false, failure: "not_found" };
    const removed = await jfWrite(`/Playlists/${q(playlistId)}/Items?entryIds=${q(entryId)}`, "DELETE");
    if (!removed.ok) return { ok: false, failure: "unavailable" };
    done(userId, playlistId);
    return { ok: true, value: true };
  });
}
