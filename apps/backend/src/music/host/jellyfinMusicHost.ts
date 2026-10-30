/**
 * Octave — l'API d'hôte `jellyfin.*` des extensions musique (contrat
 * `HostApi` de packages/shared/src/plugins/pluginServerRuntime.ts), mêmes
 * paramètres, mêmes résultats. Le runtime isolé (agent 5) n'a qu'à les
 * appeler : la musique de la bibliothèque ne se fait qu'ICI, une fois.
 *
 * Un refus lève une `HostMusicFailure` portant le code de `HostCallError`
 * (`invalid`, `notFound`, `forbidden`, `unavailable`).
 */

import { writeFavorite } from "../access/userFavorites";
import { sendToUser } from "../../services/wsManager";
import { musicMessage } from "../events/musicSend";
import { rowsByIds, tracksByRecording } from "../index/indexQueries";
import { normalizeMbid } from "../contract/musicKeys";
import { audioRef } from "../index/indexSync";
import { isJellyfinId, jfAdmin, jfWrite, normalizeId, q, type JfItemsPage } from "../jellyfin/musicJellyfin";
import { getMusicLibrary } from "../jellyfin/musicLibrary";
import { listUserPlaylists, playlistEntries as entriesOf } from "../playlists/playlistJellyfin";
import { accessAllows, playlistAccess } from "../playlistMembers/playlistAccess";
import { insertFromHost, markSourceRemoved } from "../playlistSource/sourcePlacement";
import type { AudioItemRef } from "../events/audioItemsFeed";
import { isAdminUser, listUserIds } from "./hostUsers";
import { isLibraryPath, refreshContaining } from "./folderRefresh";
import { indexArrivalsUnder, lookupRecentArrivals } from "../events/folderArrivals";
import type { MusicMatchTrackQuery } from "../contract/musicCoreApi";
import { matchTracks as matchTrackRows } from "../view/matchViews";
import { tracksOf, userView, visibleRows } from "../view/viewContext";
import type { MusicTrack } from "../contract/musicTypes";

