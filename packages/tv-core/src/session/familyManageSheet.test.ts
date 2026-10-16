import { describe, expect, it } from "vitest";
import type { FamilyProfileDto, FamilyRights } from "@tentacle-tv/shared";
import { manageGesturesOf, sheetRemoval, type ManageSheetCapability, type ManageSheetContext } from "./familyManageSheet";
import { manageGestureKeys, manageSheetEntryKey, manageSheetFocusAfter, manageSheetGuardedKeys, manageSheetKey } from "../focus/manageSheetFocus";

/** La fiche d'un profil dans « Gérer les profils » (TV, décisions du 16/10). */

const OWNER: FamilyRights = { manageMembers: true, createGuests: true, manageGuests: "all", manageRoles: true, manageMinors: true };
const PARENT: FamilyRights = { manageMembers: false, createGuests: true, manageGuests: "all", manageRoles: false, manageMinors: true };
const MEMBER: FamilyRights = { manageMembers: false, createGuests: true, manageGuests: "own", manageRoles: false, manageMinors: false };
const ALL: ManageSheetCapability = { guestRequests: true, guestPhotos: true, roles: true, guestParental: true, memberParental: true };

const profile = (userId: string, kind: FamilyProfileDto["kind"], patch: Partial<FamilyProfileDto> = {}): FamilyProfileDto => ({
  userId, kind, name: userId, color: "teal", hasPin: false, imageTag: null, since: null, createdBy: null, createdByName: null,
  rights: kind === "member" ? { createGuests: false } : null, ...patch,
});

const LEO = profile("leo", "guest", { createdBy: "anne", hasPin: true });
const MIA = profile("mia", "guest", { createdBy: "paul" });
const ADO = profile("ado", "member");
const PAUL = profile("paul", "member", { parent: true });

const context = (rights: FamilyRights, actorId: string, capability = ALL): ManageSheetContext => ({
  rights, actorId, switches: { families: true, guests: true }, capability,
});
const kinds = (gestures: ReturnType<typeof manageGesturesOf>) => gestures.map((gesture) => gesture.kind);

describe("la fiche d'un invité", () => {
  it("le propriétaire et un parent : photo, code, « peut demander », contrôle parental, supprimer", () => {
    expect(kinds(manageGesturesOf(LEO, context(OWNER, "anne")))).toEqual(["photo", "pin", "requestTitles", "parental", "delete"]);
    // Le parent gère TOUS les invités, même ceux du propriétaire.
    expect(kinds(manageGesturesOf(LEO, context(PARENT, "paul")))).toEqual(["photo", "pin", "requestTitles", "parental", "delete"]);
    expect(manageGesturesOf(LEO, context(OWNER, "anne"))[1]).toEqual({ kind: "pin", hasPin: true });
  });

  it("un membre : seulement les invités qu'il a créés, sans « peut demander »", () => {
    expect(kinds(manageGesturesOf(MIA, context(MEMBER, "paul")))).toEqual(["photo", "pin", "parental", "delete"]);
    expect(manageGesturesOf(LEO, context(MEMBER, "paul"))).toEqual([]);
  });

  it("ne propose rien que ce serveur ou cette TV ne sait faire", () => {
    expect(kinds(manageGesturesOf(LEO, context(OWNER, "anne", {})))).toEqual(["pin", "delete"]);
    const off = { ...context(OWNER, "anne"), switches: { families: true, guests: false } };
    expect(kinds(manageGesturesOf(LEO, off))).not.toContain("requestTitles");
  });
});

describe("la fiche d'un membre", () => {
  it("le propriétaire : parent, « peut créer des invités », contrôle parental d'un mineur, retirer", () => {
    expect(kinds(manageGesturesOf(ADO, context(OWNER, "anne")))).toEqual(["parentRole", "createGuests", "parental", "remove"]);
    // Un parent crée des invités d'office, et n'a pas de contrôle parental.
    expect(manageGesturesOf(PAUL, context(OWNER, "anne"))).toEqual([{ kind: "parentRole", on: true }, { kind: "remove" }]);
  });

  it("un parent : le contrôle parental d'un mineur, rien d'autre — jamais d'un autre parent", () => {
    expect(manageGesturesOf(ADO, context(PARENT, "paul"))).toEqual([{ kind: "parental" }]);
    expect(manageGesturesOf(profile("eve", "member", { parent: true }), context(PARENT, "paul"))).toEqual([]);
    expect(manageGesturesOf(ADO, context(MEMBER, "paul"))).toEqual([]);
  });

  it("jamais la session elle-même, ni le propriétaire", () => {
    expect(manageGesturesOf(PAUL, context(PARENT, "paul"))).toEqual([]);
    expect(manageGesturesOf(profile("anne", "owner"), context(PARENT, "paul"))).toEqual([]);
  });

  it("dit le geste qui retire le profil", () => {
    expect(sheetRemoval(manageGesturesOf(ADO, context(OWNER, "anne")))).toBe("remove");
    expect(sheetRemoval(manageGesturesOf(LEO, context(OWNER, "anne")))).toBe("delete");
    expect(sheetRemoval(manageGesturesOf(ADO, context(PARENT, "paul")))).toBeNull();
  });
});

describe("le focus de la fiche", () => {
  const gestures = manageGesturesOf(LEO, context(OWNER, "anne"));

  it("entre par le premier geste ; le code a deux boutons quand il est posé", () => {
    expect(manageSheetEntryKey(gestures)).toBe(manageSheetKey("photo"));
    expect(manageGestureKeys({ kind: "pin", hasPin: true })).toEqual(["manage:sheet:pin:change", "manage:sheet:pin:remove"]);
    expect(manageGestureKeys({ kind: "pin", hasPin: false })).toEqual(["manage:sheet:pin:create"]);
    expect(manageSheetEntryKey([])).toBeNull();
  });

  it("un code posé ou retiré garde le focus sur la rangée du code", () => {
    const withoutPin = gestures.map((gesture) => (gesture.kind === "pin" ? { kind: "pin" as const, hasPin: false } : gesture));
    expect(manageSheetFocusAfter(withoutPin, "manage:sheet:pin:remove")).toBe("manage:sheet:pin:create");
    expect(manageSheetFocusAfter(gestures, "manage:sheet:pin:create")).toBe("manage:sheet:pin:change");
    expect(manageSheetFocusAfter(gestures, manageSheetKey("requestTitles"))).toBe(manageSheetKey("requestTitles"));
    expect(manageSheetFocusAfter(gestures, null)).toBe(manageSheetKey("photo"));
  });

  it("garde chaque bouton possible du clic fantôme", () => {
    const keys = manageSheetGuardedKeys();
    for (const gesture of gestures) for (const key of manageGestureKeys(gesture)) expect(keys).toContain(key);
    expect(keys).toContain(manageSheetKey("parentRole"));
  });
});
