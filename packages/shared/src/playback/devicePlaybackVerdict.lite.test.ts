import { describe, expect, it } from "vitest";
import { MATRIX_AUDIO, MATRIX_SUBTITLES, MATRIX_VIDEO, type MatrixAudio, type MatrixVideo } from "./deviceMatrix.fixtures";
import { devicePlaybackVerdict, type AudioPath } from "./devicePlaybackVerdict";
import { LITE_DIRECT_PLAY_MAX_BITRATE, litePlaybackPolicy } from "./litePlayback";
import { BCM7271_PROFILE, SHIELD_PRO_2019_PROFILE } from "./simulatedDeviceProfiles";

const lite = litePlaybackPolicy("lite");

/**
 * Le son sur la box en mode Lite : ce qui part tel quel vers le téléviseur ne
 * change pas ; un son sans perte multicanal (TrueHD, DTS-HD MA), qui coûterait
 * ~16 à 40 % d'un cœur d'A53 à décoder, est converti par le serveur. L'AAC
 * reste décodé (~1 %).
 */
const BCM7271_LITE_AUDIO: Record<MatrixAudio, AudioPath> = {
  "AAC 2.0": "decoded",
  "AC3 5.1": "passthrough",
  "E-AC3 Atmos": "passthrough",
  "TrueHD Atmos": "converted",
  "DTS-HD MA": "converted",
};

describe("mode Lite — BCM7271 (box net+, simulée)", () => {
  it("le son : sans perte multicanal converti, le reste comme avant", () => {
    for (const [name, path] of Object.entries(BCM7271_LITE_AUDIO) as [MatrixAudio, AudioPath][]) {
      const verdict = devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HEVC 10 bits 4K"], audio: MATRIX_AUDIO[name], lite });
      expect({ name, path: verdict.audioPath }).toEqual({ name, path });
    }
  });

  it("un TrueHD sur une image lisible : flux direct (image copiée, HDR gardé), son converti", () => {
    const verdict = devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HDR10 4K"], audio: MATRIX_AUDIO["TrueHD Atmos"], lite });
    expect(verdict).toEqual({
      method: "DirectStream", reasons: ["AudioCodecNotSupported"], audioPath: "converted",
      subtitlePath: "none", notice: null, maxHeight: null, maxBitrate: null,
    });
  });

  it("…avec un PGS : le flux servi l'incruste, comme en mode normal", () => {
    const verdict = devicePlaybackVerdict({
      profile: BCM7271_PROFILE, video: MATRIX_VIDEO["H.264 1080p"], audio: MATRIX_AUDIO["TrueHD Atmos"], subtitle: MATRIX_SUBTITLES.PGS, lite,
    });
    expect(verdict).toMatchObject({ method: "Transcode", subtitlePath: "burnIn", reasons: ["AudioCodecNotSupported", "SubtitleCodecNotSupported"] });
  });

  it("le plafond de débit : un remux UHD au-delà de 50 Mb/s passe par le serveur, à ce débit, à la définition de l'écran", () => {
    const verdict = devicePlaybackVerdict({
      profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HDR10 4K"], audio: MATRIX_AUDIO["E-AC3 Atmos"], videoBitrate: 72_000_000, lite,
    });
    expect(verdict).toEqual({
      method: "Transcode", reasons: ["VideoBitrateNotSupported"], audioPath: "passthrough",
      subtitlePath: "none", notice: null, maxHeight: 1080, maxBitrate: LITE_DIRECT_PLAY_MAX_BITRATE,
    });
  });

  it("au plafond tout juste, ou sans débit connu : lecture directe", () => {
    const at = devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HDR10 4K"], videoBitrate: LITE_DIRECT_PLAY_MAX_BITRATE, lite });
    const unknown = devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HDR10 4K"], videoBitrate: null, lite });
    expect(at.method).toBe("DirectPlay");
    expect(unknown.method).toBe("DirectPlay");
  });

  it("l'AV1 au-delà du plafond : la raison du codec d'abord, le débit plafonné quand même", () => {
    const verdict = devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: MATRIX_VIDEO["AV1 4K"], videoBitrate: 80_000_000, lite });
    expect(verdict).toMatchObject({ method: "Transcode", reasons: ["VideoCodecNotSupported"], notice: "av1Converted", maxBitrate: LITE_DIRECT_PLAY_MAX_BITRATE });
  });

  it("les images lisibles sous le plafond : aucun changement face au mode normal", () => {
    for (const name of Object.keys(MATRIX_VIDEO) as MatrixVideo[]) {
      const input = { profile: BCM7271_PROFILE, video: MATRIX_VIDEO[name], audio: MATRIX_AUDIO["AC3 5.1"], videoBitrate: 20_000_000 };
      expect({ name, v: devicePlaybackVerdict({ ...input, lite }) }).toEqual({ name, v: devicePlaybackVerdict(input) });
    }
  });
});

describe("mode normal — rien ne change", () => {
  it("sans politique Lite, ni le débit ni le coût du son ne décident", () => {
    const input = { profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HDR10 4K"], audio: MATRIX_AUDIO["TrueHD Atmos"], videoBitrate: 90_000_000 };
    expect(devicePlaybackVerdict(input)).toMatchObject({ method: "DirectPlay", audioPath: "decoded", maxBitrate: null });
    expect(devicePlaybackVerdict({ ...input, lite: null })).toEqual(devicePlaybackVerdict(input));
    expect(litePlaybackPolicy("normal")).toBeNull();
  });

  it("Lite forcé sur la Shield : tout son part tel quel vers l'ampli, rien à convertir", () => {
    for (const name of ["TrueHD Atmos", "DTS-HD MA"] as const) {
      expect(devicePlaybackVerdict({ profile: SHIELD_PRO_2019_PROFILE, audio: MATRIX_AUDIO[name], lite }).audioPath).toBe("passthrough");
    }
  });
});
