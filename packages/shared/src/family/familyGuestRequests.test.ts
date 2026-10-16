import { describe, expect, it } from "vitest";
import type { FamilyOverviewDto } from "./familyContract";
import { mayGrantGuestRequests } from "./familyClient";
import { FAMILY_CREATION_DEFAULTS, FAMILY_DEFAULT_CREATION_RIGHTS, guestRequestState, resolveFamilyCreation } from "./familyRoles";

/**
 * « Les invités peuvent demander des films » (1.30.0, `family.guestRequestsAdmin`) :
 * l'interrupteur de l'administration, le droit du compte qui agit, et la case d'un
 * invité suspendue — gardée — quand ce droit manque.
 */

const ON = { families: true, guests: true, guestRequests: true };
const base = { rights: FAMILY_DEFAULT_CREATION_RIGHTS, defaults: FAMILY_CREATION_DEFAULTS, switches: ON, isAdministrator: false, requestExtension: true };

describe("resolveFamilyCreation — grantGuestRequests", () => {
  it("défaut NON : un compte ne le donne pas tant que l'administration ne l'a pas permis", () => {
    expect(resolveFamilyCreation(base).grantGuestRequests).toBe(false);
    expect(resolveFamilyCreation({ ...base, defaults: { ...FAMILY_CREATION_DEFAULTS, grantGuestRequests: true } }).grantGuestRequests).toBe(true);
  });

  it("permis à CE compte, ou administrateur Jellyfin : oui", () => {
    expect(resolveFamilyCreation({ ...base, rights: { ...FAMILY_DEFAULT_CREATION_RIGHTS, grantGuestRequests: "allow" } }).grantGuestRequests).toBe(true);
    expect(resolveFamilyCreation({ ...base, isAdministrator: true, rights: { ...FAMILY_DEFAULT_CREATION_RIGHTS, grantGuestRequests: "deny" } }).grantGuestRequests).toBe(true);
  });

  it("l'interrupteur est un coupe-circuit : coupé ou absent, personne — administrateur et défaut OUI compris", () => {
    const everyone = { ...base, isAdministrator: true, defaults: { ...FAMILY_CREATION_DEFAULTS, grantGuestRequests: true } };
    expect(resolveFamilyCreation({ ...everyone, switches: { ...ON, guestRequests: false } }).grantGuestRequests).toBe(false);
    expect(resolveFamilyCreation({ ...everyone, switches: { families: true, guests: true } }).grantGuestRequests).toBe(false);
    expect(resolveFamilyCreation({ ...everyone, switches: { ...ON, guests: false } }).grantGuestRequests).toBe(false);
  });

  it("sans extension qui sait demander un titre : non", () => {
    expect(resolveFamilyCreation({ ...base, isAdministrator: true, requestExtension: false }).grantGuestRequests).toBe(false);
    expect(resolveFamilyCreation({ ...base, isAdministrator: true, requestExtension: undefined }).grantGuestRequests).toBe(false);
  });
});

describe("guestRequestState — la case gardée, suspendue sans le droit", () => {
  it("cochée et permise : en vigueur ; cochée sans le droit : suspendue ; décochée : rien", () => {
    expect(guestRequestState(true, true)).toEqual({ requestTitles: true });
    expect(guestRequestState(true, false)).toEqual({ requestTitles: false, suspended: true });
    expect(guestRequestState(false, false)).toEqual({ requestTitles: false });
    expect(guestRequestState(false, true)).toEqual({ requestTitles: false });
  });
});

function overview(creation: FamilyOverviewDto["account"]["creation"], switches = ON): FamilyOverviewDto {
  return {
    v: 2, switches, family: null, owned: null, memberships: [], incoming: [], limits: { maxProfiles: 6, maxGuests: 3 },
    account: { canOwn: true, canJoin: false, reviewAccount: false, hasPin: false, personalSession: true, creation },
  };
}

describe("mayGrantGuestRequests — la case s'offre au compte qui agit", () => {
  const CAN = { guestRequests: true };
  it("serveur 1.30.0 : seulement si l'administration le permet à CE compte", () => {
    expect(mayGrantGuestRequests(overview({ createFamily: true, createGuests: true, grantGuestRequests: true }), CAN)).toBe(true);
    expect(mayGrantGuestRequests(overview({ createFamily: true, createGuests: true, grantGuestRequests: false }), CAN)).toBe(false);
  });

  it("serveur d'avant (aucun `grantGuestRequests`) : comme alors", () => {
    expect(mayGrantGuestRequests(overview({ createFamily: true, createGuests: true }), CAN)).toBe(true);
    expect(mayGrantGuestRequests(overview(undefined), CAN)).toBe(true);
  });

  it("jamais sans le droit annoncé par le serveur, ni invités coupés", () => {
    const allowed = { createFamily: true, createGuests: true, grantGuestRequests: true };
    expect(mayGrantGuestRequests(overview(allowed), {})).toBe(false);
    expect(mayGrantGuestRequests(overview(allowed, { ...ON, guests: false }), CAN)).toBe(false);
  });
});
