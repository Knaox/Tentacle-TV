import { describe, expect, it } from "vitest";
import { familyRightsSummary, type FamilyProfileDto } from "@tentacle-tv/shared";
import { RIGHTS_SUMMARY_ICONS, readsProfileLibraries } from "./rightsSummaryIcons";

/**
 * Le panneau d'un profil sur le mobile : ses droits en lecture seule, renvoyés
 * au bureau ou au web — plus aucun interrupteur de droit ici.
 */

const guest: FamilyProfileDto = {
  userId: "g", kind: "guest", name: "Petit", color: "teal", hasPin: false, imageTag: null,
  since: null, createdBy: "o", createdByName: "Damien", rights: null, guestRights: { requestTitles: true },
};

describe("résumé des droits sur le mobile", () => {
  it("chaque ligne a son icône, et « Modifier sur le bureau ou le web » s'affiche", () => {
    const summary = familyRightsSummary({ profile: guest });
    for (const line of summary.lines) expect(RIGHTS_SUMMARY_ICONS[line.kind]).toBeTruthy();
    expect(summary.editElsewhere).toBe(true);
  });

  it("les bibliothèques ne se lisent que pour un profil que le serveur laisse régler", () => {
    expect(readsProfileLibraries({ capable: true, parentalShown: true })).toBe(true);
    expect(readsProfileLibraries({ capable: true, parentalShown: false })).toBe(false);
    expect(readsProfileLibraries({ capable: false, parentalShown: true })).toBe(false);
  });
});
