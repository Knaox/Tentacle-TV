import { describe, expect, it } from "vitest";
import { canManageGuest, familyCandidates, familyRightsOf, type FamilyCandidateSource } from "./familyRights";

const ON = { families: true, guests: true };

describe("familyRightsOf", () => {
  it("le propriétaire gère les membres et TOUS les invités", () => {
    expect(familyRightsOf("owner", null, ON)).toEqual({ manageMembers: true, createGuests: true, manageGuests: "all" });
  });

  it("un membre ne gère que SES invités, et n'en crée que si le propriétaire le lui permet", () => {
    expect(familyRightsOf("member", { createGuests: false }, ON)).toEqual({ manageMembers: false, createGuests: false, manageGuests: "own" });
    expect(familyRightsOf("member", { createGuests: true }, ON).createGuests).toBe(true);
    expect(familyRightsOf("member", null, ON).createGuests).toBe(false);
  });

  it("créer exige la Famille et les invités allumés ; gérer ce qui existe, non", () => {
    expect(familyRightsOf("owner", null, { families: true, guests: false })).toEqual({
      manageMembers: true,
      createGuests: false,
      manageGuests: "all",
    });
    expect(familyRightsOf("member", { createGuests: true }, { families: false, guests: true }).createGuests).toBe(false);
  });

  it("sans rôle : rien", () => {
    expect(familyRightsOf(null, null, ON)).toEqual({ manageMembers: false, createGuests: false, manageGuests: "none" });
  });
});

describe("canManageGuest", () => {
  const owner = familyRightsOf("owner", null, ON);
  const member = familyRightsOf("member", { createGuests: false }, ON);

  it("le propriétaire : tout invité, quel qu'en soit le créateur", () => {
    expect(canManageGuest(owner, "lea", "damien")).toBe(true);
    expect(canManageGuest(owner, null, "damien")).toBe(true);
  });

  it("un membre : seulement les invités qu'il a créés — même privé du droit d'en créer", () => {
    expect(canManageGuest(member, "lea", "lea")).toBe(true);
    expect(canManageGuest(member, "LE-A", "lea")).toBe(true);
    expect(canManageGuest(member, "damien", "lea")).toBe(false);
    expect(canManageGuest(member, null, "lea")).toBe(false);
    expect(canManageGuest(familyRightsOf(null, null, ON), "lea", "lea")).toBe(false);
  });
});

describe("familyCandidates", () => {
  const users: FamilyCandidateSource[] = [
    { id: "alice", name: "Alice", isDisabled: false, imageTag: "t" },
    { id: "alain", name: "Alain", isDisabled: false, imageTag: null },
    { id: "hidden", name: "Élodie", isDisabled: false, imageTag: null },
    { id: "banni", name: "Banni", isDisabled: true, imageTag: null },
    { id: "zoe-guest", name: "Zoé - invite de Damien", isDisabled: false, imageTag: null },
    { id: "me", name: "Damien", isDisabled: false, imageTag: null },
    { id: "hugo", name: "Hugo", isDisabled: false, imageTag: null },
  ];
  const base = { query: "", exclude: ["me", "zoe-guest"], inFamily: ["hugo"], invited: ["alain"], limit: 50 };

  it("rend TOUS les comptes sans saisie — cachés compris —, jamais un désactivé, soi-même ni un invité", () => {
    const ids = familyCandidates(users, base).map((c) => c.userId);
    expect(ids).toEqual(["alice", "hidden", "alain", "hugo"]);
  });

  it("marque ce qui ne s'invite pas, sans dire quelle famille ; les invitables d'abord", () => {
    const out = familyCandidates(users, base);
    expect(out.map((c) => [c.userId, c.status])).toEqual([
      ["alice", "available"],
      ["hidden", "available"],
      ["alain", "invited"],
      ["hugo", "in_family"],
    ]);
    expect(Object.keys(out[3]).sort()).toEqual(["imageTag", "name", "status", "userId"]);
  });

  it("quelques lettres affinent — accents, casse et tirets indifférents", () => {
    expect(familyCandidates(users, { ...base, query: "al" }).map((c) => c.userId)).toEqual(["alice", "alain"]);
    expect(familyCandidates(users, { ...base, query: "elo" }).map((c) => c.userId)).toEqual(["hidden"]);
    expect(familyCandidates(users, { ...base, exclude: ["M-E", "ZOE-GUEST"] }).map((c) => c.userId)).not.toContain("me");
  });

  it("borne la liste", () => {
    expect(familyCandidates(users, { ...base, limit: 2 })).toHaveLength(2);
  });
});
