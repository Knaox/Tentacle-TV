import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import {
  launchOutcome,
  launchVerdict,
  requestedPickerNeeded,
  verifyOutcome,
  type LaunchInputs,
  type LaunchMirror,
} from "./launchDecision";

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return {
    userId,
    kind: "guest",
    name: userId,
    color: "violet",
    hasPin: false,
    imageTag: null,
    lockedUntil: null,
    createdBy: null,
    personal: false,
    ...extra,
  };
}

function listing(extra: Partial<PickerProfilesDto> = {}): PickerProfilesDto {
  return {
    v: 2,
    platform: "desktop",
    switches: { families: true, guests: true },
    account: { userId: "owner", name: "Damien" },
    profiles: [profile("owner", { kind: "owner", personal: true }), profile("lea"), profile("zoe", { kind: "member", hasPin: true })],
    currentProfileId: "owner",
    pickerRequired: true,
    atLaunch: true,
    ...extra,
  };
}

const MIRROR: LaunchMirror = { server: "http://srv", accountId: "owner", capable: true, listing: listing() };

const BASE: LaunchInputs = {
  desktop: true,
  authed: true,
  passed: false,
  requested: false,
  server: "http://srv",
  accountId: "owner",
  heldProfileId: null,
  mirror: MIRROR,
};

describe("« Qui regarde ? » à l'ouverture du bureau — la décision immédiate", () => {
  it("s'ouvre d'emblée quand le miroir du compte le demande", () => {
    expect(launchVerdict(BASE)).toBe("picker");
  });

  it("jamais hors du bureau, sans session, ou une fois le profil choisi dans cette exécution", () => {
    expect(launchVerdict({ ...BASE, desktop: false })).toBe("app");
    expect(launchVerdict({ ...BASE, authed: false })).toBe("app");
    expect(launchVerdict({ ...BASE, accountId: null })).toBe("app");
    expect(launchVerdict({ ...BASE, passed: true })).toBe("app");
  });

  it("réglage coupé, famille d'un profil, serveur sans la capacité : l'application", () => {
    expect(launchVerdict({ ...BASE, mirror: { ...MIRROR, listing: listing({ atLaunch: false }) } })).toBe("app");
    expect(launchVerdict({ ...BASE, mirror: { ...MIRROR, listing: listing({ pickerRequired: false }) } })).toBe("app");
    expect(launchVerdict({ ...BASE, mirror: { ...MIRROR, capable: false, listing: null } })).toBe("app");
  });

  it("réglage coupé, l'appareil sur un profil dont l'application garde le jeton : on le reprend", () => {
    const mirror = { ...MIRROR, listing: listing({ atLaunch: false, currentProfileId: "lea" }) };
    expect(launchVerdict({ ...BASE, heldProfileId: "lea", mirror })).toBe("app");
    // Sans le jeton : jamais le compte sans son code.
    expect(launchVerdict({ ...BASE, heldProfileId: null, mirror })).toBe("picker");
  });

  it("sans miroir, ou celui d'un autre compte ou d'un autre serveur : l'application, comme avant", () => {
    // Aucun écran d'attente pour qui n'a pas de profils : la réponse du serveur tranchera.
    expect(launchVerdict({ ...BASE, mirror: null })).toBe("app");
    expect(launchVerdict({ ...BASE, mirror: { ...MIRROR, accountId: "autre" } })).toBe("app");
    expect(launchVerdict({ ...BASE, mirror: { ...MIRROR, server: "http://ailleurs" } })).toBe("app");
  });

  it("une session de profil terminée redemande toujours au serveur, même profil déjà choisi", () => {
    expect(launchVerdict({ ...BASE, requested: true, passed: true })).toBe("check");
  });
});

describe("« Qui regarde ? » — la réponse fraîche du serveur", () => {
  it("à l'ouverture : la préférence et la règle du serveur", () => {
    expect(launchOutcome(listing(), null, false)).toBe("picker");
    expect(launchOutcome(listing({ atLaunch: false }), null, false)).toBe("app");
    expect(launchOutcome(listing({ atLaunch: false, currentProfileId: "lea" }), "lea", false)).toBe("app");
  });

  it("à l'ouverture : la session de profil gardée que le serveur ne connaît plus est terminée", () => {
    expect(launchOutcome(listing({ atLaunch: false, currentProfileId: "owner" }), "lea", false)).toBe("ended");
  });

  it("après la fin d'un profil : le sélecteur, sauf compte seul et sans code", () => {
    expect(launchOutcome(listing({ atLaunch: false }), null, true)).toBe("picker");
    const alone = listing({ profiles: [profile("owner", { kind: "owner", personal: true })], pickerRequired: false, atLaunch: false });
    expect(launchOutcome(alone, null, true)).toBe("app");
    const aloneWithPin = { ...alone, profiles: [profile("owner", { kind: "owner", personal: true, hasPin: true })] };
    expect(launchOutcome(aloneWithPin, null, true)).toBe("picker");
  });

  it("application déjà ouverte : seulement la sécurité, jamais la préférence", () => {
    expect(verifyOutcome(listing({ atLaunch: true }), null)).toBe("app");
    expect(verifyOutcome(listing({ currentProfileId: "lea" }), "lea")).toBe("app");
    expect(verifyOutcome(listing({ currentProfileId: "owner" }), "lea")).toBe("ended");
    expect(verifyOutcome(listing({ currentProfileId: "zoe" }), "lea")).toBe("ended");
    expect(verifyOutcome(listing({ currentProfileId: "lea" }), null)).toBe("picker");
  });

  it("le sélecteur exigé : dès deux profils, ou un code sur le compte", () => {
    expect(requestedPickerNeeded(1, false)).toBe(false);
    expect(requestedPickerNeeded(1, true)).toBe(true);
    expect(requestedPickerNeeded(2, false)).toBe(true);
  });
});
