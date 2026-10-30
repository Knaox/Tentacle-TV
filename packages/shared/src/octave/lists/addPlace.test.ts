import { describe, expect, it } from "vitest";
import { applyCustomOrder, type MusicListSubject } from "../../music";
import { addPlace } from "./addPlace";

const subject = (key: string): MusicListSubject => ({ key, title: key, artist: "", album: "", disc: null, track: null, durationMs: null, year: null, recording: null, stats: null });

describe("où entre un ajout à une playlist (lot fl)", () => {
  it("serveur qui le sait : en tête d'une playlist à soi ; partagée ou serveur d'avant : la fin", () => {
    expect(addPlace({ editable: true }, true, undefined)).toBe(0);
    expect(addPlace({ editable: true }, false, undefined)).toBeUndefined();
    expect(addPlace({ editable: true }, false, 12)).toBe(12);
    const shared = { editable: true, sharing: { role: "owner", right: "owner", members: [{ userId: "u" }] } } as never;
    expect(addPlace(shared, true, 12)).toBe(12);
  });

  it("en ordre personnalisé, le titre posé en tête de la playlist s'affiche en haut", () => {
    const natural = ["n", "a", "b", "c"];
    const custom = [{ k: "c" }, { k: "a" }, { k: "b" }];
    expect(applyCustomOrder(natural, subject, custom)).toEqual(["n", "c", "a", "b"]);
    expect(applyCustomOrder(natural, subject, null)).toEqual(["n", "a", "b", "c"]);
  });
});
