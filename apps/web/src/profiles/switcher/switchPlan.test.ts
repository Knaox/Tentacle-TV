import { describe, expect, it } from "vitest";
import type { PickerProfileDto } from "@tentacle-tv/shared";
import { commitStay, switchActiveId, switchPick } from "./switchPlan";

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "member", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

const FAMILY = [profile("owner", { kind: "owner", personal: true, hasPin: true }), profile("zoe", { hasPin: true }), profile("lea", { kind: "guest" })];

describe("« Changer de profil » : le profil en cours", () => {
  it("session personnelle : son propre profil ; session de profil : celui-là", () => {
    expect(switchActiveId(FAMILY, null)).toBe("owner");
    expect(switchActiveId(FAMILY, "zoe")).toBe("zoe");
    expect(switchActiveId([profile("lea")], null)).toBeNull();
  });
});

describe("« Changer de profil » : choisir un profil", () => {
  it("le profil en cours referme l'écran sans code ni serveur, quelle que soit la graphie de son identifiant", () => {
    expect(switchPick("owner", "owner", false, false)).toEqual({ kind: "close", keepHere: false });
    expect(switchPick("A1B2-C3", "a1b2c3", false, false)).toEqual({ kind: "close", keepHere: false });
  });

  it("le profil en cours, case cochée (le compte demande qui regarde) : l'ordinateur le retient", () => {
    expect(switchPick("zoe", "zoe", true, true)).toEqual({ kind: "close", keepHere: true });
    // Case décochée : rien ne change — le profil retenu, s'il y en a un, est déjà celui-là.
    expect(switchPick("zoe", "zoe", true, false)).toEqual({ kind: "close", keepHere: false });
    // Préférence coupée : la case n'est pas montrée, rien n'est retenu.
    expect(switchPick("zoe", "zoe", false, true)).toEqual({ kind: "close", keepHere: false });
  });

  it("un autre profil s'ouvre par le serveur (son code d'abord) ; profil en cours inconnu : tout s'ouvre", () => {
    expect(switchPick("zoe", "owner", true, true)).toEqual({ kind: "open" });
    expect(switchPick("owner", null, false, false)).toEqual({ kind: "open" });
  });
});

describe("« Ne plus proposer sur cet appareil » à la bascule", () => {
  it("« Gérer les profils » n'y touche jamais", () => {
    expect(commitStay("launch", true, true, true)).toBeUndefined();
    expect(commitStay("switch", true, true, false)).toBeUndefined();
  });

  it("à l'ouverture : la case, si le compte demande qui regarde ; sinon rien ne change", () => {
    expect(commitStay("launch", false, true, true)).toBe(true);
    expect(commitStay("launch", false, true, false)).toBe(false);
    expect(commitStay("launch", false, false, false)).toBeUndefined();
  });

  it("depuis le menu : un changement de profil oublie le profil retenu, sauf case cochée", () => {
    expect(commitStay("switch", false, true, true)).toBe(true);
    expect(commitStay("switch", false, true, false)).toBe(false);
    // Préférence coupée (aucune case) : oublié, comme l'a toujours fait le menu de l'avatar.
    expect(commitStay("switch", false, false, true)).toBe(false);
  });
});
