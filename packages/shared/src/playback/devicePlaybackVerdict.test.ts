import { describe, expect, it } from "vitest";
import type { DeviceMediaProfile } from "./deviceMediaProfile";
import {
  MATRIX_AUDIO, MATRIX_SUBTITLES, MATRIX_VIDEO, type MatrixAudio, type MatrixSubtitle, type MatrixVideo,
} from "./deviceMatrix.fixtures";
import { devicePlaybackVerdict, type AudioPath, type DevicePlayMethod, type SubtitlePath } from "./devicePlaybackVerdict";
import { BCM7271_PROFILE, SHIELD_PRO_2019_PROFILE } from "./simulatedDeviceProfiles";

/** Ce que l'image d'une ligne de la matrice devient, sur un appareil. */
interface VideoExpectation {
  method: Extract<DevicePlayMethod, "DirectPlay" | "Transcode">;
  reason?: string;
  maxHeight?: number;
  notice?: "av1Converted";
}

const DIRECT: VideoExpectation = { method: "DirectPlay" };

/**
 * Le BCM7271 de la box net+ (profil simulé) : tout se lit tel quel sauf
 * l'AV1 (aucun décodeur : le serveur convertit, en 1080p pour l'écran 1080p)
 * et le Dolby Vision 5 (sans décodeur Dolby Vision, aucune base lisible : le
 * serveur le ramène au SDR). Les profils 7 et 8 se lisent par leur base HDR10.
 */
const BCM7271_VIDEO: Record<MatrixVideo, VideoExpectation> = {
  "H.264 1080p": DIRECT,
  "HEVC 8 bits 1080p": DIRECT,
  "HEVC 8 bits 4K": DIRECT,
  "HEVC 10 bits 1080p": DIRECT,
  "HEVC 10 bits 4K": DIRECT,
  "HDR10 4K": DIRECT,
  "DV P5 4K": { method: "Transcode", reason: "VideoRangeTypeNotSupported", maxHeight: 1080 },
  "DV P7 4K": DIRECT,
  "DV P8 4K": DIRECT,
  "VP9 4K": DIRECT,
  "AV1 4K": { method: "Transcode", reason: "VideoCodecNotSupported", maxHeight: 1080, notice: "av1Converted" },
};

/**
 * Le son sur la box : AC3 et E-AC3 (Atmos compris) partent tels quels vers le
 * téléviseur ; le reste est décodé sur la box (l'extension FFmpeg du lecteur) —
 * rien n'est converti par le serveur.
 */
const BCM7271_AUDIO: Record<MatrixAudio, AudioPath> = {
  "AAC 2.0": "decoded",
  "AC3 5.1": "passthrough",
  "E-AC3 Atmos": "passthrough",
  "TrueHD Atmos": "decoded",
  "DTS-HD MA": "decoded",
};

/** Les sous-titres : rendus par le lecteur en lecture directe ; dans un flux servi, texte ou incrustés. */
function expectedSubtitle(subtitle: MatrixSubtitle, served: boolean): SubtitlePath {
  if (subtitle === "PGS") return served ? "burnIn" : "native";
  return served ? "text" : "native";
}

function runMatrix(profile: DeviceMediaProfile, video: Record<MatrixVideo, VideoExpectation>, audio: Record<MatrixAudio, AudioPath>) {
  for (const [videoName, expected] of Object.entries(video) as [MatrixVideo, VideoExpectation][]) {
    for (const [audioName, audioPath] of Object.entries(audio) as [MatrixAudio, AudioPath][]) {
      for (const subtitleName of Object.keys(MATRIX_SUBTITLES) as MatrixSubtitle[]) {
        const verdict = devicePlaybackVerdict({
          profile, video: MATRIX_VIDEO[videoName], audio: MATRIX_AUDIO[audioName], subtitle: MATRIX_SUBTITLES[subtitleName],
        });
        const served = expected.method !== "DirectPlay" || audioPath === "converted";
        const cell = `${videoName} × ${audioName} × ${subtitleName}`;
        const method = expected.method === "Transcode" ? "Transcode"
          : audioPath === "converted" ? (subtitleName === "PGS" ? "Transcode" : "DirectStream") : "DirectPlay";
        expect({ cell, method: verdict.method }).toEqual({ cell, method });
        expect({ cell, audio: verdict.audioPath }).toEqual({ cell, audio: audioPath });
        expect({ cell, subtitle: verdict.subtitlePath }).toEqual({ cell, subtitle: expectedSubtitle(subtitleName, served) });
        expect({ cell, notice: verdict.notice }).toEqual({ cell, notice: expected.notice ?? null });
        expect({ cell, maxHeight: verdict.maxHeight }).toEqual({ cell, maxHeight: expected.maxHeight ?? null });
        if (expected.reason) expect(verdict.reasons[0]).toBe(expected.reason);
      }
    }
  }
}

