import { describe, expect, it } from "vitest";
import type { AccountAbilitiesDto } from "@tentacle-tv/shared";
import { settingsAbilitiesOf } from "./settingsAbilities";

describe("droits de la session pour le catalogue des réglages", () => {
  it("serveur d'avant : tout, les invitations et l'administration selon le profil", () => {
    const user = settingsAbilitiesOf({ kind: "legacy" }, false);
    expect([...user.abilities].sort()).toEqual(["manageAccount", "pairDevices", "push", "tickets"]);
    expect(user.isAdmin).toBe(false);
    expect(settingsAbilitiesOf({ kind: "legacy" }, true).abilities.has("invites")).toBe(true);
  });

  it("droits pas encore lus : rien", () => {
    const pending = settingsAbilitiesOf({ kind: "pending" }, true);
    expect(pending.abilities.size).toBe(0);
    expect(pending.isAdmin).toBe(false);
  });

  it("droits connus : ceux que le serveur dit, et eux seuls", () => {
    const abilities = { tickets: true, manageAccount: false, pairDevices: true, push: false, invites: false, administrator: false } as unknown as AccountAbilitiesDto;
    const known = settingsAbilitiesOf({ kind: "known", abilities }, true);
    expect([...known.abilities].sort()).toEqual(["pairDevices", "tickets"]);
    expect(known.isAdmin).toBe(false);
  });
});
