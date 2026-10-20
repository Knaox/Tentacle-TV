import { describe, expect, it } from "vitest";
import { accountAbilitiesOf, type AbilityInputs } from "./accountAbilities";

/**
 * « Tout ce que tu as le droit de faire, tu le vois ; le reste, non » : la
 * réponse dit chaque droit tel que les portes l'appliquent.
 */

const all: AbilityInputs = {
  session: "personal", isAdmin: true, guest: false, playback: true, downloads: true, watchTogether: "full",
  publicSharing: true, deletion: { everywhere: true, libraryIds: [] }, guestExtensions: false,
};

describe("accountAbilitiesOf", () => {
  it("un administrateur en session personnelle : tout", () => {
    expect(accountAbilitiesOf(all)).toEqual({
      session: "personal", administrator: true, playback: true, keepOffline: true, watchTogether: "full",
      publicSharing: true, deleteTitles: true, tickets: true, extensions: true, manageAccount: true,
      pairDevices: true, push: true, invites: true,
    });
  });

  it("chaque droit retiré au bureau disparaît seul", () => {
    const user = accountAbilitiesOf({ ...all, isAdmin: false, playback: false, downloads: false, watchTogether: "joinOnly", publicSharing: false, deletion: { everywhere: false, libraryIds: [] } });
    expect(user).toMatchObject({ administrator: false, invites: false, playback: false, keepOffline: false, watchTogether: "joinOnly", publicSharing: false, deleteTitles: false });
    expect(user).toMatchObject({ tickets: true, manageAccount: true, pairDevices: true, push: true });
    expect(accountAbilitiesOf({ ...all, deletion: { everywhere: false, libraryIds: ["films"] } }).deleteTitles).toBe(true);
  });

  it("session de profil d'un membre : regarde, n'administre rien", () => {
    const member = accountAbilitiesOf({ ...all, session: "tvProfile" });
    expect(member).toMatchObject({ session: "profile", administrator: false, keepOffline: false, deleteTitles: false, manageAccount: false, pairDevices: false, push: false, invites: false });
    expect(member).toMatchObject({ watchTogether: "full", tickets: true, extensions: true, publicSharing: true });
  });

  it("invité : ni Watch Together, ni tickets, ni partage ; les extensions avec « peut demander » seulement", () => {
    const guest = accountAbilitiesOf({ ...all, session: "tvProfile", guest: true });
    expect(guest).toMatchObject({ session: "guest", watchTogether: "none", tickets: false, publicSharing: false, extensions: false });
    expect(accountAbilitiesOf({ ...all, session: "tvProfile", guest: true, guestExtensions: true }).extensions).toBe(true);
  });

  it("« voir en tant que » et une TV d'avant les profils n'administrent rien", () => {
    expect(accountAbilitiesOf({ ...all, session: "impersonation" })).toMatchObject({ session: "viewAs", administrator: false, push: false, keepOffline: false });
    expect(accountAbilitiesOf({ ...all, session: "tvLegacy" })).toMatchObject({ administrator: false, manageAccount: false, keepOffline: false });
  });
});
