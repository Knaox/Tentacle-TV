import { describe, expect, it } from "vitest";
import { isNewerVersion } from "./semver";

describe("isNewerVersion", () => {
  it("compare numériquement, champ par champ", () => {
    expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("1.9.9", "1.10.0")).toBe(false);
    expect(isNewerVersion("2.0", "1.99.99")).toBe(true);
  });

  it("une version égale ou plus ancienne n'est pas une mise à jour", () => {
    expect(isNewerVersion("1.2.0", "1.2.0")).toBe(false);
    expect(isNewerVersion("1.2", "1.2.0")).toBe(false);
    expect(isNewerVersion("1.14.2", "1.15.1")).toBe(false);
  });

  it("tolère le préfixe v et ignore un suffixe de pré-version", () => {
    expect(isNewerVersion("v1.3.0", "1.2.9")).toBe(true);
    expect(isNewerVersion("1.3.0-beta.1", "1.3.0")).toBe(false);
  });
});
