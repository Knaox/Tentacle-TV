import { describe, expect, it } from "vitest";
import type { FamilyProfileDto } from "./familyContract";
import { GUEST_PARENTAL_NONE } from "./familyParental";
import { effectiveMaxRating, familyRightsSummary } from "./familyRightsSummary";

/**
 * Le résumé en lecture seule : il dit ce que le serveur a rendu, rien de
 * supposé, et renvoie au bureau ou au web pour modifier.
 */

const base: FamilyProfileDto = {
  userId: "g1", kind: "guest", name: "Petit", color: "teal", hasPin: false, imageTag: null,
  since: "2026-10-01T00:00:00.000Z", createdBy: "o1", createdByName: "Damien", rights: null,
};

const keys = (profile: FamilyProfileDto, libraries?: Parameters<typeof familyRightsSummary>[0]["libraries"]) =>
  familyRightsSummary({ profile, libraries }).lines.map((l) => l.key);

const LIBS = [
  { id: "a-1", name: "Films", collectionType: "movies" },
  { id: "b-2", name: "Séries", collectionType: "tvshows" },
  { id: "c-3", name: "Réservée", collectionType: "movies" },
];

describe("familyRightsSummary", () => {
  it("le propriétaire n'a rien à résumer", () => {
    expect(familyRightsSummary({ profile: { ...base, kind: "owner", createdBy: null } })).toEqual({ lines: [], editElsewhere: false });
  });

  it("un invité sans rien de connu : pas de demande, pas de Watch Together, rien hors ligne", () => {
    expect(keys(base)).toEqual(["requestTitles.off", "watchTogether.guest", "offline.guest"]);
    expect(familyRightsSummary({ profile: base }).editElsewhere).toBe(true);
  });

  it("peut demander, ou suspendu par l'administration", () => {
    expect(keys({ ...base, guestRights: { requestTitles: true } })[0]).toBe("requestTitles.on");
    expect(keys({ ...base, guestRights: { requestTitles: false, suspended: true } })[0]).toBe("requestTitles.suspended");
  });

  it("les bibliothèques : toutes, une, quelques-unes (identifiants comparés sans tirets), aucune", () => {
    const summary = (allowed: string[] | null) => familyRightsSummary({ profile: base, libraries: { available: LIBS, allowed } }).lines[0];
    expect(summary(null).key).toBe("libraries.all");
    expect(summary(["a1", "b2", "c3"]).key).toBe("libraries.all");
    expect(summary(["A-1"])).toEqual({ kind: "libraries", tone: "limited", key: "libraries.one", params: { count: 1, total: 3, names: "Films" } });
    expect(summary(["a-1", "b-2"]).params).toEqual({ count: 2, total: 3, names: "Films, Séries" });
    expect(summary(["inconnue"]).key).toBe("libraries.none");
  });

  it("l'âge appliqué est le plus strict du voulu et du plafond", () => {
    const ceiling = { ...GUEST_PARENTAL_NONE, allowedTags: [], maxParentalRating: 12 };
    expect(keys({ ...base, parental: { ...GUEST_PARENTAL_NONE, maxParentalRating: 16 }, parentalCeiling: ceiling })).toContain("age.upTo");
    const lines = familyRightsSummary({ profile: { ...base, parental: { ...GUEST_PARENTAL_NONE, maxParentalRating: 16 }, parentalCeiling: ceiling } }).lines;
    expect(lines.find((l) => l.kind === "age")?.params).toEqual({ age: 12 });
    expect(keys({ ...base, parental: GUEST_PARENTAL_NONE, parentalCeiling: null })).toContain("age.none");
    expect(keys({ ...base, parental: { ...GUEST_PARENTAL_NONE, maxParentalRating: 0 } })).toContain("age.allAudiences");
    expect(effectiveMaxRating(null, undefined)).toBeNull();
  });

  it("non classés, étiquettes et horaires se disent", () => {
    const parental = {
      ...GUEST_PARENTAL_NONE,
      blockUnratedItems: ["Movie" as const],
      blockedTags: ["cauchemar", "horreur"],
      accessSchedules: [{ dayOfWeek: "Everyday" as const, startHour: 8, endHour: 20 }],
    };
    const lines = familyRightsSummary({ profile: { ...base, parental } }).lines;
    expect(lines.map((l) => l.key)).toEqual(expect.arrayContaining(["unrated", "tags", "schedule"]));
    expect(lines.find((l) => l.kind === "tags")?.params).toEqual({ count: 2 });
  });

  it("un membre : parent, créer des invités, et le rappel du compte", () => {
    const member: FamilyProfileDto = { ...base, kind: "member", createdBy: null, createdByName: null, rights: { createGuests: true }, parent: true };
    expect(keys(member)).toEqual(["parent", "createGuests.on", "account"]);
    expect(keys({ ...member, parent: false, rights: { createGuests: false } })).toEqual(["createGuests.off", "account"]);
  });

  it("un champ absent (serveur d'avant, appelant qui ne règle pas) ne donne aucune ligne d'âge", () => {
    expect(keys(base).some((k) => k.startsWith("age."))).toBe(false);
  });
});