describe("matrice de la fiche — BCM7271 (box net+, simulée)", () => {
  it("11 images × 5 sons × 3 sous-titres : chaque case a son verdict", () => {
    runMatrix(BCM7271_PROFILE, BCM7271_VIDEO, BCM7271_AUDIO);
  });

  it("l'AV1 : converti par le serveur, avec la raison de Jellyfin et le message", () => {
    const verdict = devicePlaybackVerdict({
      profile: BCM7271_PROFILE, video: MATRIX_VIDEO["AV1 4K"], audio: MATRIX_AUDIO["AC3 5.1"], subtitle: MATRIX_SUBTITLES.PGS,
    });
    expect(verdict).toEqual({
      method: "Transcode",
      reasons: ["VideoCodecNotSupported", "SubtitleCodecNotSupported"],
      audioPath: "passthrough",
      subtitlePath: "burnIn",
      notice: "av1Converted",
      maxHeight: 1080,
      maxBitrate: null,
    });
  });
});

/**
 * La Shield TV Pro 2019, RELEVÉE le 07/10 (téléviseur 4K HDR10 + Dolby Vision,
 * ampli qui prend tout) : tout se lit tel quel — le Dolby Vision 5 par son
 * décodeur, le 7 réécrit en 8.1 — sauf l'AV1 (aucun décodeur matériel :
 * converti par le serveur, en 4K puisque l'écran et le H.264 la tiennent).
 */
const SHIELD_VIDEO: Record<MatrixVideo, VideoExpectation> = {
  "H.264 1080p": DIRECT,
  "HEVC 8 bits 1080p": DIRECT,
  "HEVC 8 bits 4K": DIRECT,
  "HEVC 10 bits 1080p": DIRECT,
  "HEVC 10 bits 4K": DIRECT,
  "HDR10 4K": DIRECT,
  "DV P5 4K": DIRECT,
  "DV P7 4K": DIRECT,
  "DV P8 4K": DIRECT,
  "VP9 4K": DIRECT,
  "AV1 4K": { method: "Transcode", reason: "VideoCodecNotSupported", notice: "av1Converted" },
};

/** Le son sur la Shield : tout part tel quel vers l'ampli, sauf l'AAC, décodé. */
const SHIELD_AUDIO: Record<MatrixAudio, AudioPath> = {
  "AAC 2.0": "decoded",
  "AC3 5.1": "passthrough",
  "E-AC3 Atmos": "passthrough",
  "TrueHD Atmos": "passthrough",
  "DTS-HD MA": "passthrough",
};

describe("matrice de la fiche — Shield TV Pro 2019 (relevée)", () => {
  it("11 images × 5 sons × 3 sous-titres : chaque case a son verdict", () => {
    runMatrix(SHIELD_PRO_2019_PROFILE, SHIELD_VIDEO, SHIELD_AUDIO);
  });

  it("le VP9 10 bits (Profile 2) : la Shield n'annonce que le Profile 0 — converti, jamais décodé en logiciel", () => {
    const vp9hdr = { ...MATRIX_VIDEO["VP9 4K"], Profile: "Profile 2", BitDepth: 10, VideoRangeType: "HDR10" };
    expect(devicePlaybackVerdict({ profile: SHIELD_PRO_2019_PROFILE, video: vp9hdr }).reasons).toEqual(["VideoProfileNotSupported"]);
  });
});

