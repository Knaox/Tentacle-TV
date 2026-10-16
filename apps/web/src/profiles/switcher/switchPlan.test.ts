import { describe, expect, it } from "vitest";
import type { PickerProfileDto } from "@tentacle-tv/shared";
import { commitStay, manageTarget, switchActiveId, switchPick } from "./switchPlan";

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

describe("« Gérer les profils » : qui gère", () => {
  const RIGHTS = { manageMembers: false, createGuests: true, manageGuests: "all", manageRoles: false, manageMinors: true } as const;

  it("à l'ouverture et depuis la session personnelle : son propre profil", () => {
    expect(manageTarget(FAMILY, null)?.userId).toBe("owner");
  });

  it("depuis la session d'un profil qui gère (1.30.0) : ce profil-là, jamais le compte de l'appareil", () => {
    const family = [FAMILY[0], profile("zoe", { hasPin: true, manage: RIGHTS }), FAMILY[2]];
    expect(manageTarget(family, "zoe")?.userId).toBe("zoe");
    // Sans code, il gérerait : la page lui dit qu'il lui en faut un.
    const bare = [FAMILY[0], profile("zoe", { manage: null, manageNeedsPin: true }), FAMILY[2]];
    expect(manageTarget(bare, "zoe")?.userId).toBe("zoe");
  });

  it("un invité, ou un serveur qui ne le sait pas : pas d'entrée", () => {
    expect(manageTarget(FAMILY, "lea")).toBeNull();
    expect(manageTarget(FAMILY, "zoe")).toBeNull();
  });
});

describe("« Changer de profil » : choisir un profil", () => {
  it("le profil en cours referme l'écran sans code ni serveur, quelle que soit la graphie de son identifiant", () => {
    expect(switchPick("owner", "owner", false, false)).toEqual({ kind: "close", stay: undefined });
    expect(switchPick("A1B2-C3", "a1b2c3", false, false)).toEqual({ kind: "close", stay: undefined });
  });

  it("le profil en cours : la case vaut (cochée, retenu ; décochée, proposer de nouveau)", () => {
    expect(switchPick("zoe", "zoe", true, true)).toEqual({ kind: "close", stay: true });
    expect(switchPick("zoe", "zoe", true, false)).toEqual({ kind: "close", stay: false });
    // Coupé par l'administration : pas de case, rien n'est retenu.
    expect(switchPick("zoe", "zoe", false, true)).toEqual({ kind: "close", stay: undefined });
  });

  it("un autre profil s'ouvre par le serveur (son code d'abord) ; profil en cours inconnu : tout s'ouvre", () => {
    expect(switchPick("zoe", "owner", true, true)).toEqual({ kind: "open" });
    expect(switchPick("owner", null, false, false)).toEqual({ kind: "open" });
  });
});

describe("« Ne plus proposer à la prochaine ouverture » au choix d'un profil", () => {
  it("« Gérer les profils » n'y touche jamais", () => {
    expect(commitStay(true, true, true)).toBeUndefined();
    expect(commitStay(true, true, false)).toBeUndefined();
  });

  it("à l'ouverture comme depuis le menu : la case, tant que l'administration le permet", () => {
    expect(commitStay(false, true, true)).toBe(true);
    expect(commitStay(false, true, false)).toBe(false);
    expect(commitStay(false, false, true)).toBeUndefined();
  });
});
