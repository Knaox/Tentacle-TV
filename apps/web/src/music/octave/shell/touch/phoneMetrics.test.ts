import { describe, expect, it } from "vitest";
import { phoneBottomRoom } from "./phoneMetrics";

describe("phoneBottomRoom", () => {
  it("réserve la barre d'onglets, et le mini-lecteur quand un titre est chargé", () => {
    expect(phoneBottomRoom(false)).toBe(87);
    expect(phoneBottomRoom(true)).toBe(153);
  });
});
