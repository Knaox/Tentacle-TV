import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { octaveProfileMenu } from "./octaveProfileMenu";

/**
 * Octave — le menu du profil suit les règles de « Changer de profil » : rien
 * sans famille de plusieurs profils, hors ligne, ni face à un serveur qui ne
 * déclare pas les profils ; le profil actuel ; « Gérer » là où « Qui
 * regarde ? » l'offre.
 */

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return {
    userId,
    kind: "guest",
    name: userId,
    color: "pink",
    hasPin: false,
    imageTag: null,
    lockedUntil: null,
    createdBy: "owner",
    personal: false,
    ...extra,
  };
}

const owner = profile("owner", { kind: "owner", personal: true, createdBy: null });
const lea = profile("lea", { hasPin: true });
const sam = profile("sam");

function listing(profiles: PickerProfileDto[], pickerRequired = true): PickerProfilesDto {
  return { pickerRequired, profiles } as PickerProfilesDto;
}

describe("menu du profil d'Octave", () => {
  const base = { listing: listing([owner, lea, sam]), enabled: true, offline: false, activeProfileId: null };

  it("session personnelle : le profil du compte, « Gérer les profils » offert", () => {
    const menu = octaveProfileMenu(base);
    expect(menu?.current?.userId).toBe("owner");
    expect(menu?.profiles).toHaveLength(3);
    expect(menu?.canManage).toBe(true);
  });

  it("session d'un invité : son profil, et pas de « Gérer »", () => {
    const menu = octaveProfileMenu({ ...base, activeProfileId: "LEA" });
    expect(menu?.current?.userId).toBe("lea");
    expect(menu?.canManage).toBe(false);
  });

  it("aucun menu hors ligne, sans la capacité, sans liste, sans plusieurs profils, ou sans « Qui regarde ? »", () => {
    expect(octaveProfileMenu({ ...base, offline: true })).toBeNull();
    expect(octaveProfileMenu({ ...base, enabled: false })).toBeNull();
    expect(octaveProfileMenu({ ...base, listing: undefined })).toBeNull();
    expect(octaveProfileMenu({ ...base, listing: listing([owner]) })).toBeNull();
    expect(octaveProfileMenu({ ...base, listing: listing([owner, lea], false) })).toBeNull();
  });
});
