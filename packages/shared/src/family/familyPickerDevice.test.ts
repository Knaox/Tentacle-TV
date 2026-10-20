import { describe, expect, it } from "vitest";
import { launchAskedOn, type PickerProfileDto, type PickerProfilesDto } from "./familyPickerContract";
import { deviceProposes, launchAllowed, launchAskedByServer, pickerStayInitial, withDeviceChoice } from "./familyPickerDevice";

const NOW = Date.parse("2026-10-15T12:00:00Z");

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "member", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
}

function listing(patch: Partial<PickerProfilesDto> = {}): PickerProfilesDto {
  return {
    v: 2,
    platform: "desktop",
    switches: { families: true, guests: true },
    account: { userId: "owner", name: "Damien" },
    profiles: [profile("owner", { kind: "owner", personal: true }), profile("zoe", { hasPin: true })],
    currentProfileId: "owner",
    pickerRequired: true,
    atLaunch: false,
    ...patch,
  };
}

const ON = { mode: "choice", defaultOn: true } as const;
const OFF_BY_DEFAULT = { mode: "choice", defaultOn: false } as const;
const CUT = { mode: "off", defaultOn: true } as const;

describe("« Qui regarde ? » à l'ouverture, par ordinateur", () => {
  it("jamais choisi : le défaut de l'administration ; un serveur d'avant : activé", () => {
    expect(deviceProposes(listing({ launchPolicy: ON }), "unset")).toBe(true);
    expect(deviceProposes(listing({ launchPolicy: OFF_BY_DEFAULT }), "unset")).toBe(false);
    expect(deviceProposes(listing(), "unset")).toBe(true);
    // L'ancienne préférence du compte (`atLaunch` d'un serveur d'avant) n'y entre plus.
    expect(withDeviceChoice(listing({ atLaunch: false }), "unset").atLaunch).toBe(true);
  });

  it("le choix de l'ordinateur passe devant le défaut ; coupé, rien ne vaut", () => {
    expect(deviceProposes(listing({ launchPolicy: OFF_BY_DEFAULT }), "ask")).toBe(true);
    expect(deviceProposes(listing({ launchPolicy: ON }), "stay")).toBe(false);
    expect(launchAllowed(listing({ launchPolicy: CUT }))).toBe(false);
    for (const choice of ["unset", "ask", "stay"] as const) {
      expect(withDeviceChoice(listing({ launchPolicy: CUT, atLaunch: true }), choice).atLaunch).toBe(false);
    }
  });

  it("un profil retenu garde `atLaunch` vrai : l'exception du profil retenu en décide", () => {
    expect(withDeviceChoice(listing({ launchPolicy: OFF_BY_DEFAULT }), "stay").atLaunch).toBe(true);
    const once = withDeviceChoice(listing({ launchPolicy: OFF_BY_DEFAULT }), "ask");
    expect(withDeviceChoice(once, "ask")).toBe(once);
  });

  it("la case arrive cochée si l'ordinateur ne propose déjà plus, sinon décochée", () => {
    const base = listing({ launchPolicy: ON });
    expect(pickerStayInitial(base, "stay", { profileId: "zoe", hasPin: true }, NOW)).toBe(true);
    expect(pickerStayInitial(base, "ask", null, NOW)).toBe(false);
    expect(pickerStayInitial(base, "unset", null, NOW)).toBe(false);
    expect(pickerStayInitial(listing({ launchPolicy: OFF_BY_DEFAULT }), "unset", null, NOW)).toBe(true);
    // Un profil retenu disparu (ou dont le code a changé) ne compte plus.
    expect(pickerStayInitial(base, "stay", { profileId: "zoe", hasPin: false }, NOW)).toBe(false);
  });
});

describe("launchAskedByServer — la case de la plateforme (1.31.1)", () => {
  it("le serveur qui le dit fait foi, quel que soit le défaut de la plateforme", () => {
    expect(launchAskedByServer({ launchAsk: false }, true)).toBe(false);
    expect(launchAskedByServer({ launchAsk: true, launchPolicy: { mode: "off", defaultOn: false } })).toBe(true);
  });

  it("un serveur d'avant : le comportement d'avant (le mobile demande, le bureau suit `launchPolicy`)", () => {
    expect(launchAskedByServer({}, true)).toBe(true);
    expect(launchAskedByServer({ launchPolicy: { mode: "off", defaultOn: true } })).toBe(false);
    expect(launchAskedByServer({})).toBe(true);
  });

  it("la forme simple : l'interrupteur général et la case", () => {
    const settings = { enabled: true, platforms: { desktop: true, web: false, mobile: true, tv: true } };
    expect(launchAskedOn(settings, "web")).toBe(false);
    expect(launchAskedOn(settings, "mobile")).toBe(true);
    expect(launchAskedOn({ ...settings, enabled: false }, "mobile")).toBe(false);
  });
});