export class HostMusicFailure extends Error {
  constructor(
    readonly code: "invalid" | "notFound" | "forbidden" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

export interface PlaylistUsage {
  playlistId: string;
  ownerUserId: string;
  entryId: string;
  position: number;
}

function ids(values: unknown, max = 500): string[] {
  if (!Array.isArray(values) || values.length > max || !values.every(isJellyfinId)) throw new HostMusicFailure("invalid", "identifiants Jellyfin attendus");
  return (values as string[]).map(normalizeId);
}

export async function musicLibrary(): Promise<{ libraryId: string; name: string; paths: string[] } | null> {
  return getMusicLibrary();
}

export async function findByMbid(params: { recordings: string[] }): Promise<AudioItemRef[]> {
  if (!Array.isArray(params.recordings) || params.recordings.length > 500) throw new HostMusicFailure("invalid", "recordings");
  const mbids = [...new Set(params.recordings.map(normalizeMbid).filter((m): m is string => m !== null))];
  let rows = await tracksByRecording(mbids);
  // Le filet : un MBID que l'index ignore encore (Jellyfin le voit, `LibraryChanged` n'est pas arrivé) —
  // relecture BORNÉE des dossiers rafraîchis et des derniers ajouts, puis l'index une seconde fois.
  if (new Set(rows.map((r) => r.recordingMbid)).size < mbids.length) {
    await lookupRecentArrivals();
    rows = await tracksByRecording(mbids);
  }
  if (rows.length === 0) return [];
  // Le chemin n'est pas dans l'index : Jellyfin le dit (une requête, champs minimaux).
  const listed = await jfAdmin<JfItemsPage>(`/Items?Ids=${rows.map((r) => q(r.id)).join(",")}&Fields=ProviderIds,Path&EnableImages=false&EnableUserData=false`);
  if (!listed.ok) throw new HostMusicFailure("unavailable", "Jellyfin muet");
  return (listed.data.Items ?? []).map(audioRef);
}

/**
 * Ce que la bibliothèque de CE compte a parmi ces titres : LA règle de `POST /api/music/match` (MBID, sinon titre +
 * artiste + durée), sur l'index local et les droits du compte — jamais une requête Jellyfin par titre. Une
 * extension y reconnaît un titre sans MBID, ou d'un autre enregistrement, que `findByMbid` ne voit pas (26/10).
 */
export async function matchTracks(params: { userId: string; tracks: MusicMatchTrackQuery[] }): Promise<{ ref: string; item: AudioItemRef }[]> {
  const [userId] = ids([params.userId]);
  if (!Array.isArray(params.tracks) || params.tracks.length === 0 || params.tracks.length > 200) throw new HostMusicFailure("invalid", "tracks");
  const view = await userView(userId!);
  if (view.access.mode === "none") return [];
  const found = await matchTrackRows(view, params.tracks);
  return [...found].map(([ref, row]) => ({ ref, item: { jellyfinId: row.id, recording: row.recordingMbid, release: row.releaseMbid, path: null } }));
}

/** Le titre de la bibliothèque tel que CE compte le voit (`music:resolved` relayé par le cœur) ; `null` sinon. */
export async function libraryTrackFor(userId: string, jellyfinId: string): Promise<MusicTrack | null> {
  if (!isJellyfinId(userId) || !isJellyfinId(jellyfinId)) return null;
  const view = await userView(normalizeId(userId));
  const row = (await rowsByIds([normalizeId(jellyfinId)])).get(normalizeId(jellyfinId));
  const [track] = row ? await tracksOf(view, visibleRows(view, [row])) : [];
  return track ?? null;
}

export async function setFavorite(params: { userId: string; itemId: string; favorite: boolean }): Promise<{ ok: true }> {
  const [userId, itemId] = ids([params.userId, params.itemId]);
  if (typeof params.favorite !== "boolean") throw new HostMusicFailure("invalid", "favorite");
  if (!(await writeFavorite(userId!, itemId!, params.favorite))) throw new HostMusicFailure("unavailable", "favori refusé par Jellyfin");
  sendToUser(userId!, musicMessage({ type: "music:userdata", changes: [{ jellyfinId: itemId!, favorite: params.favorite }] }));
  return { ok: true };
}

/**
 * Une playlist IMPORTÉE (relevé de l'ordre de sa source) : le titre entre à SA place dans l'ordre de la source
 * (`sourceIndex`, sinon le titre qu'il est), `position` n'étant qu'un repli (`playlistSource/sourcePlacement.ts`).
 */
export async function playlistInsert(params: { userId: string; playlistId: string; itemIds: string[]; position: number; sourceIndex?: number; addedAt?: number }): Promise<{ ok: true; position: number }> {
  const [userId, playlistId] = ids([params.userId, params.playlistId]);
  const itemIds = ids(params.itemIds);
  if (itemIds.length === 0 || !Number.isInteger(params.position) || params.position < 0) throw new HostMusicFailure("invalid", "itemIds / position");
  if (params.sourceIndex !== undefined && (!Number.isInteger(params.sourceIndex) || params.sourceIndex < 0)) throw new HostMusicFailure("invalid", "sourceIndex");
  if (params.addedAt !== undefined && (!Number.isInteger(params.addedAt) || params.addedAt < 0)) throw new HostMusicFailure("invalid", "addedAt");
  const result = await insertFromHost(userId!, playlistId!, itemIds, params.position, params.sourceIndex, params.addedAt);
  if (result.ok) return { ok: true, position: result.value };
  throw new HostMusicFailure(result.failure === "not_found" ? "notFound" : result.failure === "invalid" ? "invalid" : result.failure, "playlist");
}

/**
 * L'utilisateur a retiré de sa playlist importée l'entrée de l'extension qui tenait le titre de rang `sourceIndex` :
 * le relevé le garde retiré (`playlistSource/sourceArrivals.ts` ne l'y remet jamais). Le droit d'y ajouter est exigé.
 */
export async function playlistSourceRemoved(params: { userId: string; playlistId: string; sourceIndex: number }): Promise<{ ok: true; marked: boolean }> {
  const [userId, playlistId] = ids([params.userId, params.playlistId]);
  if (!Number.isInteger(params.sourceIndex) || params.sourceIndex < 0) throw new HostMusicFailure("invalid", "sourceIndex");
  const access = await playlistAccess(userId!, playlistId!);
  if (!access || !accessAllows(access.right, "add")) throw new HostMusicFailure("forbidden", "playlist");
  return { ok: true, marked: await markSourceRemoved(playlistId!, params.sourceIndex) };
}

export async function playlistEntries(params: { userId: string; playlistId: string }): Promise<{ entryId: string; itemId: string; position: number }[]> {
  const [userId, playlistId] = ids([params.userId, params.playlistId]);
  // Un membre d'une playlist partagée la lit au nom de son propriétaire (`playlistMembers/playlistAccess.ts`).
  const access = await playlistAccess(userId!, playlistId!);
  const entries = await entriesOf(access?.readerId ?? userId!, playlistId!);
  if (!entries) throw new HostMusicFailure("unavailable", "Jellyfin muet");
  return entries.map((e, position) => ({ ...e, position }));
}

/**
 * Ce compte peut-il AJOUTER à cette playlist ? La règle de `playlistService` (`playlistAccess.ts` : la sienne, ou
 * partagée avec « ajouter ») : une extension ne pose rien ailleurs (import de playlists, entrées hors bibliothèque).
 */
export async function playlistEditable(params: { userId: string; playlistId: string }): Promise<{ editable: boolean }> {
  const [userId, playlistId] = ids([params.userId, params.playlistId]);
  // Un membre qui peut AJOUTER y pose aussi ses titres hors bibliothèque (le droit tenu par Tentacle).
  const access = await playlistAccess(userId!, playlistId!);
  return { editable: !!access && accessAllows(access.right, "add") };
}

/**
 * Qui a ces éléments en favori, et où ils sont dans quelles playlists (de leur
 * PROPRIÉTAIRE : `CanDelete`) — pour reposer les deux sur l'élément qui les
 * remplace. Une requête par compte et par playlist possédée : un geste rare
 * (mise à niveau d'un fichier), jamais sur le chemin d'une lecture.
 */
export async function usageOf(params: { itemIds: string[] }): Promise<{ itemId: string; favoriteUserIds: string[]; playlists: PlaylistUsage[] }[]> {
  const wanted = ids(params.itemIds, 200);
  const out = new Map(wanted.map((id) => [id, { itemId: id, favoriteUserIds: [] as string[], playlists: [] as PlaylistUsage[] }]));
  const users = await listUserIds();
  const seenPlaylists = new Set<string>();
  for (const userId of users) {
    const favs = await jfAdmin<JfItemsPage>(`/Items?userId=${q(userId)}&Ids=${wanted.map(q).join(",")}&IsFavorite=true&Fields=&EnableImages=false`);
    if (!favs.ok) throw new HostMusicFailure("unavailable", "Jellyfin muet");
    for (const item of favs.data.Items ?? []) out.get(normalizeId(item.Id))?.favoriteUserIds.push(userId);
    // Un administrateur peut supprimer la playlist publique d'un autre : son propriétaire passe d'abord.
    if (await isAdminUser(userId)) continue;
    await collectPlaylists(userId, out, seenPlaylists);
  }
  for (const userId of users) if (await isAdminUser(userId)) await collectPlaylists(userId, out, seenPlaylists);
  return [...out.values()];
}

async function collectPlaylists(userId: string, out: Map<string, { playlists: PlaylistUsage[] }>, seen: Set<string>): Promise<void> {
  for (const playlist of await listUserPlaylists(userId)) {
    const id = normalizeId(playlist.Id);
    if (playlist.CanDelete !== true || seen.has(id)) continue;
    seen.add(id);
    const entries = (await entriesOf(userId, id)) ?? [];
    entries.forEach((entry, position) => {
      out.get(entry.itemId)?.playlists.push({ playlistId: id, ownerUserId: userId, entryId: entry.entryId, position });
    });
  }
}

const UPDATE_TYPES = { created: "Created", modified: "Modified", deleted: "Deleted" } as const;

/** Prévient Jellyfin qu'un chemin de SA bibliothèque musique a changé — jamais un chemin d'ailleurs. */
export async function notifyPath(params: { path: string; change: "created" | "modified" | "deleted" }): Promise<{ ok: true }> {
  const library = await getMusicLibrary();
  if (!library) throw new HostMusicFailure("notFound", "aucune bibliothèque musique");
  const path = typeof params.path === "string" ? params.path : "";
  const type = UPDATE_TYPES[params.change];
  if (!type || path.includes("..") || !library.paths.some((root) => path === root || path.startsWith(`${root.replace(/[\\/]+$/, "")}/`))) {
    throw new HostMusicFailure("forbidden", "chemin hors de la bibliothèque musique");
  }
  const sent = await jfWrite("/Library/Media/Updated", "POST", { Updates: [{ Path: path, UpdateType: type }] });
  if (!sent.ok) throw new HostMusicFailure("unavailable", "Jellyfin muet");
  return { ok: true };
}

/**
 * Fait voir TOUT DE SUITE à Jellyfin un dossier de SA bibliothèque musique
 * (`folderRefresh.ts`) : le dossier connu le plus proche, récursivement. Un
 * chemin hors de la bibliothèque musique est `invalid` ; une extension garde
 * `notifyPath` en repli face à un hôte d'avant.
 */
export async function refreshPath(params: { path: string }): Promise<{ ok: true; scope: "folder" | "library"; itemId: string }> {
  const library = await getMusicLibrary();
  if (!library) throw new HostMusicFailure("notFound", "aucune bibliothèque musique");
  const path = typeof params.path === "string" ? params.path : "";
  if (!isLibraryPath(library, path)) throw new HostMusicFailure("invalid", "chemin hors de la bibliothèque musique");
  const result = await refreshContaining(library, path);
  if (!result.ok) throw new HostMusicFailure("unavailable", "Jellyfin muet");
  // L'index n'attend pas `LibraryChanged` (30 s par défaut) : le dossier rafraîchi s'indexe dès qu'il a ses éléments.
  if (result.itemId !== library.libraryId) void indexArrivalsUnder(result.itemId).catch(() => undefined);
  return { ok: true, scope: result.scope, itemId: result.itemId };
}
