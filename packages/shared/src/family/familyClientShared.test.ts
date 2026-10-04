import { describe, expect, it } from "vitest";
import type { FamilyDto, FamilyOverviewDto, FamilyProfileDto, FamilyRole } from "./familyContract";
import { familyRightsOf } from "./familyRights";
import { candidateView, familyOwnerName, familyViewerRole, isOwnProfile, profileActions } from "./familyClient";
import fr from "../i18n/locales/fr/family";
import en from "../i18n/locales/en/family";

/**
 * La famille PARTAGÉE vue par celui qui la regarde (v2, essai de Damien) :
 * le propriétaire retire et règle les droits ; un invité se gère par le
 * propriétaire ou par le membre qui l'a créé ; jamais un geste sur soi ni sur
 * le propriétaire ; un candidat grisé dit pourquoi, sans dire chez qui.
 */

const OWNER = "owner-id";
const ANA = "ana-id";
const BOB = "bob-id";

function profile(kind: FamilyProfileDto["kind"], userId: string, createdBy: string | null = null): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null,
    since: kind === "owner" ? null : "2026-10-04T00:00:00Z",
    createdBy, createdByName: createdBy, rights: kind === "member" ? { createGuests: true } : null,
  };
}

const profiles = [
  profile("owner", OWNER),
  profile("member", ANA),
  profile("member", BOB),
  profile("guest", "lea", OWNER),
  profile("guest", "tom", ANA),
];

function overview(role: FamilyRole | null, patch: Partial<FamilyOverviewDto["account"]> = {}): FamilyOverviewDto {
  const switches = { families: true, guests: true };
  const family: FamilyDto | null = role && {
    id: "f", role, owner: { userId: OWNER, name: "Damien" }, profiles, pendingInvitations: [],
    rights: familyRightsOf(role, role === "member" ? { createGuests: true } : null, switches),
    createdAt: "2026-10-01T00:00:00Z", since: role === "owner" ? null : "2026-10-02T00:00:00Z",
  };
  return {
    v: 2, switches, family, owned: null, memberships: [], incoming: [], limits: { maxProfiles: 6, maxGuests: 3 },
    account: { canOwn: role !== "member", canJoin: role === null, reviewAccount: false, hasPin: false, personalSession: true, ...patch },
  };
}

const find = (userId: string) => profiles.find((p) => p.userId === userId)!;

describe("le rôle et le propriétaire", () => {
  it("dit propriétaire, membre ou aucune famille, et le nom du propriétaire", () => {
    expect(familyViewerRole(overview("owner"))).toBe("owner");
    expect(familyViewerRole(overview("member"))).toBe("member");
    expect(familyViewerRole(overview(null))).toBe("none");
    expect(familyOwnerName(overview("member"))).toBe("Damien");
    expect(familyOwnerName(overview(null))).toBeNull();
  });

  it("reconnaît son propre profil, tirets et casse indifférents", () => {
    expect(isOwnProfile({ userId: "ABC-def" }, "abcdef")).toBe(true);
    expect(isOwnProfile({ userId: "abc" }, null)).toBe(false);
  });
});

describe("profileActions — le propriétaire", () => {
  const o = overview("owner");

  it("retire un membre et règle son droit de créer des invités", () => {
    expect(profileActions(o, find(ANA), OWNER)).toEqual({ pin: false, remove: true, right: "createGuests" });
  });

  it("gère TOUS les invités, même ceux d'un membre", () => {
    expect(profileActions(o, find("lea"), OWNER)).toEqual({ pin: true, remove: true, right: null });
    expect(profileActions(o, find("tom"), OWNER)).toEqual({ pin: true, remove: true, right: null });
  });

  it("ne fait rien sur lui-même", () => {
    expect(profileActions(o, find(OWNER), OWNER)).toEqual({ pin: false, remove: false, right: null });
  });
});

describe("profileActions — un membre", () => {
  const m = overview("member");

  it("ne gère que les invités qu'il a créés", () => {
    expect(profileActions(m, find("tom"), ANA)).toEqual({ pin: true, remove: true, right: null });
    expect(profileActions(m, find("lea"), ANA)).toEqual({ pin: false, remove: false, right: null });
    expect(profileActions(m, find("tom"), BOB)).toEqual({ pin: false, remove: false, right: null });
  });

  it("ne retire personne, ne règle aucun droit, ne touche ni au propriétaire ni à lui-même", () => {
    expect(profileActions(m, find(BOB), ANA)).toEqual({ pin: false, remove: false, right: null });
    expect(profileActions(m, find(OWNER), ANA)).toEqual({ pin: false, remove: false, right: null });
    expect(profileActions(m, find(ANA), ANA)).toEqual({ pin: false, remove: false, right: null });
  });
});

describe("profileActions — sans session personnelle ni famille", () => {
  it("n'offre rien en « voir en tant que », ni sans famille, ni sans identité connue", () => {
    expect(profileActions(overview("owner", { personalSession: false }), find(ANA), OWNER).remove).toBe(false);
    expect(profileActions(overview(null), find(ANA), OWNER).remove).toBe(false);
    expect(profileActions(overview("owner"), find(ANA), null).remove).toBe(false);
  });
});

describe("candidateView", () => {
  it("seul un compte disponible s'invite ; les autres disent pourquoi", () => {
    expect(candidateView({ status: "available" })).toEqual({ invitable: true, noteKey: null });
    expect(candidateView({ status: "in_family" })).toEqual({ invitable: false, noteKey: "family:candidates.inFamily" });
    expect(candidateView({ status: "invited" })).toEqual({ invitable: false, noteKey: "family:candidates.invited" });
    expect(candidateView({ status: "later" as never })).toEqual({ invitable: false, noteKey: null });
  });

  it("un serveur v1 ne pose pas de statut : ses candidats restent invitables", () => {
    expect(candidateView({})).toEqual({ invitable: true, noteKey: null });
    expect(candidateView({ status: null })).toEqual({ invitable: true, noteKey: null });
  });

  it("chaque raison a ses mots dans les deux langues", () => {
    for (const status of ["in_family", "invited"] as const) {
      const key = candidateView({ status }).noteKey!.replace("family:candidates.", "") as keyof typeof fr.candidates;
      expect(fr.candidates[key]).toBeTruthy();
      expect(en.candidates[key]).toBeTruthy();
    }
  });

  it("les mots v2 partagés ne disent jamais « téléchargement » (le mobile les lit)", () => {
    const text = JSON.stringify([fr.rights, fr.candidates, fr.addedBy, en.rights, en.candidates, en.addedBy]);
    expect(text).not.toMatch(/t[ée]l[ée]charg|download/i);
    expect(fr.rights.requestTitlesHint).toContain("{{owner}}");
    expect(en.rights.requestTitlesHint).toContain("{{owner}}");
  });
});
