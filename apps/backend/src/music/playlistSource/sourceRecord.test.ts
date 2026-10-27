import { describe, expect, it } from "vitest";
import { bound, parseSlots, pinnedDates, ranksByItem, slotsOf, type PlaylistSourceRecord } from "./sourceRecord";

const track = (index: number, title: string) => ({ index, title, artists: ["A"], album: null, durationMs: null, isrc: null, sourceId: null });

describe("relevé de l'ordre de la source — règles pures", () => {
  it("chaque titre de la source garde son rang ; les présents, leur élément", () => {
    const slots = slotsOf([track(0, "a"), track(1, "b"), track(2, "c")], new Map([[1, "e1"]]));
    expect(slots.map((s) => [s.rank, s.itemIds])).toEqual([[0, []], [1, ["e1"]], [2, []]]);
  });

  it("une arrivée liée à son titre ; un doublon tient deux éléments ; le rang le plus petit fait foi", () => {
    const record: PlaylistSourceRecord = { playlistId: "p", userId: "u", source: "apple", url: null, origin: "import", importedAt: 10_000, slots: slotsOf([track(0, "a"), track(1, "b")], new Map()) };
    const next = bound(bound(bound(record, 1, ["x"]), 1, ["y", "x"]), 0, ["y"]);
    expect(next.slots.map((s) => s.itemIds)).toEqual([["y"], ["x", "y"]]);
    expect([...ranksByItem(next)]).toEqual([["y", 0], ["x", 1]]);
  });

  it("la date d'un titre de la source suit son rang, avant l'import ; un élément hors source n'en a pas", () => {
    const record: PlaylistSourceRecord = { playlistId: "p", userId: "u", source: "apple", url: null, origin: "import", importedAt: 10_000, slots: slotsOf([track(0, "a"), track(1, "b"), track(2, "c")], new Map([[0, "e0"], [2, "e2"]])) };
    const dates = pinnedDates(record, ["e2", "manual", "e0"]);
    expect([...dates]).toEqual([["e2", 9_999], ["e0", 9_997]]);
  });

  it("un JSON abîmé ou un titre mal formé : ignorés, jamais une erreur", () => {
    expect(parseSlots("{")).toEqual([]);
    expect(parseSlots(JSON.stringify([{ rank: 1, title: "b", itemIds: ["zz", "22222222222222222222222222222222"] }, { rank: -1, title: "x" }, { title: "sans rang" }]))).toEqual([
      { rank: 1, title: "b", artists: [], album: null, durationMs: null, itemIds: ["22222222222222222222222222222222"] },
    ]);
  });
});
