/**
 * Le statut d'une invitation et son lien : les deux calculs que la page
 * d'administration affiche, avec la règle même du serveur.
 */

import { describe, expect, it } from "vitest";
import { buildInviteUrl, inviteStatus } from "./invites";

const NOW = Date.parse("2026-09-26T12:00:00Z");

describe("inviteStatus", () => {
  it("active tant qu'il reste des places et que l'échéance n'est pas passée", () => {
    expect(inviteStatus({ maxUses: 5, currentUses: 2, expiresAt: "2026-09-27T12:00:00Z" }, NOW)).toBe("active");
    expect(inviteStatus({ maxUses: 1, currentUses: 0, expiresAt: null }, NOW)).toBe("active");
  });

  it("expirée une fois l'échéance passée — à l'échéance exacte, le serveur l'accepte encore", () => {
    expect(inviteStatus({ maxUses: 5, currentUses: 0, expiresAt: "2026-09-26T11:59:59Z" }, NOW)).toBe("expired");
    expect(inviteStatus({ maxUses: 5, currentUses: 0, expiresAt: "2026-09-26T12:00:00Z" }, NOW)).toBe("active");
  });

  it("épuisée l'emporte sur expirée", () => {
    expect(inviteStatus({ maxUses: 2, currentUses: 2, expiresAt: "2026-09-27T12:00:00Z" }, NOW)).toBe("exhausted");
    expect(inviteStatus({ maxUses: 2, currentUses: 2, expiresAt: "2026-09-20T12:00:00Z" }, NOW)).toBe("exhausted");
  });
});

describe("buildInviteUrl", () => {
  it("pointe vers la page d'inscription, clé pré-remplie", () => {
    expect(buildInviteUrl("https://tv.example.com", "a1b2c3")).toBe("https://tv.example.com/register?invite=a1b2c3");
  });

  it("ne double pas la barre finale de l'origine", () => {
    expect(buildInviteUrl("https://tv.example.com/", "a1b2c3")).toBe("https://tv.example.com/register?invite=a1b2c3");
  });

  it("encode la clé", () => {
    expect(buildInviteUrl("https://tv.example.com", "a b&c")).toBe("https://tv.example.com/register?invite=a%20b%26c");
  });
});
