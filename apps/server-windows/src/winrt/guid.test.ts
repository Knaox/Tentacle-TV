import { describe, expect, it } from "vitest";
import { guidBuffer } from "./guid";

describe("guidBuffer", () => {
  it("écrit les trois premiers champs en petit-boutiste et le reste brut", () => {
    expect(guidBuffer("{00000036-0000-0000-C000-000000000046}").toString("hex")).toBe("3600000000000000c000000000000046");
    expect(guidBuffer("ee5b60bd-a148-41a7-b26e-e8b88a1e62f8").toString("hex")).toBe("bd605bee48a1a741b26ee8b88a1e62f8");
  });

  it("refuse un GUID tronqué", () => {
    expect(() => guidBuffer("ee5b60bd-a148")).toThrow();
  });
});
