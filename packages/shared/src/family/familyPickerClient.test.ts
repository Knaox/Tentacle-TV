import { describe, expect, it } from "vitest";
import { FAMILY_PICKER_PLATFORMS, isPickerPlatform, type PickerProfileDto, type PickerProfilesDto } from "./familyPickerContract";
import {
  currentPickerProfile,
  isPickerProfileLocked,
  personalPickerProfile,
  pickedSessionToken,
  pickerLaunch,
  pickerShowsPinLock,
  showPickerAtLaunch,
} from "./familyPickerClient";

const profile = (userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto => ({
  userId,
  kind: "member",
  name: userId,
  color: "violet",
  hasPin: false,
  imageTag: null,
  lockedUntil: null,
  createdBy: null,
  personal: false,
  ...extra,
});

function listing(extra: Partial<PickerProfilesDto> = {}): PickerProfilesDto {
  return {
    v: 2,
    platform: "desktop",
    switches: { families: true, guests: true },
    account: { userId: "moi", name: "Moi" },
    profiles: [profile("moi", { kind: "owner", personal: true }), profile("zoe", { kind: "guest", createdBy: "moi" })],
    currentProfileId: "moi",
    pickerRequired: true,
    atLaunch: false,
    ...extra,
  };
}

describe("les plateformes de « Qui regarde ? »", () => {
  it("forment une liste fermée : le bureau, le mobile et le web (1.31.1), rien d'autre aujourd'hui", () => {
    expect(FAMILY_PICKER_PLATFORMS).toEqual(["desktop", "mobile", "web"]);
    for (const platform of ["desktop", "mobile", "web"]) expect(isPickerPlatform(platform)).toBe(true);
    for (const other of ["webos", "tv", "", null, 1, "constructor", "Web"]) expect(isPickerPlatform(other)).toBe(false);
  });
});

describe("« Qui regarde ? » au lancement", () => {
  it("ne paraît que si le compte l'a demandé ET qu'il y a au moins deux profils", () => {
    expect(showPickerAtLaunch({ atLaunch: true, pickerRequired: true })).toBe(true);
    expect(showPickerAtLaunch({ atLaunch: true, pickerRequired: false })).toBe(false);
    expect(showPickerAtLaunch({ atLaunch: false, pickerRequired: true })).toBe(false);
  });

  it("préférence coupée : la session du compte, comme avant", () => {
    expect(pickerLaunch(listing(), null)).toBe("personal");
  });

  it("préférence active : « Qui regarde ? », même avec une session de profil gardée", () => {
    expect(pickerLaunch(listing({ atLaunch: true, currentProfileId: "zoe" }), { profileId: "zoe" })).toBe("picker");
  });

  it("reprend la session de profil que l'application a gardée et que le serveur dit en cours", () => {
    expect(pickerLaunch(listing({ currentProfileId: "zoe" }), { profileId: "zoe" })).toBe("resume");
  });

  it("ne revient JAMAIS au compte sans son PIN quand l'appareil était sur un autre profil", () => {
    // Le jeton du profil perdu (ou un autre profil gardé) : « Qui regarde ? », pas la session du compte.
    expect(pickerLaunch(listing({ currentProfileId: "zoe" }), null)).toBe("picker");
    expect(pickerLaunch(listing({ currentProfileId: "zoe" }), { profileId: "autre" })).toBe("picker");
  });
});

describe("lecture de la réponse", () => {
  it("trouve le profil du compte et le profil en cours", () => {
    expect(personalPickerProfile(listing())?.userId).toBe("moi");
    expect(currentPickerProfile(listing({ currentProfileId: "zoe" }))?.kind).toBe("guest");
    expect(currentPickerProfile(listing({ currentProfileId: "inconnu" }))).toBeNull();
    expect(personalPickerProfile({ profiles: [] })).toBeNull();
  });

  it("dit un profil bloqué tant que son blocage court", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(isPickerProfileLocked({ lockedUntil: "2026-10-14T12:15:00Z" }, now)).toBe(true);
    expect(isPickerProfileLocked({ lockedUntil: "2026-10-14T11:59:59Z" }, now)).toBe(false);
    expect(isPickerProfileLocked({ lockedUntil: null }, now)).toBe(false);
  });

  it("rend le jeton d'une session de profil, rien pour le compte lui-même", () => {
    const zoe = profile("zoe", { kind: "guest" });
    expect(pickedSessionToken({ personal: false, token: "jwt", user: { id: "zoe", name: "Zoé" }, profile: zoe })).toBe("jwt");
    expect(pickedSessionToken({ personal: true, profile: profile("moi", { personal: true }) })).toBeNull();
  });
});

describe("le cadenas d'une tuile de « Qui regarde ? »", () => {
  it("fermé sur un profil qui demandera son code", () => {
    expect(pickerShowsPinLock(profile("lea", { hasPin: true }), [])).toBe(true);
    expect(pickerShowsPinLock(profile("lea", { hasPin: true }), ["zoe", null])).toBe(true);
  });

  it("TV : aucun sur le profil retenu (le serveur l'ouvre sans code), fermé sur un autre profil protégé", () => {
    const sticky = "zoe";
    expect(pickerShowsPinLock(profile("zoe", { hasPin: true }), [sticky])).toBe(false);
    expect(pickerShowsPinLock(profile("lea", { hasPin: true }), [sticky])).toBe(true);
  });

  it("aucun sur un profil sans code", () => {
    expect(pickerShowsPinLock(profile("lea"), [])).toBe(false);
  });

  it("aucun sur le profil que l'écran ouvre sans code (le profil en cours, déjà déverrouillé)", () => {
    expect(pickerShowsPinLock(profile("zoe", { hasPin: true }), ["zoe"])).toBe(false);
    // Identifiants Jellyfin : avec ou sans tirets, en toute casse.
    const id = "0f8f2b3c-1d2e-4f50-9a6b-7c8d9e0f1a2b";
    expect(pickerShowsPinLock(profile(id.replace(/-/g, ""), { hasPin: true }), [id.toUpperCase()])).toBe(false);
  });
});
