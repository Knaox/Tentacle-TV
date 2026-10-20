import { describe, expect, it } from "vitest";
import type { IncomingInvitationDto } from "./familyContract";
import type { PickerProfileDto, PickerProfilesDto } from "./familyPickerContract";
import {
  canSwitchMobileProfile,
  mobileProfilesEnabled,
  mobileStayIsStale,
  pendingInvitationCount,
  readMobileStay,
  writeMobileStay,
} from "./familyMobileProfiles";

const NOW = Date.parse("2026-10-20T03:00:00Z");

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return {
    userId, kind: "member", name: userId, color: "violet", hasPin: false, imageTag: null,
    lockedUntil: null, createdBy: null, personal: false, ...extra,
  };
}

function listing(extra: Partial<PickerProfilesDto> = {}): PickerProfilesDto {
  return {
    v: 2, platform: "mobile", switches: { families: true, guests: true },
    account: { userId: "damien", name: "Damien" },
    profiles: [profile("damien", { kind: "owner", personal: true }), profile("lea"), profile("zoe", { kind: "guest", createdBy: "damien" })],
    currentProfileId: "damien", pickerRequired: true, atLaunch: false, ...extra,
  };
}

const gate = { capable: true, family: { v: 2, enabled: true, guests: true } as never, offline: false, hasAccountSession: true };

describe("« Qui regarde ? » sur le mobile", () => {
  it("n'existe que si le serveur déclare la capacité (un serveur qui ne déclare rien : rien)", () => {
    expect(mobileProfilesEnabled(gate)).toBe(true);
    expect(mobileProfilesEnabled({ ...gate, capable: false })).toBe(false);
    expect(mobileProfilesEnabled({ ...gate, family: undefined })).toBe(false);
    expect(mobileProfilesEnabled({ ...gate, offline: true })).toBe(false);
    expect(mobileProfilesEnabled({ ...gate, hasAccountSession: false })).toBe(false);
  });

  it("« Changer de profil » seulement quand la famille compte plus d'une personne", () => {
    expect(canSwitchMobileProfile(gate, listing())).toBe(true);
    expect(canSwitchMobileProfile(gate, listing({ pickerRequired: false }))).toBe(false);
    expect(canSwitchMobileProfile(gate, null)).toBe(false);
    expect(canSwitchMobileProfile({ ...gate, capable: false }, listing())).toBe(false);
  });

  it("un choix qui ne vaut plus s'oublie : code posé depuis, profil disparu ; bloqué, il reste", () => {
    const withPin = listing({ profiles: [profile("damien", { kind: "owner", personal: true, hasPin: true }), profile("lea")] });
    expect(mobileStayIsStale(withPin, { profileId: "damien", hasPin: false }, NOW)).toBe(true);
    expect(mobileStayIsStale(listing(), { profileId: "parti", hasPin: false }, NOW)).toBe(true);
    const locked = listing({ profiles: [profile("damien", { kind: "owner", personal: true, lockedUntil: "2026-10-20T04:00:00Z" }), profile("lea")] });
    expect(mobileStayIsStale(locked, { profileId: "damien", hasPin: false }, NOW)).toBe(false);
  });

  it("le choix se garde par serveur et par compte, sans toucher aux autres", () => {
    let raw = writeMobileStay(null, "https://Tv.Exemple.fr/", "AB-CD", { profileId: "lea", hasPin: true });
    raw = writeMobileStay(raw, "https://autre.fr", "ab-cd", { profileId: "zoe", hasPin: false });
    expect(readMobileStay(raw, "https://tv.exemple.fr", "abcd")).toEqual({ profileId: "lea", hasPin: true });
    raw = writeMobileStay(raw, "https://tv.exemple.fr", "abcd", null);
    expect(readMobileStay(raw, "https://tv.exemple.fr", "abcd")).toBeNull();
    expect(readMobileStay(raw, "https://autre.fr", "abcd")).toEqual({ profileId: "zoe", hasPin: false });
    expect(readMobileStay("pas du json", "https://autre.fr", "abcd")).toBeNull();
    expect(readMobileStay(JSON.stringify({ "x|y": { profileId: 3 } }), "x", "y")).toBeNull();
  });
});

describe("le badge des invitations", () => {
  const invitation = (id: string, expiresAt: string, snoozedUntil: string | null = null): IncomingInvitationDto => ({
    id, familyId: "f", ownerUserId: "o", ownerName: "Damien", createdAt: "2026-10-19T00:00:00Z", expiresAt, snoozedUntil,
  });
  it("compte les invitations valables, « Plus tard » comprises, jamais les échues", () => {
    expect(pendingInvitationCount([
      invitation("a", "2026-10-27T00:00:00Z"),
      invitation("b", "2026-10-27T00:00:00Z", "2026-10-21T00:00:00Z"),
      invitation("c", "2026-10-19T00:00:00Z"),
    ], NOW)).toBe(2);
    expect(pendingInvitationCount(undefined, NOW)).toBe(0);
  });
});
