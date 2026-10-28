import { describe, expect, it } from "vitest";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { QueueState } from "@tentacle-tv/shared/octave";
import { neighbourArtworkUrls } from "./artworkNeighbours";

function queue(arts: (string | null)[], cursor: number, repeat: QueueState["repeat"] = "off"): QueueState {
  const items = arts.map((artworkUrl, i) => ({ uid: `u${i}`, track: { artworkUrl } as MusicTrack }));
  return { items, original: items.map((item) => item.uid), cursor, shuffle: false, repeat, contextId: null };
}

describe("les pochettes voisines, préparées avant le geste", () => {
  it("celle d'après puis celle d'avant", () => {
    expect(neighbourArtworkUrls(queue(["a", "b", "c"], 1))).toEqual(["c", "a"]);
  });

  it("aux bouts de la file : seulement ce qui existe, sauf si la file se répète", () => {
    expect(neighbourArtworkUrls(queue(["a", "b", "c"], 2))).toEqual(["b"]);
    expect(neighbourArtworkUrls(queue(["a", "b", "c"], 2, "all"))).toEqual(["a", "b"]);
  });

  it("sans doublon, sans la pochette en cours (un album), sans les titres sans pochette", () => {
    expect(neighbourArtworkUrls(queue(["a", "a", "a"], 1))).toEqual([]);
    expect(neighbourArtworkUrls(queue(["x", "b", "x"], 1))).toEqual(["x"]);
    expect(neighbourArtworkUrls(queue([null, "b", "c"], 1))).toEqual(["c"]);
    expect(neighbourArtworkUrls(queue([], -1))).toEqual([]);
  });
});
