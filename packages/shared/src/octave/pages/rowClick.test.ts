import { describe, expect, it, vi } from "vitest";
import { playTrackGesture, rowClickAction } from "./rowClick";

describe("rowClickAction", () => {
  it("le titre en cours de la même liste : pause ou reprise, jamais un redémarrage", () => {
    expect(rowClickAction("a", "a", "album:1", "album:1")).toBe("toggle");
  });
  it("un autre titre, ou le même titre dans une autre liste : la liste part de lui", () => {
    expect(rowClickAction("b", "a", "album:1", "album:1")).toBe("play");
    expect(rowClickAction("a", "a", "playlist:2", "album:1")).toBe("play");
    expect(rowClickAction(undefined, null, null, "album:1")).toBe("play");
  });
  it("un titre indisponible : rien ne part, la lecture en cours continue — même s'il était le courant (lot « fl »)", () => {
    expect(rowClickAction("b", "a", "album:1", "album:1", true)).toBe("unavailable");
    expect(rowClickAction("a", "a", "album:1", "album:1", true)).toBe("unavailable");
  });
});

describe("playTrackGesture (lot « ol »)", () => {
  it("un titre illisible : l'avis seul, jamais la liste depuis le suivant", () => {
    const tracks = [{ key: "a" }, { key: "b" }];
    const play = vi.fn();
    const announce = vi.fn();
    playTrackGesture(tracks, 1, (t) => t.key === "b", play, announce);
    expect(play).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith({ key: "b" });
    playTrackGesture(tracks, 0, (t) => t.key === "b", play, announce);
    expect(play).toHaveBeenCalledWith(tracks, 0);
  });
});
