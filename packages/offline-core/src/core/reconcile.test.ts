import { describe, expect, it } from "vitest";
import type { DatabaseHandle } from "./adapters";
import { openInMemory } from "../node/nodeDatabase";
import { setAutoDelete } from "./listing";
import { markItemSynced, pendingReports, setPlaybackState } from "./playback";
import { applyServerUserData, completeItemIds, parseUserDataItems, pruneReportQueue } from "./reconcile";
import { claimOrCreateFile } from "./store";
import { setStatus } from "./queue";
import { spec } from "./testkit";

const NOW = 2_000_000;
const NONE = new Set<string>();

function local(db: DatabaseHandle, itemId = "item1") {
  const row = db.prepare("SELECT position_ticks AS p, played AS v, updated_at AS u FROM playback_state WHERE item_id = ?").get(itemId);
  return row === undefined ? null : { position: Number(row.p), played: Number(row.v) === 1, updatedAt: Number(row.u) };
}

describe("parseUserDataItems", () => {
  it("lit Items, UserData et la date ; ignore ce qui n'a pas d'identifiant", () => {
    const parsed = parseUserDataItems({
      Items: [
        { Id: "a", UserData: { Played: true, PlaybackPositionTicks: 0, LastPlayedDate: "2026-09-06T10:00:00.000Z" } },
        { Id: "b", UserData: { Played: false, PlaybackPositionTicks: 1234 } },
        { UserData: { Played: true } },
        { Id: "c", UserData: { PlaybackPositionTicks: -5, LastPlayedDate: "pas une date" } },
      ],
    });
    expect(parsed).toEqual([
      { itemId: "a", played: true, positionTicks: 0, lastPlayedAtMs: Date.parse("2026-09-06T10:00:00.000Z") },
      { itemId: "b", played: false, positionTicks: 1234, lastPlayedAtMs: null },
      { itemId: "c", played: false, positionTicks: 0, lastPlayedAtMs: null },
    ]);
  });

  it("accepte une liste nue et ne lève jamais", () => {
    expect(parseUserDataItems([{ Id: "x" }])).toEqual([{ itemId: "x", played: false, positionTicks: 0, lastPlayedAtMs: null }]);
    expect(parseUserDataItems(null)).toEqual([]);
    expect(parseUserDataItems("n'importe quoi")).toEqual([]);
  });
});