describe("verdict — les autres chemins", () => {
  const noFfmpeg: DeviceMediaProfile = { ...BCM7271_PROFILE, audio: { passthrough: ["ac3"], decoded: ["aac", "ac3", "mp3"], maxPcmChannels: 2 } };

  it("un son ni décodé ni reçu par la sortie : flux direct (image copiée, son converti)", () => {
    const verdict = devicePlaybackVerdict({ profile: noFfmpeg, video: MATRIX_VIDEO["HDR10 4K"], audio: MATRIX_AUDIO["DTS-HD MA"] });
    expect(verdict).toMatchObject({ method: "DirectStream", reasons: ["AudioCodecNotSupported"], audioPath: "converted", maxHeight: null });
  });

  it("…et avec un PGS, le flux servi l'incruste : transcodage", () => {
    const verdict = devicePlaybackVerdict({
      profile: noFfmpeg, video: MATRIX_VIDEO["H.264 1080p"], audio: MATRIX_AUDIO["DTS-HD MA"], subtitle: MATRIX_SUBTITLES.PGS,
    });
    expect(verdict).toMatchObject({ method: "Transcode", subtitlePath: "burnIn", reasons: ["AudioCodecNotSupported", "SubtitleCodecNotSupported"] });
  });

  it("le cœur suffit : un DTS-HD vers une sortie DTS, un Atmos vers une sortie E-AC3", () => {
    const core: DeviceMediaProfile = { ...noFfmpeg, audio: { passthrough: ["dts", "eac3"], decoded: ["aac"], maxPcmChannels: 2 } };
    expect(devicePlaybackVerdict({ profile: core, audio: MATRIX_AUDIO["DTS-HD MA"] }).audioPath).toBe("passthrough");
    expect(devicePlaybackVerdict({ profile: core, audio: MATRIX_AUDIO["E-AC3 Atmos"] }).audioPath).toBe("passthrough");
    expect(devicePlaybackVerdict({ profile: core, audio: MATRIX_AUDIO["TrueHD Atmos"] }).audioPath).toBe("converted");
  });

  it("un PGS d'un fichier à part s'incruste même en lecture directe", () => {
    const verdict = devicePlaybackVerdict({
      profile: BCM7271_PROFILE, video: MATRIX_VIDEO["H.264 1080p"], subtitle: { Codec: "pgssub", IsExternal: true },
    });
    expect(verdict).toMatchObject({ method: "Transcode", subtitlePath: "burnIn", reasons: ["SubtitleCodecNotSupported"] });
  });

  it("H.264 High 10 (anime) : profil hors du décodeur, converti", () => {
    const hi10 = { ...MATRIX_VIDEO["H.264 1080p"], Profile: "High 10", BitDepth: 10 };
    expect(devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: hi10 }).reasons).toEqual(["VideoProfileNotSupported"]);
  });

  it("H.264 4K à 60 i/s sur un décodeur 4K30 : la cadence décide, la sortie borne le transcodage", () => {
    const h264uhd60 = { ...MATRIX_VIDEO["H.264 1080p"], Width: 3840, Height: 2160, RealFrameRate: 59.94 };
    const verdict = devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: h264uhd60 });
    expect(verdict).toMatchObject({ method: "Transcode", reasons: ["VideoFramerateNotSupported"], maxHeight: 1080 });
  });

  it("un 4K sur une sortie 1080p se lit tel quel quand le décodeur le tient (la box réduit l'image)", () => {
    expect(BCM7271_PROFILE.display.height).toBe(1080);
    expect(devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: MATRIX_VIDEO["HEVC 10 bits 4K"] }).method).toBe("DirectPlay");
  });

  it("un décodeur HEVC limité au 1080p : le 4K est converti, en 1080p", () => {
    const small: DeviceMediaProfile = {
      ...BCM7271_PROFILE,
      display: { ...BCM7271_PROFILE.display, height: 2160, maxHeight: 2160 },
      video: BCM7271_PROFILE.video.map((d) => (d.codec === "hevc" || d.codec === "h264"
        ? { ...d, maxWidth: 1920, maxHeight: 1088, sizes: d.sizes.map((s) => (s.height > 1088 ? { ...s, maxFrameRate: 0 } : s)) }
        : d)),
    };
    expect(devicePlaybackVerdict({ profile: small, video: MATRIX_VIDEO["HEVC 8 bits 4K"] })).toMatchObject({
      method: "Transcode", reasons: ["VideoResolutionNotSupported"], maxHeight: 1080,
    });
  });

  it("le Dolby Vision 5 se lit tel quel avec un décodeur du profil 5", () => {
    const dv: DeviceMediaProfile = { ...BCM7271_PROFILE, hdr: { ...BCM7271_PROFILE.hdr, dolbyVisionProfiles: [5, 8] } };
    expect(devicePlaybackVerdict({ profile: dv, video: MATRIX_VIDEO["DV P5 4K"] }).method).toBe("DirectPlay");
  });

  it("un Dolby Vision 5 reconnu par sa plage seule (« DOVI », sans profil) suit la même règle", () => {
    const rangeOnly = { ...MATRIX_VIDEO["DV P5 4K"], DvProfile: undefined, DvBlSignalCompatibilityId: undefined };
    expect(devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: rangeOnly }).reasons).toEqual(["VideoRangeTypeNotSupported"]);
  });

  it("un profil de source inconnu ne se refuse jamais (pas de nom deviné)", () => {
    const odd = { ...MATRIX_VIDEO["HEVC 8 bits 1080p"], Profile: "Format Range Extensions Maybe" };
    expect(devicePlaybackVerdict({ profile: BCM7271_PROFILE, video: odd }).method).toBe("DirectPlay");
  });

  it("sans aucun décodeur H.264 ni HEVC : refus, plutôt qu'un flux que rien ne décode", () => {
    const none: DeviceMediaProfile = { ...BCM7271_PROFILE, video: [] };
    expect(devicePlaybackVerdict({ profile: none, video: MATRIX_VIDEO["H.264 1080p"] }).method).toBe("Refuse");
  });

  it("sans image (musique) ni son : lecture directe, rien à dire", () => {
    expect(devicePlaybackVerdict({ profile: BCM7271_PROFILE })).toEqual({
      method: "DirectPlay", reasons: [], audioPath: "none", subtitlePath: "none", notice: null, maxHeight: null, maxBitrate: null,
    });
  });
});
