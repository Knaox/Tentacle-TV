import { describe, expect, it } from "vitest";
import {
  AVPLAYER_ENGINE, EXOPLAYER_ENGINE, MPV_ENGINE, SAFE_FALLBACK_ENGINE, readableRangeTypes, withHdr,
} from "./engineCapabilities";
import { AUDIO_COPY_MAX_SHARE, audioCopyBitrate, keptAudioCopyBitrate, planStream, segmentAudioCodecs } from "./streamPlan";

const DTS_51 = { Codec: "dts", BitRate: 768_000, Channels: 6 };
const TRUEHD_71 = { Codec: "truehd", BitRate: 4_000_000, Channels: 8 };
const AC3_51 = { Codec: "ac3", BitRate: 640_000, Channels: 6 };

describe("planStream — le son d'une source que le moteur lit", () => {
  it("mpv, palier 1080p, DTS 5.1 à 768 kb/s : copié, et son débit sort du budget de l'image", () => {
    const plan = planStream({ engine: MPV_ENGINE, audio: DTS_51, tier: { totalBitrate: 8_384_000, height: 1080 } });
    expect(plan.copiesAudio).toBe(true);
    expect(plan.params.AudioCodec.split(",")).toContain("dts");
    expect(plan.params.AllowAudioStreamCopy).toBe("true");
    // Jellyfin ne copie que si AudioBitrate couvre la piste (mesuré, 10.11).
    expect(plan.params.AudioBitrate).toBe("768000");
    expect(plan.params.VideoBitrate).toBe(String(8_384_000 - 768_000));
  });

  it("AVPlayer : le DTS n'est pas lu — converti, et la raison de Jellyfin sera juste", () => {
    const plan = planStream({ engine: AVPLAYER_ENGINE, audio: DTS_51, tier: { totalBitrate: 8_384_000, height: 1080 } });
    expect(plan.copiesAudio).toBe(false);
    expect(plan.params.AudioCodec.split(",")).not.toContain("dts");
    expect(plan.params.AudioBitrate).toBe("384000");
  });

  it("jamais d'AC3 copié vers du fMP4 (init au moov vide), même lu par le moteur", () => {
    expect(segmentAudioCodecs(AVPLAYER_ENGINE)).not.toContain("ac3");
    expect(segmentAudioCodecs(AVPLAYER_ENGINE)).not.toContain("eac3");
    expect(audioCopyBitrate(AVPLAYER_ENGINE, AC3_51, null)).toBeNull();
    // En TS, l'AC3 se copie (ExoPlayer, mpv).
    expect(audioCopyBitrate(EXOPLAYER_ENGINE, AC3_51, null)).toBe(640_000);
  });

  it("l'AAC est toujours le premier codec : celui de sortie quand le son est converti", () => {
    for (const engine of [MPV_ENGINE, AVPLAYER_ENGINE, EXOPLAYER_ENGINE]) {
      expect(segmentAudioCodecs(engine)[0]).toBe("aac");
    }
  });

  it(`un son trop lourd pour le palier (> ${AUDIO_COPY_MAX_SHARE * 100} %) est converti`, () => {
    const plan = planStream({ engine: MPV_ENGINE, audio: TRUEHD_71, tier: { totalBitrate: 8_384_000, height: 1080 } });
    expect(plan.copiesAudio).toBe(false);
    expect(plan.params.AudioBitrate).toBe("384000");
    expect(plan.params.TranscodingMaxAudioChannels).toBe("6");
  });

  it("trop de canaux pour le moteur : converti", () => {
    expect(audioCopyBitrate(AVPLAYER_ENGINE, { Codec: "aac", BitRate: 256_000, Channels: 8 }, null)).toBeNull();
  });

  it("débit inconnu : un débit supposé par codec, jamais zéro", () => {
    expect(audioCopyBitrate(MPV_ENGINE, { Codec: "dts", Channels: 6 }, null)).toBe(1_536_000);
  });

  it("le repli après erreur reste H.264 + AAC, sans copie du son", () => {
    const plan = planStream({ engine: SAFE_FALLBACK_ENGINE, audio: DTS_51, tier: { totalBitrate: 8_000_000 } });
    expect(plan.params.VideoCodec).toBe("h264");
    expect(plan.params.AudioCodec).toBe("aac");
    expect(plan.copiesAudio).toBe(false);
  });
});

