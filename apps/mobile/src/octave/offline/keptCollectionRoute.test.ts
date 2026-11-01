import { describe, expect, it } from "vitest";
import { keptCollectionRoute } from "./keptCollectionRoute";

describe("keptCollectionRoute", () => {
  const all = () => true;
  const none = () => false;
  it("une playlist dont la page est gardée : sa page (dernier ordre du compte, glisser)", () => {
    expect(keptCollectionRoute("playlist:jf:abc", all)).toBe("/octave/playlist/abc");
    expect(keptCollectionRoute("playlist:liked", all)).toBe("/octave/liked");
  });
  it("sans page gardée, un album : la collection dans « Sur cet appareil »", () => {
    expect(keptCollectionRoute("playlist:jf:abc", none)).toBe("/octave/device?c=playlist%3Ajf%3Aabc");
    expect(keptCollectionRoute("album:x", all)).toBe("/octave/device?c=album%3Ax");
  });
});
