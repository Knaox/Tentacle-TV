import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "./familyPickerContract";
import {
  MOBILE_PROFILE_LAUNCH_KEY,
  mobileLaunchAsked,
  mobileProfileLaunch,
  mobileProposesAtLaunch,
  mobileStayInitial,
  readMobileLaunchChoice,
  writeMobileLaunchChoice,
} from "./familyMobileLaunch";
import { readMobileStay, writeMobileStay } from "./familyMobileProfiles";

const NOW = Date.parse("2026-10-21T03:00:00Z");
const SERVER = "https://tv.exemple.fr";

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

const damien = { profileId: "damien", hasPin: false };
const lea = { profileId: "lea", hasPin: false };

describe("« Qui regarde ? » au démarrage du mobile", () => {
  it("proposé par défaut dès deux profils ; seul : le compte, sans écran", () => {
    expect(mobileProfileLaunch(listing(), null, "unset", null, NOW)).toBe("picker");
    expect(mobileProfileLaunch(listing(), null, "ask", damien, NOW)).toBe("picker");
    expect(mobileProfileLaunch(listing({ pickerRequired: false }), null, "unset", null, NOW)).toBe("personal");
  });

  it("reprise de l'ancienne mémoire : un profil retenu hier, sans choix, reçoit le nouveau défaut (proposer)", () => {
    // Avant le 21/10, tout choix était retenu sous `tentacle_mobile_profile_stay` — et aucun choix d'appareil.
    const raw = writeMobileStay(null, SERVER, "damien", damien);
    const choice = readMobileLaunchChoice(null, SERVER, "damien");
    expect(choice).toBe("unset");
    expect(mobileProfileLaunch(listing(), null, choice, readMobileStay(raw, SERVER, "damien"), NOW)).toBe("picker");
    expect(mobileStayInitial(listing(), choice, damien, NOW)).toBe(false);
  });

  it("case cochée : le dernier profil choisi s'ouvre directement", () => {
    expect(mobileProfileLaunch(listing(), null, "stay", damien, NOW)).toBe("personal");
    expect(mobileProfileLaunch(listing({ currentProfileId: "lea" }), lea, "stay", lea, NOW)).toBe("resume");
    expect(mobileStayInitial(listing(), "stay", damien, NOW)).toBe(true);
  });

  it("case cochée, mais jamais une session sans jeton ni le compte sans son code", () => {
    // Le serveur ne dit plus Zoé en cours (session coupée) : « Qui regarde ? ».
    expect(mobileProfileLaunch(listing(), null, "stay", { profileId: "zoe", hasPin: false }, NOW)).toBe("picker");
    // L'app a perdu le jeton du profil en cours.
    expect(mobileProfileLaunch(listing({ currentProfileId: "lea" }), null, "stay", lea, NOW)).toBe("picker");
  });

  it("case cochée sur un profil devenu caduc ou bloqué : « Qui regarde ? »", () => {
    const withPin = listing({ profiles: [profile("damien", { kind: "owner", personal: true, hasPin: true }), profile("lea")] });
    expect(mobileProfileLaunch(withPin, null, "stay", damien, NOW)).toBe("picker");
    expect(mobileStayInitial(withPin, "stay", damien, NOW)).toBe(false);
    const locked = listing({ profiles: [profile("damien", { kind: "owner", personal: true, lockedUntil: "2026-10-21T04:00:00Z" }), profile("lea")] });
    expect(mobileProfileLaunch(locked, null, "stay", damien, NOW)).toBe("picker");
    // Bloqué, le choix reste : la case est encore cochée.
    expect(mobileStayInitial(locked, "stay", damien, NOW)).toBe(true);
  });

  it("ne lit jamais la politique des ordinateurs : coupée pour eux, le mobile propose encore", () => {
    const desktopOff = listing({ launchPolicy: { mode: "off", defaultOn: false }, atLaunch: false });
    expect(mobileProfileLaunch(desktopOff, null, "unset", null, NOW)).toBe("picker");
    expect(mobileStayInitial(desktopOff, "unset", null, NOW)).toBe(false);
  });

  it("l'administration ne le propose pas d'office sur le mobile : ni écran, ni case — une session gardée reprend", () => {
    expect(mobileLaunchAsked({ launchAsk: false }, true)).toBe(false);
    expect(mobileProfileLaunch(listing(), null, "unset", null, NOW, false)).toBe("personal");
    expect(mobileProfileLaunch(listing(), null, "stay", damien, NOW, false)).toBe("personal");
    expect(mobileProfileLaunch(listing({ currentProfileId: "lea" }), lea, "ask", null, NOW, false)).toBe("resume");
    // Jamais une session sans jeton : « Qui regarde ? » quand même.
    expect(mobileProfileLaunch(listing({ currentProfileId: "lea" }), null, "unset", null, NOW, false)).toBe("picker");
    expect(mobileStayInitial(listing(), "stay", damien, NOW, false)).toBe(true);
  });

  it("la politique n'est lue que sous la capacité ; un serveur d'avant (champ absent) : proposé", () => {
    expect(mobileLaunchAsked({ launchAsk: false }, false)).toBe(true);
    expect(mobileLaunchAsked({}, true)).toBe(true);
    expect(mobileLaunchAsked({ launchAsk: true }, true)).toBe(true);
  });

  it("l'interrupteur de Réglages : allumé sauf « ne plus proposer »", () => {
    expect(mobileProposesAtLaunch("unset")).toBe(true);
    expect(mobileProposesAtLaunch("ask")).toBe(true);
    expect(mobileProposesAtLaunch("stay")).toBe(false);
  });

  it("le choix se garde par serveur et par compte, sans toucher aux autres", () => {
    expect(MOBILE_PROFILE_LAUNCH_KEY).toBe("tentacle_mobile_profile_launch");
    let raw = writeMobileLaunchChoice(null, "https://Tv.Exemple.fr/", "DA-MIEN", "stay");
    raw = writeMobileLaunchChoice(raw, "https://autre.fr", "damien", "ask");
    expect(readMobileLaunchChoice(raw, SERVER, "damien")).toBe("stay");
    raw = writeMobileLaunchChoice(raw, SERVER, "damien", "unset");
    expect(readMobileLaunchChoice(raw, SERVER, "damien")).toBe("unset");
    expect(readMobileLaunchChoice(raw, "https://autre.fr", "damien")).toBe("ask");
    expect(readMobileLaunchChoice("pas du json", SERVER, "damien")).toBe("unset");
    expect(readMobileLaunchChoice(JSON.stringify({ [`${SERVER}|damien`]: "toujours" }), SERVER, "damien")).toBe("unset");
  });
});
