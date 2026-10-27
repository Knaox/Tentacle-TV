/**
 * Octave — REMETTRE une playlist importée dans l'ordre de sa source (27/10 : une playlist importée d'Apple Music
 * avant que l'ordre de la source ne soit gardé, 59 inversions). Sans rien retirer ni dupliquer, sans redémarrer
 * Jellyfin : la fin de la playlist réécrite par lots, comme après un glisser (`reorderPlaylist`).
 *
 * L'ordre de la source : celui gardé à l'import (`music_playlist_sources`), ou la source RELUE — une adresse
 * (Apple Music, Spotify, Deezer, lue par le cœur) ou une playlist déjà lue par l'extension (YouTube). Chaque entrée
 * est reliée à son titre de la source par LA règle du cœur (`sourceBinding.ts`) ; une entrée que rien n'y relie
 * reste juste après celle qui la précédait. Le relevé est gardé AVANT la réécriture (une arrivée pendant la
 * réparation se place déjà d'après lui), puis les dates d'ajout sont oubliées : la prochaine lecture les reprend
 * du rang de chaque titre (`addedPlan.ts`, `pinned`).
 *
 * `dryRun` : le plan seul (combien de titres changent de place, ce qui n'est pas reconnu), rien d'écrit.
 */

import { recognizeImportUrl, type ImportedPlaylist } from "../contract/musicImport";
import { sourceOrdered } from "../contract/musicSourceOrder";
import { rowsByIds } from "../index/indexQueries";
import { forgetAddedDates, playlistScope } from "../listOrder/addedDates";
import { playlistEntries, playlistFor } from "../playlists/playlistJellyfin";
import { reorderPlaylist } from "../playlists/playlistService";
import type { ImportFetcher } from "../playlistImport/importFetch";
import { ImportReadFailure } from "../playlistImport/readers/readerKit";
import { readSource } from "../playlistImport/readSource";
import { bindEntries } from "./sourceBinding";
import { ranksByItem, slotsOf, type PlaylistSourceRecord, type SourceSlot } from "./sourceRecord";
import { readPlaylistSource, savePlaylistSource } from "./sourceStore";

export type RepairFailure = "not_found" | "forbidden" | "source_unknown" | "unsupported" | "source_unavailable" | "unavailable";

export interface SourceRepairPlan {
  /** Titres de la source. */
  sourceTracks: number;
  /** Entrées de la playlist. */
  entries: number;
  /** Entrées reliées à un titre de la source. */
  bound: number;
  /** Entrées qui changent de place. */
  moved: number;
  /** Les entrées que rien ne relie à la source : gardées après leur voisine d'avant. */
  unbound: { itemId: string; title: string | null }[];
  /** Les titres de la playlist dans l'ordre voulu (le nom de l'index, sinon l'identifiant). */
  order: string[];
  applied: boolean;
}

export type RepairSource = { kind: "kept" } | { kind: "url"; url: string } | { kind: "playlist"; playlist: ImportedPlaylist };

export interface RepairDeps {
  fetcher: ImportFetcher;
  now?: () => number;
}

type Outcome = { ok: true; value: SourceRepairPlan } | { ok: false; failure: RepairFailure };

async function sourceSlots(source: RepairSource, kept: PlaylistSourceRecord | null, deps: RepairDeps): Promise<{ ok: true; slots: SourceSlot[]; read: ImportedPlaylist | null; url: string | null } | { ok: false; failure: RepairFailure }> {
  if (source.kind === "kept") return kept ? { ok: true, slots: kept.slots, read: null, url: kept.url } : { ok: false, failure: "source_unknown" };
  try {
    if (source.kind === "playlist") {
      const read = await readSource(deps.fetcher, { kind: "playlist", playlist: source.playlist });
      return { ok: true, slots: slotsOf(read.tracks, new Map()), read, url: null };
    }
    const url = recognizeImportUrl(source.url);
    if (!url) return { ok: false, failure: "unsupported" };
    const read = await readSource(deps.fetcher, { kind: "url", url });
    return { ok: true, slots: slotsOf(read.tracks, new Map()), read, url: url.url };
  } catch (error) {
    return { ok: false, failure: error instanceof ImportReadFailure && error.failure === "unsupported" ? "unsupported" : "source_unavailable" };
  }
}

export async function repairSourceOrder(userId: string, playlistId: string, source: RepairSource, dryRun: boolean, deps: RepairDeps): Promise<Outcome> {
  const playlist = await playlistFor(userId, playlistId);
  if (!playlist) return { ok: false, failure: "not_found" };
  if (playlist.CanDelete !== true) return { ok: false, failure: "forbidden" };
  const kept = await readPlaylistSource(playlistId).catch(() => null);
  const read = await sourceSlots(source, kept, deps);
  if (!read.ok) return read;
  const entries = await playlistEntries(userId, playlistId);
  if (!entries) return { ok: false, failure: "unavailable" };
  const ids = entries.map((e) => e.itemId);
  const rows = await rowsByIds(ids);
  // Les liaisons d'un relevé gardé valent pour ses propres titres ; une source relue repart de la règle seule.
  const slots = bindEntries(read.slots, ids, rows);
  const created = Date.parse(playlist.DateCreated ?? "");
  const record: PlaylistSourceRecord = {
    playlistId,
    userId,
    source: read.read?.source ?? kept?.source ?? "text",
    url: read.url,
    origin: read.read ? "repair" : (kept?.origin ?? "repair"),
    importedAt: kept?.importedAt ?? (Number.isFinite(created) ? created : (deps.now ?? Date.now)()),
    slots,
  };
  const ranks = ranksByItem(record);
  const desired = sourceOrdered(entries, (e) => ranks.get(e.itemId) ?? null);
  const plan: SourceRepairPlan = {
    sourceTracks: slots.length,
    entries: entries.length,
    bound: entries.filter((e) => ranks.has(e.itemId)).length,
    moved: desired.filter((e, i) => entries[i]?.entryId !== e.entryId).length,
    unbound: entries.filter((e) => !ranks.has(e.itemId)).map((e) => ({ itemId: e.itemId, title: rows.get(e.itemId)?.name ?? null })),
    order: desired.map((e) => rows.get(e.itemId)?.name ?? e.itemId),
    applied: false,
  };
  if (dryRun) return { ok: true, value: plan };
  await savePlaylistSource(record);
  if (plan.moved > 0) {
    const written = await reorderPlaylist(userId, playlistId, desired.map((e) => e.entryId));
    if (!written.ok) return { ok: false, failure: written.failure === "invalid" ? "unavailable" : written.failure };
  }
  await forgetAddedDates(playlistScope(playlistId));
  return { ok: true, value: { ...plan, applied: true } };
}
