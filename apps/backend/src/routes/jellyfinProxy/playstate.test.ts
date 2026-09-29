import { describe, expect, it } from "vitest";
import { buildPlaystateRewrite } from "./playstate";

const NOW = new Date("2026-09-29T12:00:00.000Z");

describe("buildPlaystateRewrite", () => {
  it("écrit la position dans les données du compte, pour chaque report", () => {
    for (const path of ["Sessions/Playing", "Sessions/Playing/Progress", "Sessions/Playing/Stopped"]) {
      const out = buildPlaystateRewrite("u1", path, { ItemId: "i1", PositionTicks: 42_000_000, IsPaused: true }, NOW);
      expect(out, path).toEqual({
        path: "UserItems/i1/UserData?userId=u1",
        method: "POST",
        body: JSON.stringify({ LastPlayedDate: NOW.toISOString(), PlaybackPositionTicks: 42_000_000 }),
      });
    }
  });

  it("sans position, ne remet pas la reprise à zéro", () => {
    const out = buildPlaystateRewrite("u1", "Sessions/Playing", { ItemId: "i1" }, NOW);
    expect(JSON.parse(out!.body!)).toEqual({ LastPlayedDate: NOW.toISOString() });
  });

  it("ne touche ni une autre route, ni un report sans titre", () => {
    expect(buildPlaystateRewrite("u1", "Sessions/Playing/Ping", { ItemId: "i1" })).toBeNull();
    expect(buildPlaystateRewrite("u1", "Videos/ActiveEncodings", { ItemId: "i1" })).toBeNull();
    expect(buildPlaystateRewrite("u1", "Sessions/Playing", {})).toBeNull();
    expect(buildPlaystateRewrite("u1", "Sessions/Playing", null)).toBeNull();
  });
});
