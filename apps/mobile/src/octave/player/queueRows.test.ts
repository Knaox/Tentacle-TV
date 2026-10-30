import { describe, expect, it } from "vitest";
import { createQueue, enqueue, moveUpcoming, queueSections } from "@tentacle-tv/shared/octave";
import { libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { queueRows } from "./queueRows";

const t = (id: string) => libraryTrack(id);
// En cours « a » ; file d'attente x, y ; suite de l'album b, c, d.
const queue = () => enqueue(createQueue(["a", "b", "c", "d"].map(t), 0, { contextId: "album:1" }), [t("x"), t("y")]);

describe("rangées de la file du lecteur", () => {
  it("le titre de chaque file, puis ses entrées", () => {
    const { rows } = queueRows(queue());
    expect(rows.map((r) => (r.kind === "header" ? r.key : r.item.track.key.slice(3)))).toEqual(["h:user", "x", "y", "h:context", "b", "c", "d"]);
  });

  it("une entrée ne se glisse que dans SA file ; un titre ne se glisse pas", () => {
    const { bounds } = queueRows(queue());
    expect(bounds(1)).toEqual({ min: 1, max: 2 });
    expect(bounds(5)).toEqual({ min: 4, max: 6 });
    expect(bounds(3)).toEqual({ min: 3, max: 3 });
  });

  it("un lâcher devient la place dans SA file, et l'ordre de lecture suit", () => {
    const q = queue();
    const { moveOf } = queueRows(q);
    const move = moveOf(6, 4);
    expect(move).not.toBeNull();
    expect(move?.toIndex).toBe(0);
    const next = moveUpcoming(q, move!.uid, move!.toIndex);
    expect(queueSections(next).contextQueue.map((i) => i.track.key.slice(3))).toEqual(["d", "b", "c"]);
    expect(moveOf(1, 5)).toBeNull();
    expect(moveOf(0, 1)).toBeNull();
  });

  it("sans file d'attente, seule la suite du contexte", () => {
    const { rows, bounds } = queueRows(createQueue(["a", "b", "c"].map(t), 0, { contextId: "album:1" }));
    expect(rows.map((r) => r.key.startsWith("h:") ? r.key : "item")).toEqual(["h:context", "item", "item"]);
    expect(bounds(2)).toEqual({ min: 1, max: 2 });
  });
});
