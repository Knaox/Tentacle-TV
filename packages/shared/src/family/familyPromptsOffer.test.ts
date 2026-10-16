import { describe, expect, it } from "vitest";
import type { FamilyOverviewDto, FamilyProfileDto, FamilyRights } from "./familyContract";
import { familyRightsOf } from "./familyRights";
import { promptsResetOffer } from "./familyPromptsOffer";

const ON = { families: true, guests: true };

function profile(kind: FamilyProfileDto["kind"], userId: string, patch: Partial<FamilyProfileDto> = {}): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null, since: null,
    createdBy: kind === "guest" ? "owner" : null, createdByName: null, rights: null, ...patch,
  };
}

function view(rights: FamilyRights, account: Partial<FamilyOverviewDto["account"]> = {}): Pick<FamilyOverviewDto, "account" | "family"> {
  return {
    account: { canOwn: true, canJoin: false, reviewAccount: false, hasPin: false, personalSession: true, ...account },
    family: {
      id: "f", role: "owner", owner: { userId: "owner", name: "owner" }, profiles: [], pendingInvitations: [],
      rights, createdAt: "2026-10-16T00:00:00Z", since: null,
    },
  };
}

const OWNER = view(familyRightsOf("owner", null, ON));
const MEMBER = view(familyRightsOf("member", { createGuests: true }, ON));
const PARENT = view(familyRightsOf("member", null, ON, { parent: true }));

describe("promptsResetOffer — le bouton « Reproposer le code PIN et la photo »", () => {
  it("le propriétaire, pour un membre sans code ou sans photo : les deux étapes", () => {
    expect(promptsResetOffer(OWNER, profile("member", "hugo"), "owner")).toBe("pinAndPhoto");
    expect(promptsResetOffer(OWNER, profile("member", "hugo", { hasPin: true }), "owner")).toBe("pinAndPhoto");
    expect(promptsResetOffer(OWNER, profile("member", "hugo", { imageTag: "t" }), "owner")).toBe("pinAndPhoto");
  });

  it("rien à reproposer quand le code et la photo sont là", () => {
    expect(promptsResetOffer(OWNER, profile("member", "hugo", { hasPin: true, imageTag: "t" }), "owner")).toBeNull();
  });

  it("un invité : la photo seulement, et seulement s'il n'en a pas", () => {
    expect(promptsResetOffer(OWNER, profile("guest", "zoe"), "owner")).toBe("photo");
    expect(promptsResetOffer(OWNER, profile("guest", "zoe", { imageTag: "t" }), "owner")).toBeNull();
  });

  it("chacun pour lui-même, même un membre simple", () => {
    expect(promptsResetOffer(MEMBER, profile("member", "hugo"), "hugo")).toBe("pinAndPhoto");
  });

  it("un membre simple : ni un autre membre, ni le propriétaire, ni l'invité d'un autre — son invité, oui", () => {
    expect(promptsResetOffer(MEMBER, profile("member", "lea"), "hugo")).toBeNull();
    expect(promptsResetOffer(MEMBER, profile("owner", "owner"), "hugo")).toBeNull();
    expect(promptsResetOffer(MEMBER, profile("guest", "zoe"), "hugo")).toBeNull();
    expect(promptsResetOffer(MEMBER, profile("guest", "zoe", { createdBy: "hugo" }), "hugo")).toBe("photo");
  });

  it("un parent : les invités et les membres mineurs, jamais un autre parent", () => {
    expect(promptsResetOffer(PARENT, profile("guest", "zoe"), "lea")).toBe("photo");
    expect(promptsResetOffer(PARENT, profile("member", "hugo"), "lea")).toBe("pinAndPhoto");
    expect(promptsResetOffer(PARENT, profile("member", "max", { parent: true }), "lea")).toBeNull();
  });

  it("une session qui ne gère pas (un profil sans gestion ouverte), ou sans famille : rien", () => {
    expect(promptsResetOffer(view(familyRightsOf("owner", null, ON), { personalSession: false }), profile("member", "hugo"), "owner")).toBeNull();
    expect(promptsResetOffer({ ...OWNER, family: null }, profile("member", "hugo"), "owner")).toBeNull();
    expect(promptsResetOffer(OWNER, profile("member", "hugo"), null)).toBeNull();
  });
});
