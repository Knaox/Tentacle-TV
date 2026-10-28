/**
 * BANC (sauté sans copie) : la tenue à jour et la reconnaissance des titres gardés, rejouées sur une COPIE de la base
 * du bureau (`tentacle-local.db` : jamais l'original, jamais pendant que l'app tourne).
 *
 *   OCTAVE_LOCAL_DB=<copie>/tentacle-local.db \
 *   OCTAVE_RENAMES="imp:<clé>=ytm:t:<vidéo>,…" \   (ce que Sillon montre AUJOURD'HUI à la place d'une fiche)
 *   pnpm --filter @tentacle-tv/web exec vitest run src/music/octave/offline/autosync/localDbReplay.test.ts --reporter=verbose --silent=false
 *
 * Chaque playlist de la bibliothèque gardée est relue comme Jellyfin et Sillon la rendraient : ses titres de la
 * bibliothèque dans l'ordre gardé, ses titres d'ailleurs en attente à leur place (renommés selon `OCTAVE_RENAMES`).
 * La base est lue en lecture seule ; rien n'est écrit nulle part.
 */

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { listMusicCollections, listMusicForUser, type DatabaseHandle, type KeptMusicCollection, type KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicPlaylistEntry, MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import { mergePlaylist } from "@tentacle-tv/shared/octave";

const h = vi.hoisted(() => ({ list: { tracks: [] as unknown[], collections: [] as unknown[] }, userId: "" }));
vi.mock("../../../../desktop/bridge", () => ({ invoke: async () => h.list, listen: async () => () => undefined }));
vi.mock("../../../../desktop/capabilities", () => ({ supportsMusicOffline: () => true }));
vi.mock("../../../../offline/offlineOwner", () => ({ readOfflineOwner: () => ({ userId: h.userId, token: "jeton" }) }));

import { keptMusicState, refreshKeptMusic, setKeptRenames } from "../keptMusicStore";
import { renamesOf, shownToFormer, planSync, type SyncActions } from "@tentacle-tv/offline-core/music";

const FILE = process.env["OCTAVE_LOCAL_DB"];
const RENAMES = new Map((process.env["OCTAVE_RENAMES"] ?? "").split(",").filter(Boolean).map((pair) => pair.split("=") as [string, string]));

function load(): { userId: string; tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] } {
  const db = new DatabaseSync(FILE!, { readOnly: true });
  try {
    const row = db.prepare("SELECT jellyfin_user_id AS u FROM music_collections WHERE kind = 'playlist' LIMIT 1").get() as { u: string };
    const handle = db as unknown as DatabaseHandle;
    return { userId: row.u, tracks: listMusicForUser(handle, row.u), collections: listMusicCollections(handle, row.u) };
  } finally {
    db.close();
  }
}

const trackOf = (kept: readonly KeptMusicTrack[], key: string): MusicTrack => JSON.parse(kept.find((k) => k.trackKey === key)?.trackJson ?? "null") as MusicTrack;

/** La playlist telle que Jellyfin (titres de la bibliothèque) et Sillon (attentes, renommées) la rendraient. */
function replayed(c: KeptMusicCollection, kept: readonly KeptMusicTrack[], formerIds: boolean): { entries: MusicPlaylistEntry[]; pending: PendingMusicItem[] } {
  const entries: MusicPlaylistEntry[] = [];
  const pending: PendingMusicItem[] = [];
  const id = c.key.slice("playlist:jf:".length);
  c.trackKeys.forEach((key, i) => {
    const t = trackOf(kept, key);
    if (key.startsWith("jf:")) return void entries.push({ entryId: `e${i}`, position: entries.length, track: t });
    const former = t.external!.id;
    const now = RENAMES.get(former) ?? former;
    const track = now === former ? t : { ...t, key: `ext:${t.external!.pluginId}:${now}`, external: { pluginId: t.external!.pluginId, id: now } };
    pending.push({
      operationId: `op${i}`, externalId: now, kind: "playlistAdd", playlistId: id, position: entries.length, track, state: "pending",
      createdAt: i, imported: true, ...(formerIds && now !== former ? { formerIds: [former] } : {}),
    });
  });
  return { entries, pending };
}

