import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { afterBudget, afterFresh, initialGate } from "./gateMachine";

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "guest", name: userId, color: "violet", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

function listing(extra: Partial<PickerProfilesDto> = {}): PickerProfilesDto {
  return {
    v: 2,
    platform: "desktop",
    switches: { families: true, guests: true },
    account: { userId: "owner", name: "Damien" },
    profiles: [profile("owner", { kind: "owner", personal: true }), profile("lea")],
    currentProfileId: "owner",
    pickerRequired: true,
    atLaunch: true,
    ...extra,
  };
}

describe("la porte de « Qui regarde ? »", () => {
  it("le sélecteur montré depuis le miroir reste si le serveur le confirme, s'efface sinon", () => {
    const state = initialGate("picker", false, null);
    expect(afterFresh(state, { kind: "listing", listing: listing() })).toEqual({ phase: "picker" });
    expect(afterFresh(state, { kind: "listing", listing: listing({ atLaunch: false }) })).toEqual({ phase: "app" });
  });

  it("l'application ouverte ne se couvre que pour la sécurité, jamais pour la préférence", () => {
    const state = initialGate("app", false, null);
    expect(afterFresh(state, { kind: "listing", listing: listing({ atLaunch: true }) })).toEqual({ phase: "app" });
    expect(afterFresh(state, { kind: "listing", listing: listing({ currentProfileId: "lea" }) })).toEqual({ phase: "picker" });
  });

  it("une session de profil gardée que le serveur ne connaît plus prend fin", () => {
    const state = initialGate("app", false, "lea");
    expect(afterFresh(state, { kind: "listing", listing: listing({ currentProfileId: "owner" }) })).toEqual({ phase: "app", endProfile: true });
    expect(afterFresh(initialGate("check", false, "lea"), { kind: "listing", listing: listing({ atLaunch: false }) }))
      .toEqual({ phase: "check", endProfile: true });
  });

  it("sans réponse : l'application, sauf sélecteur exigé — alors Réessayer", () => {
    expect(afterFresh(initialGate("check", false, null), { kind: "failed" })).toEqual({ phase: "app" });
    expect(afterFresh(initialGate("picker", false, null), { kind: "failed" })).toEqual({ phase: "picker" });
    expect(afterFresh(initialGate("check", true, null), { kind: "failed" })).toEqual({ phase: "error" });
  });

  it("serveur sans la capacité : rien de tout cela", () => {
    expect(afterFresh(initialGate("check", false, null), { kind: "incapable" })).toEqual({ phase: "app" });
    expect(afterFresh(initialGate("picker", false, null), { kind: "incapable" })).toEqual({ phase: "app" });
  });

  it("session personnelle refusée : déconnexion", () => {
    expect(afterFresh(initialGate("check", false, null), { kind: "accountLost" })).toEqual({ phase: "app", logout: true });
  });

  it("l'attente bornée ouvre l'application, jamais quand le sélecteur est exigé", () => {
    expect(afterBudget(initialGate("check", false, null))).toBe("app");
    expect(afterBudget(initialGate("check", true, null))).toBe("check");
    expect(afterBudget(initialGate("picker", false, null))).toBe("picker");
  });
});
