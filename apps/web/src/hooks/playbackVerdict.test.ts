import { describe, expect, it } from "vitest";
import { evaluerLecture, normaliserRaisons } from "./playbackVerdict";

/** URL de transcodage minimale, telle que Jellyfin la renvoie. */
const urlHls = (videoCodec: string) =>
  `/videos/x/master.m3u8?VideoCodec=${videoCodec}&AudioCodec=aac&MaxAudioChannels=6`;

describe("evaluerLecture", () => {
  it("reconnaît la lecture directe", () => {
    const v = evaluerLecture({ supportsDirectPlay: true, supportsDirectStream: true });
    expect(v.mode).toBe("DirectPlay");
    expect(v.reencodageVideo).toBe(false);
  });

  it("appelle Remux un transcodage motivé par le seul audio", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: urlHls("hevc"),
      transcodeReasons: ["AudioCodecNotSupported"],
      codecVideoSource: "hevc",
    });
    expect(v.mode).toBe("Remux");
    expect(v.reencodageVideo).toBe(false);
    expect(v.raisons).toEqual(["AudioCodecNotSupported"]);
  });

  it("appelle Transcode dès qu'une raison touche à l'image", () => {
    for (const raison of [
      "VideoCodecNotSupported", "VideoLevelNotSupported", "VideoBitDepthNotSupported",
      "RefFramesNotSupported", "AnamorphicVideoNotSupported", "InterlacedVideoNotSupported",
      "ContainerBitrateExceedsLimit", "VideoRangeTypeNotSupported",
    ]) {
      const v = evaluerLecture({
        supportsDirectPlay: false, supportsDirectStream: false,
        transcodingUrl: urlHls("h264"), transcodeReasons: [raison, "AudioCodecNotSupported"],
      });
      expect(v.mode, raison).toBe("Transcode");
    }
  });

  it("ne prend pas ContainerNotSupported pour une raison vidéo — c'est un remux", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: urlHls("hevc"), transcodeReasons: ["ContainerNotSupported"],
    });
    expect(v.mode).toBe("Remux");
  });

  it("croit `VideoCodec=copy` avant tout le reste", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false,
      transcodingUrl: urlHls("copy"), transcodeReasons: ["VideoCodecNotSupported"],
    });
    expect(v.mode).toBe("Remux");
  });

  it("compare les codecs quand le serveur ne donne aucune raison", () => {
    const commun = { supportsDirectPlay: false, supportsDirectStream: false };
    expect(evaluerLecture({ ...commun, transcodingUrl: urlHls("hevc,h264"), codecVideoSource: "hevc" }).mode)
      .toBe("Remux");
    expect(evaluerLecture({ ...commun, transcodingUrl: urlHls("h264"), codecVideoSource: "hevc" }).mode)
      .toBe("Transcode");
  });

  it("suppose le pire quand rien ne permet de trancher", () => {
    const v = evaluerLecture({
      supportsDirectPlay: false, supportsDirectStream: false, transcodingUrl: "/videos/x/master.m3u8",
    });
    expect(v.mode).toBe("Transcode");
    expect(v.reencodageVideo).toBe(true);
  });

  it("distingue DirectStream de Transcode en l'absence d'URL de transcodage", () => {
    expect(evaluerLecture({ supportsDirectPlay: false, supportsDirectStream: true }).mode)
      .toBe("DirectStream");
    expect(evaluerLecture({ supportsDirectPlay: false, supportsDirectStream: false }).mode)
      .toBe("Transcode");
  });
});

describe("normaliserRaisons", () => {
  it("accepte le tableau (Jellyfin 10.9+) comme la chaîne de drapeaux", () => {
    expect(normaliserRaisons(["A", "B"])).toEqual(["A", "B"]);
    expect(normaliserRaisons("A, B ,")).toEqual(["A", "B"]);
    expect(normaliserRaisons(undefined)).toEqual([]);
    expect(normaliserRaisons("")).toEqual([]);
  });
});