function pass(state: ReturnType<typeof load>, mode: "jellyfinOnly" | "withPending" | "withFormerIds"): SyncActions {
  const playlists = new Map<string, MusicTrack[]>();
  let twins = new Map<string, MusicTrack>();
  for (const c of state.collections.filter((x) => x.key.startsWith("playlist:jf:"))) {
    const { entries, pending } = replayed(c, state.tracks, mode === "withFormerIds");
    playlists.set(c.key, mode === "jellyfinOnly" ? entries.map((e) => e.track) : mergePlaylist(entries, pending, c.key.slice(12)).map((r) => r.track));
    twins = new Map([...twins, ...renamesOf(pending)]);
  }
  return planSync({ kept: state.tracks, collections: state.collections, playlists, twins, wanted: new Map(), canKeep: () => true });
}

const titles = (state: ReturnType<typeof load>, fileIds: readonly number[]) => fileIds.map((id) => state.tracks.find((t) => t.fileId === id)).map((t) => `${t?.fileId} ${t?.trackKey} « ${t?.title} »`);

describe.skipIf(!FILE)("banc — une copie de la base du bureau", () => {
  it("rejoue la tenue à jour et la reconnaissance des titres renommés", async () => {
    const state = load();
    const externals = state.tracks.filter((t) => t.origin === "external" && t.status === "complete");
    const before = pass(state, "jellyfinOnly");
    const old = pass(state, "withPending");
    const after = pass(state, "withFormerIds");
    console.log(`[banc] ${state.tracks.length} copies (${externals.length} hors bibliothèque), ${state.collections.length} collections`);
    console.log(`[banc] lecture d'avant (Jellyfin seul) : ${before.removeFileIds.length} copie(s) effacée(s)`);
    console.log(`[banc] avec les attentes, Sillon d'avant : retire ${JSON.stringify(titles(state, old.removeFileIds))}, garde ${JSON.stringify(old.keep.map((t) => t.key))}`);
    console.log(`[banc] avec les attentes et formerIds : retire ${JSON.stringify(titles(state, after.removeFileIds))}, garde ${JSON.stringify(after.keep.map((t) => t.key))}`);
    for (const c of after.saveCollections) console.log(`[banc] collection ${c.key} : ${c.trackKeys.length} titres, ${new Set(c.trackKeys).size} distincts`);

    // Ni la lecture avec les attentes, ni les identités d'hier n'effacent un titre d'ailleurs que rien ne remplace.
    const replaced = new Set([...RENAMES.keys()].map((id) => state.tracks.find((t) => t.trackKey.endsWith(`:${id}`))?.fileId));
    expect(after.removeFileIds.every((id) => replaced.has(id))).toBe(true);
    for (const c of after.saveCollections) expect(new Set(c.trackKeys).size).toBe(c.trackKeys.length);

    // La reconnaissance (marque, « titres qui manquent », lecture) : chaque clé d'aujourd'hui mène à une copie.
    h.userId = state.userId;
    h.list = { tracks: state.tracks, collections: state.collections };
    await refreshKeptMusic();
    const pendingNow = state.collections.filter((c) => c.key.startsWith("playlist:jf:")).flatMap((c) => replayed(c, state.tracks, true).pending);
    setKeptRenames(shownToFormer(renamesOf(pendingNow)));
    for (const item of pendingNow) {
      const copy = keptMusicState().byKey.get(item.track.key);
      console.log(`[banc] montré ${item.track.key} → copie ${copy ? `${copy.fileId} (${copy.trackKey}, ${copy.status})` : "AUCUNE"}`);
      expect(copy?.status).toBe("complete");
    }
  });
});
