import { describe, expect, it } from "vitest";
import { buildCastDeviceProfile, CAST_DEFAULT_MAX_BITRATE, CAST_ENGINE, castContentType } from "./castProfile";

describe("profil de diffusion (Google Cast)", () => {
  it("transcode en HLS TS, H.264 + AAC, que tout récepteur lit", () => {
    const profile = buildCastDeviceProfile();
    const video = profile.TranscodingProfiles.filter((p) => p.Type === "Video");
    expect(video[0]).toMatchObject({ Container: "ts", VideoCodec: "h264", Protocol: "hls" });
    expect(video[0].AudioCodec?.split(",")[0]).toBe("aac");
    expect(video.every((p) => !String(p.VideoCodec).includes("hevc"))).toBe(true);
  });

  it("ne promet ni HEVC, ni HDR, ni son multicanal", () => {
    expect(CAST_ENGINE.videoCodecs).toEqual(["h264"]);
    expect(Object.values(CAST_ENGINE.hdr).some(Boolean)).toBe(false);
    expect(CAST_ENGINE.maxAudioChannels).toBe(2);
  });

  it("lit en direct un MP4 H.264, pas un MKV", () => {
    const direct = buildCastDeviceProfile().DirectPlayProfiles.find((p) => p.Type === "Video");
    expect(direct?.Container).toBe("mp4,m4v");
    expect(direct?.VideoCodec).toBe("h264");
  });

  it("plafonne l'image à 1080p 8 bits SDR", () => {
    const h264 = buildCastDeviceProfile().CodecProfiles?.find((p) => p.Codec === "h264");
    const byProp = Object.fromEntries((h264?.Conditions ?? []).map((c) => [c.Property, c.Value]));
    expect(byProp).toMatchObject({ Height: "1080", Width: "1920", VideoBitDepth: "8", VideoRangeType: "SDR" });
  });

  it("garde le WebVTT en piste séparée et grave tout autre sous-titre", () => {
    const subs = buildCastDeviceProfile().SubtitleProfiles;
    expect(subs.find((s) => s.Format === "vtt")?.Method).toBe("External");
    expect(subs.filter((s) => s.Format !== "vtt").every((s) => s.Method === "Encode")).toBe(true);
  });

  it("prend le débit demandé, sinon un débit de Wi-Fi domestique", () => {
    expect(buildCastDeviceProfile().MaxStreamingBitrate).toBe(CAST_DEFAULT_MAX_BITRATE);
    expect(buildCastDeviceProfile(8_000_000).MaxStreamingBitrate).toBe(8_000_000);
    expect(buildCastDeviceProfile(0).MaxStreamingBitrate).toBe(CAST_DEFAULT_MAX_BITRATE);
  });

  it("annonce le type du flux au récepteur", () => {
    expect(castContentType(false)).toBe("application/x-mpegURL");
    expect(castContentType(true, "mp4")).toBe("video/mp4");
    expect(castContentType(true, "mp3")).toBe("audio/mpeg");
  });
});
