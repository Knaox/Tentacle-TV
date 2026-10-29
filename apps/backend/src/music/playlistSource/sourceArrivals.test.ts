/**
 * Une arrivée dans la bibliothèque se range à son rang dans la playlist importée qui l'attendait (Damien, 29/10).
 * Les éléments sont ceux que Jellyfin rend pour l'album importé à la main (`__fixtures__/jellyfin-bastian-baker.json`).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import type { IndexRow } from "../index/indexTypes";
import { rowFromItem } from "../jellyfin/itemMapping";
import type { JfItem } from "../jellyfin/musicJellyfin";
import type { UserView } from "../view/viewContext";
import { arrivalBindings, hasFreeSlot } from "./arrivalPlan";
import { placeArrivals, sourceArrivalWatcher, type SourceArrivalDeps } from "./sourceArrivals";
import type { PlaylistSourceRecord, SourceSlot } from "./sourceRecord";

vi.mock("../../services/db", () => ({ getPrisma: () => null }));

const ITEMS = JSON.parse(readFileSync(join(__dirname, "../playlistImport/__fixtures__/jellyfin-bastian-baker.json"), "utf8")) as JfItem[];
const ROWS = ITEMS.map(rowFromItem).filter((r): r is IndexRow => r !== null);
const row = (name: string) => ROWS.find((r) => r.name === name)!;
const PRESENT = "a".repeat(32);

/** Une playlist Spotify : un titre déjà dans la bibliothèque, puis trois de l'album, absents à l'import. */
function slots(): SourceSlot[] {
  return [
    { rank: 0, title: "Bohemian Rhapsody", artists: ["Queen"], album: null, durationMs: 354_000, itemIds: [PRESENT] },
    { rank: 1, title: "Red Flags", artists: ["Bastian Baker"], album: null, durationMs: row("Red flags").durationMs! + 700, itemIds: [] },
    { rank: 2, title: "Inconnu", artists: ["Personne"], album: null, durationMs: 200_000, itemIds: [] },
    { rank: 3, title: "Black Cloud", artists: ["Bastian Baker"], album: null, durationMs: row("Black cloud").durationMs!, itemIds: [] },
    { rank: 4, title: "Amazonia", artists: ["Bastian Baker"], album: null, durationMs: row("Amazonia").durationMs!, itemIds: [] },
  ];
}

const record = (over: Partial<PlaylistSourceRecord> = {}): PlaylistSourceRecord => ({
  playlistId: "p1", userId: "u1", source: "spotify", url: null, origin: "import", importedAt: 0, slots: slots(), ...over,
});

const everyone: UserView = { userId: "u1", access: { mode: "all", libraryId: "lib" }, favorites: new Set() };

function deps(records: PlaylistSourceRecord[], view: UserView = everyone) {
  const inserted: [string, string, number][] = [];
  const d: SourceArrivalDeps = {
    records: async () => records,
    rows: async (ids) => new Map(ROWS.filter((r) => ids.includes(r.id)).map((r) => [r.id, r])),
    view: async () => view,
    insert: async (_userId, playlistId, itemId, rank) => {
      inserted.push([playlistId, itemId, rank]);
      return true;
    },
    log: () => undefined,
  };
  return { d, inserted };
}

describe("arrivalBindings : quel titre libre de la source chaque arrivée tient", () => {
  it("l'album entier arrive : chaque titre de la source prend SON élément, l'homonyme inconnu reste libre", () => {
    expect(arrivalBindings(slots(), ROWS)).toEqual([
      { rank: 1, itemId: row("Red flags").id },
      { rank: 3, itemId: row("Black cloud").id },
      { rank: 4, itemId: row("Amazonia").id },
    ]);
  });

  it("un titre déjà tenu ne reprend rien ; un élément déjà lié n'est jamais pris deux fois", () => {
    const held = slots().map((s) => (s.rank === 3 ? { ...s, itemIds: [row("Black cloud").id] } : s));
    expect(arrivalBindings(held, ROWS).map((b) => b.rank)).toEqual([1, 4]);
  });

  it("une autre version (une minute de plus) n'est pas le titre de la source", () => {
    const live = slots().map((s) => (s.rank === 1 ? { ...s, durationMs: s.durationMs! + 60_000 } : s));
    expect(arrivalBindings(live, [row("Red flags")])).toEqual([]);
  });

  it("une arrivée qui n'est pas un titre (un album) n'est jamais rangée", () => {
    expect(arrivalBindings(slots(), [{ ...row("Amazonia"), kind: "album" }])).toEqual([]);
    expect(hasFreeSlot(slots())).toBe(true);
    expect(hasFreeSlot(slots().map((s) => ({ ...s, itemIds: ["x"] })))).toBe(false);
  });
});

describe("placeArrivals : les arrivées entrent à leur rang", () => {
  it("dans l'ordre de la source, playlist par playlist ; une playlist sans titre libre n'est pas relue", async () => {
    const full = record({ playlistId: "p2", slots: slots().map((s) => ({ ...s, itemIds: [`${s.rank}`.repeat(32)] })) });
    const { d, inserted } = deps([record(), full]);
    expect(await placeArrivals(ROWS.map((r) => r.id), d)).toBe(3);
    expect(inserted).toEqual([
      ["p1", row("Red flags").id, 1],
      ["p1", row("Black cloud").id, 3],
      ["p1", row("Amazonia").id, 4],
    ]);
  });

  it("un titre que le compte ne VOIT pas (bibliothèque restreinte) n'entre pas dans sa playlist", async () => {
    const restricted: UserView = { userId: "u1", access: { mode: "some", libraryId: "lib", visible: new Set([row("Amazonia").id]) }, favorites: new Set() } as UserView;
    const { d, inserted } = deps([record()], restricted);
    await placeArrivals(ROWS.map((r) => r.id), d);
    expect(inserted.map((i) => i[2])).toEqual([4]);
  });

  it("une insertion refusée (playlist supprimée, droit retiré) arrête cette playlist, sans erreur", async () => {
    const { d } = deps([record()]);
    let calls = 0;
    d.insert = async () => (calls++, false);
    expect(await placeArrivals(ROWS.map((r) => r.id), d)).toBe(0);
    expect(calls).toBe(1);
  });
});

describe("sourceArrivalWatcher : l'arrivée déclenche, une rafale ne fait qu'un passage", () => {
  it("onze arrivées en trois évènements : un seul passage, après la rafale ; les mises à jour seules ne déclenchent rien", async () => {
    vi.useFakeTimers();
    try {
      const { d, inserted } = deps([record()]);
      const records = vi.spyOn(d, "records");
      const watcher = sourceArrivalWatcher(d, 2_000);
      const ref = (r: IndexRow) => ({ jellyfinId: r.id, recording: null, release: null, path: null });
      watcher.onChange({ added: [], updated: ROWS.map(ref), removed: [] });
      watcher.onChange({ added: ROWS.slice(0, 4).map(ref), updated: [], removed: [] });
      await vi.advanceTimersByTimeAsync(1_000);
      watcher.onChange({ added: ROWS.slice(4).map(ref), updated: [], removed: [] });
      expect(records).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1_500);
      await watcher.settled();
      expect(records).toHaveBeenCalledTimes(1);
      expect(inserted.map((i) => i[2])).toEqual([1, 3, 4]);
    } finally {
      vi.useRealTimers();
    }
  });
});
