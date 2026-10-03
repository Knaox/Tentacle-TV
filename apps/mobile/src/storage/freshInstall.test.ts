import { describe, expect, it } from "vitest";
import { shouldPurgeSecureKeys } from "./freshInstall";

const USER = JSON.stringify({ Id: "b52628a704304f06a682f6037183b976" });

describe("shouldPurgeSecureKeys", () => {
  it("purge le trousseau d'une réinstallation : ni marqueur, ni adresse, ni profil", () => {
    expect(shouldPurgeSecureKeys({ marker: null, serverUrl: null, user: null })).toBe(true);
  });

  it("garde la session d'une mise à jour depuis une version sans marqueur", () => {
    expect(shouldPurgeSecureKeys({ marker: null, serverUrl: "https://tv.example", user: USER })).toBe(false);
    expect(shouldPurgeSecureKeys({ marker: null, serverUrl: "https://tv.example", user: null })).toBe(false);
    expect(shouldPurgeSecureKeys({ marker: null, serverUrl: null, user: USER })).toBe(false);
  });

  it("ne purge plus rien sur une installation déjà vue, même sans adresse", () => {
    expect(shouldPurgeSecureKeys({ marker: "1", serverUrl: null, user: null })).toBe(false);
  });
});
