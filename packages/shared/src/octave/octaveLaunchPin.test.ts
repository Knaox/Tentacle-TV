import { describe, expect, it } from "vitest";
import { mobileProfileLaunch } from "../family/familyMobileLaunch";
import type { PickerProfilesDto } from "../family/familyPickerContract";
import { octaveLaunchAsked, octaveLaunchSkipsPicker } from "./octaveLaunchPin";
import { octaveSkipLaunchPinOn } from "./octaveDeviceSettings";

const profile = (userId: string, personal: boolean, hasPin = true) => ({
  userId, name: userId, kind: personal ? "owner" : "member", personal, hasPin, color: null, imageTag: null, lockedUntil: null,
});

const listing = (currentProfileId: string, pickerRequired = true) =>
  ({
    profiles: [profile("compte", true), profile("lea", false)],
    currentProfileId,
    account: { userId: "compte" },
    atLaunch: true,
    pickerRequired,
  }) as unknown as PickerProfilesDto;

describe("Octave — ne pas demander le code PIN au démarrage", () => {
  it("allumé par défaut : seul « 0 » le coupe", () => {
    expect([null, undefined, "1", "x"].map(octaveSkipLaunchPinOn)).toEqual([true, true, true, true]);
    expect(octaveSkipLaunchPinOn("0")).toBe(false);
  });

  it("ne vaut qu'en Octave, réglage allumé, sans session close par le serveur", () => {
    expect(octaveLaunchSkipsPicker({ inOctave: true, skipPin: true, request: null })).toBe(true);
    expect(octaveLaunchSkipsPicker({ inOctave: false, skipPin: true, request: null })).toBe(false);
    expect(octaveLaunchSkipsPicker({ inOctave: true, skipPin: false, request: null })).toBe(false);
    expect(octaveLaunchSkipsPicker({ inOctave: true, skipPin: true, request: "ended" })).toBe(false);
  });

  it("en Octave, le profil ouvert se rouvre sans l'écran ; hors d'Octave, l'écran comme avant", () => {
    const held = { profileId: "lea" };
    const octave = octaveLaunchAsked(true, { inOctave: true, skipPin: true, request: null });
    expect(mobileProfileLaunch(listing("lea"), held, "unset", null, 0, octave)).not.toBe("picker");
    const tentacle = octaveLaunchAsked(true, { inOctave: false, skipPin: true, request: null });
    expect(mobileProfileLaunch(listing("lea"), held, "unset", null, 0, tentacle)).toBe("picker");
  });

  it("la sécurité reste : le serveur dit un profil dont l'app n'a pas le jeton → l'écran", () => {
    const octave = octaveLaunchAsked(true, { inOctave: true, skipPin: true, request: null });
    expect(mobileProfileLaunch(listing("lea"), null, "unset", null, 0, octave)).toBe("picker");
  });
});
