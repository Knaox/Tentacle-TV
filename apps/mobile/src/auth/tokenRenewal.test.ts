import { describe, expect, it } from "vitest";
import { tokenRenewed } from "./tokenRenewal";

describe("retour au premier plan : le cache ne se relit que si le jeton a changé", () => {
  it("le même jeton rendu par le serveur : rien à relire", () => {
    expect(tokenRenewed("abc", "abc")).toBe(false);
  });

  it("un jeton neuf : tout se relit avec lui", () => {
    expect(tokenRenewed("abc", "def")).toBe(true);
    expect(tokenRenewed(null, "def")).toBe(true);
  });

  it("une réponse sans jeton n'en est pas un", () => {
    expect(tokenRenewed("abc", undefined)).toBe(false);
    expect(tokenRenewed("abc", "")).toBe(false);
  });
});
