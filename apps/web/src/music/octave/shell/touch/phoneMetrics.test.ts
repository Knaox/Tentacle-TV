import { describe, expect, it } from "vitest";
import { phoneBottomRoom } from "./phoneMetrics";

describe("phoneBottomRoom", () => {
  it("réserve la barre d'onglets, et le mini-lecteur quand un titre est chargé", () => {
    expect(phoneBottomRoom(false)).toBe("calc(87px + max(env(safe-area-inset-bottom, 0px), 10px))");
    expect(phoneBottomRoom(true)).toBe("calc(153px + max(env(safe-area-inset-bottom, 0px), 10px))");
  });
});
