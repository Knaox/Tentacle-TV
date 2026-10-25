import { describe, expect, it } from "vitest";
import type { MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { applyRemoval, applyRestore, removalCount, removalPlan, restoreOrder, type RemovalDeps } from "./removalPlan";

function track(key: string, jellyfinId: string | null, externalId?: string): MusicTrack {
  return { key, title: key, jellyfinId, external: externalId ? { pluginId: "sillon", id: externalId } : null } as unknown as MusicTrack;
}
const entry = (key: string): ListRow => ({ rowKey: key, track: track(key, `jf-${key}`), pending: null, entryId: `e-${key}` });
const wait = (op: string): ListRow => ({ rowKey: `pending:${op}`, track: track(op, null, `x-${op}`), pending: { operationId: op, failed: false, note: null }, entryId: null });
const pendingItem = (op: string, position: number | null, duplicate?: boolean) =>
  ({ operationId: op, externalId: `x-${op}`, kind: "playlistAdd", playlistId: "pl", position, track: track(op, null, `x-${op}`), duplicate }) as unknown as PendingMusicItem;

describe("removalPlan", () => {
  const rows = [entry("a"), wait("w1"), entry("b"), entry("c"), wait("w2")];

  it("une entrée retient sa place parmi les entrées Jellyfin seules", () => {
    const plan = removalPlan(rows, new Set(["c", "a"]), []);
    expect(plan.entries.map((e) => [e.entryId, e.itemId, e.position])).toEqual([
      ["e-a", "jf-a", 0],
      ["e-c", "jf-c", 2],
    ]);
    expect(plan.waits).toEqual([]);
  });

  it("une attente retient sa demande (titre externe, position, doublon)", () => {
    const plan = removalPlan(rows, new Set(["pending:w2"]), [pendingItem("w2", 7, true)]);
    expect(plan.waits).toEqual([expect.objectContaining({ operationId: "w2", externalId: "x-w2", position: 7, duplicate: true })]);
    expect(removalCount(plan)).toBe(1);
  });

  it("une attente inconnue de la liste des attentes garde le titre externe de sa rangée", () => {
    const plan = removalPlan(rows, new Set(["pending:w1"]), []);
    expect(plan.waits[0]).toEqual(expect.objectContaining({ externalId: "x-w1", position: null, duplicate: false }));
  });

  it("remettre dans l'ordre croissant rend sa place à chacune", () => {
    const plan = removalPlan(rows, new Set(["c", "a", "b"]), []);
    const restored = restoreOrder([...plan.entries].reverse());
    expect(restored.map((e) => e.position)).toEqual([0, 1, 2]);
    // Rejoué sur la liste privée de ses entrées, chaque insertion à sa place reconstruit l'ordre d'origine.
    const list: string[] = [];
    for (const e of restored) list.splice(e.position, 0, e.entryId);
    expect(list).toEqual(["e-a", "e-b", "e-c"]);
  });
});

describe("retirer, puis « Annuler »", () => {
  const rows = [entry("a"), wait("w1"), entry("b"), entry("c")];
  function fakeDeps(refuse: Set<string> = new Set()) {
    const log: string[] = [];
    const deps: RemovalDeps = {
      removeEntry: async (e) => {
        if (refuse.has(e.entryId)) throw new Error("refusé");
        log.push(`-${e.entryId}`);
      },
      removeWait: async (w) => (refuse.has(w.operationId) ? false : (log.push(`-${w.operationId}`), true)),
      insertEntry: async (e) => void log.push(`+${e.entryId}@${e.position}`),
      addWait: async (w) => (log.push(`+${w.operationId}@${w.position}`), true),
    };
    return { deps, log };
  }

  it("seul ce qui est vraiment parti revient à l'annulation", async () => {
    const { deps, log } = fakeDeps(new Set(["e-c"]));
    const plan = removalPlan(rows, new Set(["a", "c", "pending:w1"]), [pendingItem("w1", 1)]);
    const done = await applyRemoval(deps, plan);
    expect(done.entries.map((e) => e.entryId)).toEqual(["e-a"]);
    expect(done.waits.map((w) => w.operationId)).toEqual(["w1"]);
    expect(log).toEqual(["-e-a", "-w1"]);
  });

  it("la remise rend sa place à chaque entrée, puis redemande les attentes", async () => {
    const { deps, log } = fakeDeps();
    const plan = removalPlan(rows, new Set(["c", "a", "pending:w1"]), [pendingItem("w1", 1, true)]);
    const done = await applyRemoval(deps, plan);
    log.length = 0;
    expect(await applyRestore(deps, done)).toBe(true);
    expect(log).toEqual(["+e-a@0", "+e-c@2", "+w1@1"]);
  });

  it("un refus pendant la remise se dit (faux)", async () => {
    const { deps } = fakeDeps();
    const done = await applyRemoval(deps, removalPlan(rows, new Set(["pending:w1"]), [pendingItem("w1", 1)]));
    expect(await applyRestore({ ...deps, addWait: async () => false }, done)).toBe(false);
  });
});
