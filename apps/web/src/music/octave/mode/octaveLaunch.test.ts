import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { launchAvailability, launchesInOctave, octaveGateOutcome, octaveGateStep, type OctaveLaunchMirror } from "./octaveLaunch";

/**
 * Octave — le lancement en Octave : décidé avant la première image (miroir de
 * la disponibilité), jamais « Qui regarde ? » sauf la sécurité, le code PIN de
 * l'identité gardée dans la petite feuille.
 */

const OWNER = "http://srv|owner";
const NOW = Date.parse("2026-10-26T08:00:00Z");

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "guest", name: userId, color: "violet", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra };
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

describe("lancer en Octave", () => {
  const available: OctaveLaunchMirror = { owner: OWNER, available: true };
  const unavailable: OctaveLaunchMirror = { owner: OWNER, available: false };

  it.each`
    wants    | owner    | mirror                                         | expected
    ${true}  | ${OWNER} | ${available}                                   | ${true}
    ${true}  | ${OWNER} | ${null}                                        | ${true}
    ${true}  | ${OWNER} | ${unavailable}                                 | ${false}
    ${true}  | ${OWNER} | ${{ owner: "http://srv|lea", available: false }} | ${true}
    ${true}  | ${null}  | ${available}                                   | ${false}
    ${false} | ${OWNER} | ${available}                                   | ${false}
  `("voulu $wants, compte $owner, miroir $mirror → $expected", ({ wants, owner, mirror, expected }) => {
    expect(launchesInOctave(wants, owner, mirror)).toBe(expected);
  });
});

describe("disponibilité au lancement", () => {
  const unknown = { available: false, settled: false };

  it("le miroir d'un Octave disponible pour CE compte suffit à peindre Octave", () => {
    expect(launchAvailability(unknown, OWNER, { owner: OWNER, available: true })).toEqual({ available: true, settled: true });
  });

  it("le miroir d'un autre compte, ou d'un Octave indisponible, ne décide rien", () => {
    expect(launchAvailability(unknown, OWNER, { owner: "http://autre|owner", available: true })).toEqual(unknown);
    expect(launchAvailability(unknown, OWNER, { owner: OWNER, available: false })).toEqual(unknown);
    expect(launchAvailability(unknown, null, { owner: OWNER, available: true })).toEqual(unknown);
  });

  it("la réponse du serveur l'emporte toujours, dans les deux sens", () => {
    const no = { available: false, settled: true };
    expect(launchAvailability(no, OWNER, { owner: OWNER, available: true })).toEqual(no);
    const yes = { available: true, settled: true };
    expect(launchAvailability(yes, OWNER, null)).toEqual(yes);
  });
});

describe("« Qui regarde ? » sur un lancement en Octave", () => {
  it("la préférence de l'appareil : l'identité gardée s'ouvre, sans le sélecteur", () => {
    expect(octaveGateOutcome(listing(), null, null, NOW)).toEqual({ kind: "open" });
    expect(octaveGateOutcome(listing({ currentProfileId: "lea" }), "lea", null, NOW)).toEqual({ kind: "open" });
  });

  it("l'identité gardée a un code PIN : la petite feuille, jamais le sélecteur", () => {
    expect(octaveGateOutcome(listing({ currentProfileId: "zoe" }), "zoe", null, NOW)).toEqual({ kind: "pin", profileId: "zoe" });
    const ownPin = listing({ profiles: [profile("owner", { kind: "owner", personal: true, hasPin: true }), profile("lea")] });
    expect(octaveGateOutcome(ownPin, null, null, NOW)).toEqual({ kind: "pin", profileId: "owner" });
  });

  it("la sécurité ramène le sélecteur : le serveur dit un profil dont l'appareil n'a pas le jeton", () => {
    expect(octaveGateOutcome(listing({ currentProfileId: "lea" }), null, null, NOW)).toEqual({ kind: "picker" });
    expect(octaveGateOutcome(listing({ currentProfileId: "zoe" }), "lea", null, NOW)).toEqual({ kind: "picker" });
  });

  it("une identité gardée que la famille ne connaît plus : le sélecteur", () => {
    expect(octaveGateOutcome(listing({ currentProfileId: "max" }), "max", null, NOW)).toEqual({ kind: "picker" });
  });

  it("les identifiants se comparent comme Jellyfin (casse et tirets)", () => {
    const dashed = listing({ account: { userId: "0A1B-2C", name: "D" }, currentProfileId: "0A1B-2C", profiles: [profile("0a1b2c", { personal: true })] });
    expect(octaveGateOutcome(dashed, null, null, NOW)).toEqual({ kind: "open" });
  });
});

describe("la porte, phase par phase", () => {
  const zoe = listing({ currentProfileId: "zoe" });

  it("hors d'un lancement en Octave, ou hors du sélecteur : rien ne change", () => {
    expect(octaveGateStep("picker", listing(), null, null, NOW, false)).toEqual({ phase: "picker", pinProfile: null, opened: false });
    expect(octaveGateStep("check", listing(), null, null, NOW, true)).toEqual({ phase: "check", pinProfile: null, opened: false });
    expect(octaveGateStep("picker", null, null, null, NOW, true)).toEqual({ phase: "picker", pinProfile: null, opened: false });
  });

  it("le sélecteur devient l'application, ou la feuille du profil gardé", () => {
    expect(octaveGateStep("picker", listing(), null, null, NOW, true)).toEqual({ phase: "app", pinProfile: null, opened: true });
    const step = octaveGateStep("picker", zoe, "zoe", null, NOW, true);
    expect(step.pinProfile?.userId).toBe("zoe");
    expect(step.opened).toBe(false);
  });

  it("la sécurité garde le sélecteur", () => {
    expect(octaveGateStep("picker", zoe, null, null, NOW, true)).toEqual({ phase: "picker", pinProfile: null, opened: false });
  });
});
