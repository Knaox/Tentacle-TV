import { describe, expect, it } from "vitest";
import { hardwareDecoder, parseDeviceMediaProfile } from "./deviceMediaProfile";
import { BCM7271_PROFILE, simulatedDeviceProfile } from "./simulatedDeviceProfiles";

describe("parseDeviceMediaProfile — ce que rend le module natif", () => {
  it("un profil bien formé passe tel quel (aller-retour JSON)", () => {
    const raw = JSON.parse(JSON.stringify({ ...BCM7271_PROFILE, source: "native" }));
    const parsed = parseDeviceMediaProfile(raw);
    expect(parsed).toEqual({ ...BCM7271_PROFILE, source: "native" });
  });

  it("une autre version, ou une forme cassée : null — rien n'est supposé", () => {
    expect(parseDeviceMediaProfile(null)).toBeNull();
    expect(parseDeviceMediaProfile({ ...BCM7271_PROFILE, version: 2 })).toBeNull();
    expect(parseDeviceMediaProfile({ ...BCM7271_PROFILE, video: "hevc" })).toBeNull();
    expect(parseDeviceMediaProfile({ ...BCM7271_PROFILE, audio: undefined })).toBeNull();
  });

  it("les entrées inconnues sont écartées, les codecs mis en minuscules", () => {
    const parsed = parseDeviceMediaProfile({
      ...BCM7271_PROFILE,
      video: [{ codec: "HEVC", maxWidth: 3840, maxHeight: 2160 }, { nope: true }],
      audio: { passthrough: ["ac3", "mpegh"], decoded: ["AAC"], maxPcmChannels: 8 },
    });
    expect(parsed?.video).toHaveLength(1);
    expect(parsed?.video[0]).toMatchObject({ codec: "hevc", profiles: [], sizes: [], tenBit: false, maxLevel: null });
    expect(parsed?.audio).toEqual({ passthrough: ["ac3"], decoded: ["aac"], maxPcmChannels: 8 });
  });
});

describe("profils simulés", () => {
  it("BCM7271 : HEVC 10 bits et VP9 en 4K, H.264 en 1080p, aucun AV1 ni Dolby Vision", () => {
    expect(hardwareDecoder(BCM7271_PROFILE, "hevc")?.tenBit).toBe(true);
    expect(hardwareDecoder(BCM7271_PROFILE, "vp9")?.maxHeight).toBe(2160);
    expect(hardwareDecoder(BCM7271_PROFILE, "h264")?.maxHeight).toBe(1088);
    expect(hardwareDecoder(BCM7271_PROFILE, "av1")).toBeNull();
    expect(BCM7271_PROFILE.hdr.dolbyVisionProfiles).toEqual([]);
  });

  it("se trouve par le nom de la propriété du banc, casse indifférente ; un nom vide n'en donne aucun", () => {
    expect(simulatedDeviceProfile("BCM7271")).toBe(BCM7271_PROFILE);
    expect(simulatedDeviceProfile(" bcm7271 ")).toBe(BCM7271_PROFILE);
    expect(simulatedDeviceProfile("")).toBeNull();
    expect(simulatedDeviceProfile(null)).toBeNull();
    expect(simulatedDeviceProfile("inconnu")).toBeNull();
  });
});
