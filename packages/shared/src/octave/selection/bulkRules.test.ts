import { describe, expect, it } from "vitest";
import type { MusicPlaylistEntry, MusicTrack, PendingMusicItem } from "../../music";
import { bulkAddPlan, bulkLikePlan, tracksToAdd } from "./bulkRules";

function track(key: string, recording: string, favorite = false, jellyfinId: string | null = `jf-${key}`): MusicTrack {
  return { key, title: key, artists: [{ name: "X", jellyfinId: null }], mbids: { recording }, jellyfinId, favorite, external: null, availability: "library" } as unknown as MusicTrack;
}
const a = track("a", "r-a");
const b = track("b", "r-b");
const c = track("c", "r-c", true);
const entries = [{ entryId: "e1", position: 0, track: a }] as unknown as MusicPlaylistEntry[];
const pending = [{ operationId: "o", kind: "playlistAdd", playlistId: "pl", externalId: "x", position: 1, track: b }] as unknown as PendingMusicItem[];

describe("ajouter une sélection à une playlist", () => {
  it("compte les titres déjà là (entrée ou attente), laisse de côté ceux qui ne peuvent pas entrer", () => {
    const plan = bulkAddPlan([a, b, c], entries, pending, "pl", (t) => t.key !== "c");
    expect(plan.duplicates.map((t) => t.key)).toEqual(["a", "b"]);
    expect(plan.fresh).toEqual([]);
  });

  it("le choix devant les doublons décide de ce qui entre", () => {
    const plan = bulkAddPlan([a, c], entries, [], "pl", () => true);
    expect(tracksToAdd(plan, "skip")).toEqual([{ track: c, duplicate: false }]);
    expect(tracksToAdd(plan, "all")).toEqual([
      { track: c, duplicate: false },
      { track: a, duplicate: true },
    ]);
    expect(tracksToAdd(plan, "cancel")).toBeNull();
  });

  it("une attente d'une AUTRE playlist n'est pas un doublon", () => {
    expect(bulkAddPlan([b], [], pending, "autre", () => true).fresh).toEqual([b]);
  });
});

describe("aimer une sélection", () => {
  const liked = (t: MusicTrack) => t.favorite;
  it("les titres pas encore aimés le deviennent", () => {
    expect(bulkLikePlan([a, c], liked, () => true)).toEqual({ liked: true, tracks: [a] });
  });
  it("tous déjà aimés : le geste les retire des likés", () => {
    expect(bulkLikePlan([c], liked, () => true)).toEqual({ liked: false, tracks: [c] });
  });
  it("un titre qui ne s'aime pas est laissé de côté", () => {
    expect(bulkLikePlan([a, b], liked, (t) => t.key === "b")).toEqual({ liked: true, tracks: [b] });
  });
});