describe("planStream — l'image", () => {
  it("le HEVC en tête quand le moteur le décode (Jellyfin le prend si l'admin l'a permis)", () => {
    const plan = planStream({ engine: MPV_ENGINE, audio: null, tier: { totalBitrate: 8_384_000, height: 1080 } });
    expect(plan.params.VideoCodec).toBe("hevc,h264");
  });

  it("un palier réencode : copie interdite, définition et débit du palier", () => {
    const plan = planStream({ engine: MPV_ENGINE, audio: null, tier: { totalBitrate: 8_384_000, height: 1080 } });
    expect(plan.params.AllowVideoStreamCopy).toBe("false");
    expect(plan.params.MaxWidth).toBe("1920");
    expect(plan.params.MaxHeight).toBe("1080");
  });

  it("sans palier : copie de l'image SANS plafond de définition (un MaxWidth réencodait la 4K)", () => {
    const plan = planStream({ engine: MPV_ENGINE, audio: DTS_51, tier: null });
    expect(plan.params.AllowVideoStreamCopy).toBe("true");
    expect(plan.params.MaxWidth).toBeUndefined();
    expect(plan.params.MaxHeight).toBeUndefined();
    expect(plan.copiesAudio).toBe(true);
  });

  it("les plages HDR et Dolby Vision lues sont déclarées par codec — le H.264 reste SDR", () => {
    const plan = planStream({ engine: MPV_ENGINE, audio: null, tier: null });
    expect(plan.params["h264-rangetype"]).toBe("SDR");
    const hevc = plan.params["hevc-rangetype"].split(",");
    expect(hevc).toEqual(expect.arrayContaining(["SDR", "HDR10", "HLG", "DOVI", "DOVIWithHDR10", "DOVIWithEL"]));
  });

  it("une Apple TV sans Dolby Vision lit la base HDR10 d'un DV, jamais le profil 7", () => {
    const ranges = readableRangeTypes(AVPLAYER_ENGINE.hdr);
    expect(ranges).toContain("DOVIWithHDR10");
    expect(ranges).not.toContain("DOVI");
    expect(ranges).not.toContain("DOVIWithEL");
    expect(readableRangeTypes(withHdr(AVPLAYER_ENGINE, { dolbyVision: true }).hdr)).toContain("DOVI");
  });

  it("AVPlayer : segments fMP4 (le HEVC n'y passe pas en TS)", () => {
    expect(planStream({ engine: AVPLAYER_ENGINE, audio: null, tier: null }).params.SegmentContainer).toBe("mp4");
  });

  it("en TS, l'AV1 et le VP9 ne sont pas déclarés (ils ne voyagent qu'en fMP4)", () => {
    expect(planStream({ engine: MPV_ENGINE, audio: null, tier: null }).params.VideoCodec).toBe("hevc,h264");
  });
});

describe("keptAudioCopyBitrate — la copie prévue par Jellyfin, gardée par le palier", () => {
  const served = { audioCodecs: ["aac", "dts", "ac3"], audioBitrate: 768_000, allowCopy: true };

  it("DTS déclaré, AudioBitrate posé à son débit : la copie tient dans un palier 1080p", () => {
    expect(keptAudioCopyBitrate(served, DTS_51, 8_384_000)).toBe(768_000);
  });

  it("Jellyfin ne l'a pas prévue (codec absent, débit trop bas, copie interdite) : rien à garder", () => {
    expect(keptAudioCopyBitrate({ ...served, audioCodecs: ["aac"] }, DTS_51, 8_384_000)).toBeNull();
    expect(keptAudioCopyBitrate({ ...served, audioBitrate: 384_000 }, DTS_51, 8_384_000)).toBeNull();
    expect(keptAudioCopyBitrate({ ...served, allowCopy: false }, DTS_51, 8_384_000)).toBeNull();
  });

  it("trop lourde pour un petit palier : convertie", () => {
    expect(keptAudioCopyBitrate(served, DTS_51, 2_524_000)).toBeNull();
  });
});