describe("applyServerUserData", () => {
  it("applique un état serveur plus récent, position et vu compris", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 100, false, false, 1_000);
    const changed = applyServerUserData(db, "u", [{ itemId: "item1", played: false, positionTicks: 900, lastPlayedAtMs: 5_000 }], NOW, { pendingItemIds: NONE });
    expect(changed).toEqual(["item1"]);
    expect(local(db)).toEqual({ position: 900, played: false, updatedAt: 5_000 });
  });

  it("ignore un état serveur plus ancien ou sans date", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 100, false, false, 9_000);
    expect(applyServerUserData(db, "u", [{ itemId: "item1", played: true, positionTicks: 0, lastPlayedAtMs: 5_000 }], NOW, { pendingItemIds: NONE })).toEqual([]);
    expect(applyServerUserData(db, "u", [{ itemId: "item1", played: false, positionTicks: 300, lastPlayedAtMs: null }], NOW, { pendingItemIds: NONE })).toEqual([]);
    expect(local(db)).toEqual({ position: 100, played: false, updatedAt: 9_000 });
  });

  it("crée la ligne d'un titre vu ailleurs, jamais celle d'un serveur muet", () => {
    const db = openInMemory();
    expect(applyServerUserData(db, "u", [{ itemId: "vide", played: false, positionTicks: 0, lastPlayedAtMs: null }], NOW, { pendingItemIds: NONE })).toEqual([]);
    expect(local(db, "vide")).toBeNull();
    expect(applyServerUserData(db, "u", [{ itemId: "vu", played: true, positionTicks: 0, lastPlayedAtMs: 7_000 }], NOW, { pendingItemIds: NONE })).toEqual(["vu"]);
    expect(local(db, "vu")).toEqual({ position: 0, played: true, updatedAt: 7_000 });
  });

  it("suit un « marquer non vu » du web, sauf si un rapport attend en file", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 0, true, false, 1_000);
    const unmarked = { itemId: "item1", played: false, positionTicks: 0, lastPlayedAtMs: null };
    expect(applyServerUserData(db, "u", [unmarked], NOW, { pendingItemIds: new Set(["item1"]) })).toEqual([]);
    expect(local(db)?.played).toBe(true);
    expect(applyServerUserData(db, "u", [unmarked], NOW, { pendingItemIds: NONE })).toEqual(["item1"]);
    expect(local(db)).toEqual({ position: 0, played: false, updatedAt: NOW });
  });

  it("arme l'auto-suppression à la bascule vers vu, la lève à l'inverse", () => {
    const db = openInMemory();
    const { fileId } = claimOrCreateFile(db, spec({ autoDeleteAfterWatch: true }));
    setAutoDelete(db, "u", fileId, true, 30, 1_000);
    const deadline = () => db.prepare("SELECT delete_scheduled_at AS d FROM claims WHERE file_id = ?").get(fileId)?.d;

    applyServerUserData(db, "u", [{ itemId: "item1", played: true, positionTicks: 0, lastPlayedAtMs: 5_000 }], NOW, { pendingItemIds: NONE });
    expect(Number(deadline())).toBe(Math.floor(NOW / 1000) + 30 * 60);

    applyServerUserData(db, "u", [{ itemId: "item1", played: false, positionTicks: 0, lastPlayedAtMs: null }], NOW + 1, { pendingItemIds: NONE });
    expect(deadline()).toBeNull();
    expect(local(db)?.played).toBe(false);
  });

  it("ne touche ni un autre compte ni la file de rapports", () => {
    const db = openInMemory();
    setPlaybackState(db, "autre", "item1", 50, false, false, 1_000);
    applyServerUserData(db, "u", [{ itemId: "item1", played: true, positionTicks: 0, lastPlayedAtMs: 5_000 }], NOW, { pendingItemIds: NONE });
    const other = db.prepare("SELECT played AS v FROM playback_state WHERE jellyfin_user_id = 'autre'").get();
    expect(Number(other?.v)).toBe(0);
    expect(Number(db.prepare("SELECT COUNT(*) AS n FROM report_queue").get()?.n)).toBe(0);
  });
});

describe("completeItemIds", () => {
  it("ne compte que les fichiers complets du compte", () => {
    const db = openInMemory();
    const a = claimOrCreateFile(db, spec()).fileId;
    setStatus(db, a, "complete", null, 1_000);
    claimOrCreateFile(db, spec({ itemId: "item2", mediaSourceId: "ms2", relPath: "media/item2/o.mkv" }));
    const c = claimOrCreateFile(db, spec({ userId: "autre", itemId: "item3", mediaSourceId: "ms3", relPath: "media/item3/o.mkv" })).fileId;
    setStatus(db, c, "complete", null, 1_000);
    expect(completeItemIds(db, "u")).toEqual(["item1"]);
  });
});

describe("pruneReportQueue", () => {
  it("supprime les rapports synchronisés anciens et les doublons non synchronisés", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 10, false, true, 1_000);
    setPlaybackState(db, "u", "item1", 20, false, true, 2_000);
    setPlaybackState(db, "u", "item1", 30, false, true, 3_000);
    setPlaybackState(db, "u", "item2", 5, false, true, 4_000);
    setPlaybackState(db, "u", "item2", 6, false, true, 5_000);
    markItemSynced(db, "u", "item2", 999);

    const removed = pruneReportQueue(db, "u", 4_500);
    // item1 : deux doublons non synchronisés partent, le plus récent reste ;
    // item2 : le rapport synchronisé d'avant 4 500 part, l'autre reste.
    expect(removed).toBe(3);
    expect(pendingReports(db, "u").map((r) => r.positionTicks)).toEqual([30]);
    expect(Number(db.prepare("SELECT COUNT(*) AS n FROM report_queue").get()?.n)).toBe(2);
  });
});
