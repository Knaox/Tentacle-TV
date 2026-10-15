import { describe, expect, it } from "vitest";
import type { DismissibleHint } from "../help/dismissibleHints";
import type { FamilyAccountDto, FamilyDto, FamilyOverviewDto, FamilyProfileDto } from "./familyContract";
import { familyPinReminder, type FamilyPinHintsState } from "./familyPinReminder";

function profile(kind: FamilyProfileDto["kind"], userId: string): FamilyProfileDto {
  return {
    userId, kind, name: userId, color: "violet", hasPin: false, imageTag: null, since: null,
    createdBy: null, createdByName: null, rights: null,
  };
}

function account(patch: Partial<FamilyAccountDto> = {}): FamilyAccountDto {
  return { canOwn: false, canJoin: false, reviewAccount: false, hasPin: false, personalSession: true, ...patch };
}

function family(role: FamilyDto["role"]): FamilyDto {
  return {
    id: "fam", role, owner: { userId: "owner", name: "Owner" },
    profiles: [profile("owner", "owner"), profile("member", "member"), profile("guest", "guest")],
    pendingInvitations: [], rights: { manageMembers: role === "owner", createGuests: false, manageGuests: "none" },
    createdAt: "2026-10-01T00:00:00Z", since: null,
  };
}

function overview(patch: Partial<FamilyAccountDto> = {}, role: FamilyDto["role"] | null = "member"): Pick<FamilyOverviewDto, "account" | "family"> {
  return { account: account(patch), family: role ? family(role) : null };
}

const hints = (dismissed: DismissibleHint[] = [], known: DismissibleHint[] = ["familyPin"]): FamilyPinHintsState => ({ dismissed, known });

describe("familyPinReminder", () => {
  it("propriétaire ou membre sans code PIN : la carte et la fenêtre de démarrage", () => {
    expect(familyPinReminder({ overview: overview({}, "owner"), hints: hints() })).toEqual({ card: true, startup: true });
    expect(familyPinReminder({ overview: overview({}, "member"), hints: hints() })).toEqual({ card: true, startup: true });
  });

  it("rien sans famille, ni tant que la Famille n'a pas répondu", () => {
    expect(familyPinReminder({ overview: overview({}, null), hints: hints() })).toEqual({ card: false, startup: false });
    expect(familyPinReminder({ overview: undefined, hints: hints() })).toEqual({ card: false, startup: false });
    expect(familyPinReminder({ overview: null, hints: hints() })).toEqual({ card: false, startup: false });
  });

  it("rien avec un code PIN posé, hors session personnelle, ni pour le compte de démonstration", () => {
    expect(familyPinReminder({ overview: overview({ hasPin: true }), hints: hints() }).card).toBe(false);
    expect(familyPinReminder({ overview: overview({ personalSession: false }), hints: hints() }).card).toBe(false);
    expect(familyPinReminder({ overview: overview({ reviewAccount: true }), hints: hints() }).card).toBe(false);
  });

  it("rien pour un invité qui se reconnaît parmi les profils", () => {
    expect(familyPinReminder({ overview: overview(), hints: hints(), userId: "GUEST" }).card).toBe(false);
    expect(familyPinReminder({ overview: overview(), hints: hints(), userId: "member" }).card).toBe(true);
  });

  it("la fenêtre de démarrage attend les rappels du compte, et se tait une fois masquée", () => {
    expect(familyPinReminder({ overview: overview(), hints: undefined })).toEqual({ card: true, startup: false });
    expect(familyPinReminder({ overview: overview(), hints: hints(["familyPin"]) })).toEqual({ card: true, startup: false });
  });

  it("un serveur qui ne sait pas retenir le rappel : la carte seule, jamais la fenêtre", () => {
    expect(familyPinReminder({ overview: overview(), hints: hints([], ["trailerHelp"]) })).toEqual({ card: true, startup: false });
  });
});
