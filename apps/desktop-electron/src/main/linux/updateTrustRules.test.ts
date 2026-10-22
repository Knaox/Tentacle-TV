import { describe, expect, it } from "vitest";
import { isSha256Hex, isTrustedReleaseUrl } from "./updateTrust";

describe("isTrustedReleaseUrl", () => {
  it("accepte une Release du dépôt, quelle que soit la casse du dépôt", () => {
    expect(isTrustedReleaseUrl("https://github.com/Knaox/Tentacle-TV/releases/download/desktop-v1.31.1/tentacle-tv_1.31.1_amd64.deb")).toBe(true);
    expect(isTrustedReleaseUrl("https://github.com/knaox/tentacle-tv/releases/download/t/a.rpm")).toBe(true);
  });

  it("refuse tout le reste", () => {
    expect(isTrustedReleaseUrl("pas une url")).toBe(false);
    expect(isTrustedReleaseUrl("https://github.com.evil.example/Knaox/Tentacle-TV/releases/download/t/a")).toBe(false);
    expect(isTrustedReleaseUrl("https://github.com/Knaox/Tentacle-TV-fork/releases/download/t/a")).toBe(false);
    expect(isTrustedReleaseUrl("https://github.com/Knaox/Tentacle-TV/releases/download/../../../evil/x")).toBe(false);
  });
});

describe("isSha256Hex", () => {
  it("n'accepte que 64 caractères hexadécimaux", () => {
    expect(isSha256Hex("A".repeat(64))).toBe(true);
    expect(isSha256Hex("")).toBe(false);
    expect(isSha256Hex("g".repeat(64))).toBe(false);
    expect(isSha256Hex(`${"a".repeat(64)}\n`)).toBe(false);
  });
});
