import { describe, expect, it } from "vitest";
import { PLAIN_RIGHTS } from "./rightsFixture";
import { groupSummary, hasParentalRestriction, lockedForSelf, needsConfirmation, refusalKey } from "./rightsModel";

/** La fiche des droits, sans React : résumés des rubriques, gestes figés et confirmés. */

const context = { libraryCount: 4, ratingName: null };
const keys = (parts: { key: string }[]) => parts.map((part) => part.key);

describe("le résumé d'une rubrique", () => {
  it("dit l'essentiel du compte, désactivé en tête", () => {
    expect(keys(groupSummary("account", PLAIN_RIGHTS, context))).toEqual(["summary.standard", "summary.hidden"]);
    const locked = { ...PLAIN_RIGHTS, isDisabled: true, isAdministrator: true, isHidden: false, enableRemoteAccess: false };
    expect(keys(groupSummary("account", locked, context))).toEqual(["summary.disabled", "summary.admin", "summary.localOnly"]);
  });

  it("compte les bibliothèques permises sur le total", () => {
    const some = { ...PLAIN_RIGHTS, enableAllFolders: false, enabledFolders: ["a"] };
    expect(groupSummary("libraries", some, context)).toEqual([{ key: "summary.someLibraries", values: { count: 1, total: 4 } }]);
  });

  it("nomme la note maximale, sinon son score, puis ce qui est bloqué", () => {
    expect(keys(groupSummary("parental", PLAIN_RIGHTS, context))).toEqual(["summary.noParental"]);
    const kid = { ...PLAIN_RIGHTS, maxParentalRating: 10, blockedTags: ["horreur"], accessSchedules: [{ dayOfWeek: "Everyday" as const, startHour: 8, endHour: 20 }] };
    expect(groupSummary("parental", kid, { ...context, ratingName: "FR-10" })[0]).toEqual({ key: "summary.ratingMax", values: { rating: "FR-10" } });
    expect(keys(groupSummary("parental", kid, context))).toEqual(["summary.ratingMaxScore", "summary.blockedTags", "summary.schedules"]);
  });

  it("dit la lecture interdite avant tout le reste, et le débit en Mbit/s", () => {
    expect(keys(groupSummary("playback", { ...PLAIN_RIGHTS, enableMediaPlayback: false, remoteClientBitrateLimit: 4e6 }, context)))
      .toEqual(["summary.noPlayback"]);
    expect(groupSummary("playback", { ...PLAIN_RIGHTS, remoteClientBitrateLimit: 4_500_000 }, context))
      .toEqual([{ key: "summary.bitrate", values: { mbps: 4.5 } }]);
  });

  it("résume hors ligne et gestion", () => {
    expect(keys(groupSummary("offline", PLAIN_RIGHTS, context))).toEqual(["summary.download"]);
    expect(groupSummary("management", PLAIN_RIGHTS, context)).toEqual([{ key: "summary.managementCount", values: { count: 2 } }]);
  });
});

describe("les garde-fous de la fiche", () => {
  it("une restriction de contenu se voit dès une étiquette ou un type non classé", () => {
    expect(hasParentalRestriction(PLAIN_RIGHTS)).toBe(false);
    expect(hasParentalRestriction({ ...PLAIN_RIGHTS, allowedTags: ["enfants"] })).toBe(true);
    expect(hasParentalRestriction({ ...PLAIN_RIGHTS, blockUnratedItems: ["Movie"] })).toBe(true);
  });

  it("un administrateur ne se retire pas l'administration et ne se désactive pas", () => {
    const admin = { ...PLAIN_RIGHTS, isAdministrator: true };
    expect(lockedForSelf("isAdministrator", true, admin)).toBe(true);
    expect(lockedForSelf("isDisabled", true, admin)).toBe(true);
    expect(lockedForSelf("isAdministrator", false, admin)).toBe(false);
    expect(lockedForSelf("isHidden", true, admin)).toBe(false);
  });

  it("donner l'administration et désactiver demandent confirmation, pas l'inverse", () => {
    expect(needsConfirmation("isAdministrator", true)).toBe(true);
    expect(needsConfirmation("isDisabled", true)).toBe(true);
    expect(needsConfirmation("isDisabled", false)).toBe(false);
    expect(needsConfirmation("isHidden", true)).toBe(false);
  });

  it("chaque refus a ses mots, un refus inconnu aussi", () => {
    expect(refusalKey("last_admin")).toBe("refusal.last_admin");
    expect(refusalKey(null)).toBe("refusal.unknown");
  });
});

describe("le résumé du contrôle parental face à « Jamais »", () => {
  it("dit qu'aucune plage n'est permise, pas « 1 plage horaire »", () => {
    const never = { ...PLAIN_RIGHTS, accessSchedules: [{ dayOfWeek: "Sunday" as const, startHour: 24, endHour: 24 }] };
    expect(keys(groupSummary("parental", never, context))).toEqual(["summary.scheduleNever"]);
  });
});
