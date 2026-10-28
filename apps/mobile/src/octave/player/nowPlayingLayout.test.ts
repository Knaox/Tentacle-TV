import { describe, expect, it } from "vitest";
import { nowPlayingArtworkSize, nowPlayingLayout } from "./nowPlayingLayout";

describe("mise en page du lecteur plein écran", () => {
  it("colonne sur un téléphone en portrait, côte à côte sur une tablette ou couché", () => {
    expect(nowPlayingLayout(393, 852)).toBe("column");
    expect(nowPlayingLayout(852, 393)).toBe("split");
    expect(nowPlayingLayout(820, 1180)).toBe("split");
    expect(nowPlayingLayout(1180, 820)).toBe("split");
  });

  it("la pochette laisse la place aux commandes", () => {
    expect(nowPlayingArtworkSize("column", 393, 852)).toBe(345);
    expect(nowPlayingArtworkSize("column", 375, 667)).toBe(280);
    expect(nowPlayingArtworkSize("split", 852, 393)).toBe(253);
    expect(nowPlayingArtworkSize("split", 1180, 820)).toBe(519);
  });
});
