/**
 * Le routeur est ce qui évite un transcodage inutile : chaque cas ci-dessous
 * est un fichier réel d'une bibliothèque Jellyfin, et la règle du prompt qui
 * lui correspond (§3.2 iOS, §3.3 Android, pièges §7).
 */

import { describe, expect, it } from "vitest";
import type { MediaStream } from "@tentacle-tv/shared";
import {
  decideEngine,
  isDolbyVisionProfile5,
  isEac3Atmos,
  nativeMediaPlausible,
  type EngineRouterInput,
} from "./engineRouter";

function stream(partial: Partial<MediaStream> & Pick<MediaStream, "Type" | "Codec" | "Index">): MediaStream {
  return { IsDefault: false, ...partial };
}

const video = (codec: string, extra: Partial<MediaStream> = {}) => stream({ Type: "Video", Codec: codec, Index: 0, ...extra });
const audio = (codec: string, index = 1, extra: Partial<MediaStream> = {}) =>
  stream({ Type: "Audio", Codec: codec, Index: index, IsDefault: index === 1, ...extra });
const sub = (codec: string, index: number, extra: Partial<MediaStream> = {}) =>
  stream({ Type: "Subtitle", Codec: codec, Index: index, ...extra });

const base: EngineRouterInput = {
  platform: "ios",
  setting: "auto",
  mpvAvailable: true,
  airPlayActive: false,
  preferSystemAtmos: false,
  styledSubtitlesViaMpv: true,
  av1Hardware: false,
  container: "mkv",
  streams: [video("hevc"), audio("dts")],
  selectedAudioIndex: -1,
  selectedSubtitleIndex: -1,
};

const ios = (over: Partial<EngineRouterInput>) => decideEngine({ ...base, ...over });
const android = (over: Partial<EngineRouterInput>) => decideEngine({ ...base, platform: "android", ...over });

describe("decideEngine — iOS, mode Auto", () => {
  it("MKV HEVC 10 bits + DTS-HD : le lecteur avancé, à cause du conteneur", () => {
    expect(ios({})).toEqual({ engine: "mpv", reason: "container" });
  });

  it("MP4 H.264 8 bits + AAC, sous-titre texte : le lecteur système", () => {
    const decision = ios({
      container: "mov,mp4,m4a,3gp,3g2,mj2",
      streams: [video("h264", { BitDepth: 8 }), audio("aac"), sub("subrip", 2)],
      selectedSubtitleIndex: 2,
    });
    expect(decision).toEqual({ engine: "native", reason: "native-media" });
  });

  it("MP4 H.264 10 bits : le lecteur avancé (AVPlayer ne décode que le 8 bits)", () => {
    expect(ios({ container: "mp4", streams: [video("h264", { BitDepth: 10 }), audio("aac")] }))
      .toEqual({ engine: "mpv", reason: "video-bit-depth" });
  });

  it("MP4 HEVC + E-AC-3 avec un ASS choisi : le lecteur avancé, pour les styles", () => {
    expect(ios({ container: "mp4", streams: [video("hevc"), audio("eac3"), sub("ass", 2)], selectedSubtitleIndex: 2 }))
      .toEqual({ engine: "mpv", reason: "subtitle-codec" });
  });

  it("le même MP4 sans sous-titre choisi reste au lecteur système", () => {
    expect(ios({ container: "mp4", streams: [video("hevc"), audio("eac3"), sub("ass", 2)], selectedSubtitleIndex: -1 }))
      .toEqual({ engine: "native", reason: "native-media" });
  });

  it("MP4 + PGS choisi : le lecteur avancé (jamais gravé par le serveur)", () => {
    expect(ios({ container: "mp4", streams: [video("h264"), audio("aac"), sub("pgssub", 2)], selectedSubtitleIndex: 2 }))
      .toEqual({ engine: "mpv", reason: "subtitle-codec" });
  });

  it("MP4 + Opus : le lecteur avancé, à cause de l'audio", () => {
    expect(ios({ container: "mp4", streams: [video("h264"), audio("opus")] }))
      .toEqual({ engine: "mpv", reason: "audio-codec" });
  });

  it("la piste audio CHOISIE compte, pas la piste par défaut", () => {
    const streams = [video("h264"), audio("aac", 1), audio("dts", 2)];
    expect(ios({ container: "mp4", streams, selectedAudioIndex: -1 }).engine).toBe("native");
    expect(ios({ container: "mp4", streams, selectedAudioIndex: 2 })).toEqual({ engine: "mpv", reason: "audio-codec" });
  });

  it("AV1 avec la puce (A17 Pro et plus) : le système en MP4, le lecteur avancé en MKV", () => {
    const streams = [video("av1"), audio("aac")];
    expect(ios({ container: "mp4", streams, av1Hardware: true })).toEqual({ engine: "native", reason: "native-media" });
    expect(ios({ container: "mkv", streams, av1Hardware: true })).toEqual({ engine: "mpv", reason: "container" });
  });

  it("AV1 sans la puce : jamais le lecteur avancé (libdav1d plante), le système demande au serveur", () => {
    const streams = [video("av1"), audio("opus")];
    expect(ios({ container: "mp4", streams, av1Hardware: false })).toEqual({ engine: "native", reason: "av1-software" });
    expect(ios({ container: "mkv", streams, av1Hardware: false })).toEqual({ engine: "native", reason: "av1-software" });
  });

  it("Dolby Vision profil 5 : le lecteur système, même en MKV (remux HLS accepté)", () => {
    expect(ios({ streams: [video("hevc", { DvProfile: 5 }), audio("eac3")] }))
      .toEqual({ engine: "native", reason: "dolby-vision-p5" });
    expect(ios({ streams: [video("hevc", { VideoRangeType: "DOVI" }), audio("eac3")] }))
      .toEqual({ engine: "native", reason: "dolby-vision-p5" });
  });

  it("Dolby Vision 8.1 en MKV : le lecteur avancé lit la couche HDR10", () => {
    expect(ios({ streams: [video("hevc", { DvProfile: 8, VideoRangeType: "DOVIWithHDR10" }), audio("eac3")] }))
      .toEqual({ engine: "mpv", reason: "container" });
  });

  it("« Préférer l'Atmos du système » : l'E-AC-3 JOC va au lecteur système, sinon non", () => {
    const streams = [video("hevc"), audio("eac3", 1, { DisplayTitle: "English - Dolby Digital+ Atmos - 5.1" })];
    expect(ios({ streams, preferSystemAtmos: true })).toEqual({ engine: "native", reason: "system-atmos" });
    expect(ios({ streams, preferSystemAtmos: false })).toEqual({ engine: "mpv", reason: "container" });
  });

  it("AirPlay actif au démarrage : le lecteur système, quel que soit le réglage", () => {
    expect(ios({ airPlayActive: true })).toEqual({ engine: "native", reason: "airplay" });
    expect(ios({ airPlayActive: true, setting: "mpv" })).toEqual({ engine: "native", reason: "airplay" });
  });

  it("le réglage impose son moteur ; sans module, le système", () => {
    expect(ios({ setting: "native" })).toEqual({ engine: "native", reason: "setting" });
    expect(ios({ setting: "mpv", container: "mp4", streams: [video("h264"), audio("aac")] }))
      .toEqual({ engine: "mpv", reason: "setting" });
    expect(ios({ mpvAvailable: false })).toEqual({ engine: "native", reason: "mpv-unavailable" });
  });
});

describe("decideEngine — Android, mode Auto", () => {
  it("MKV HEVC + DTS : ExoPlayer avec l'extension FFmpeg (dès que la liste native le dit)", () => {
    // La liste native Android s'étend à l'étape Android ; ici le DTS n'y est pas encore.
    expect(android({ streams: [video("hevc"), audio("eac3")] })).toEqual({ engine: "native", reason: "native-media" });
  });

  it("AVI DivX : le lecteur avancé", () => {
    expect(android({ container: "avi", streams: [video("mpeg4"), audio("mp3")] })).toEqual({ engine: "mpv", reason: "container" });
  });

  it("MKV MPEG-2 : le lecteur avancé, à cause du codec", () => {
    expect(android({ streams: [video("mpeg2video"), audio("ac3")] })).toEqual({ engine: "mpv", reason: "video-codec" });
  });

  it("ASS choisi : le lecteur avancé si le réglage le demande, sinon ExoPlayer l'aplatit", () => {
    const streams = [video("hevc"), audio("aac"), sub("ass", 2)];
    expect(android({ streams, selectedSubtitleIndex: 2 })).toEqual({ engine: "mpv", reason: "subtitle-styled" });
    expect(android({ streams, selectedSubtitleIndex: 2, styledSubtitlesViaMpv: false }))
      .toEqual({ engine: "native", reason: "native-media" });
  });

  it("VobSub choisi : le lecteur avancé", () => {
    expect(android({ streams: [video("h264"), audio("aac"), sub("dvdsub", 2)], selectedSubtitleIndex: 2 }))
      .toEqual({ engine: "mpv", reason: "subtitle-codec" });
  });
});

describe("aides", () => {
  it("isDolbyVisionProfile5 lit le profil d'abord, la plage ensuite", () => {
    expect(isDolbyVisionProfile5(video("hevc", { DvProfile: 8, VideoRangeType: "DOVI" }))).toBe(false);
    expect(isDolbyVisionProfile5(video("hevc", { VideoRangeType: "DOVIWithHDR10" }))).toBe(false);
    expect(isDolbyVisionProfile5(video("hevc", { VideoRangeType: 3 }))).toBe(false);
    expect(isDolbyVisionProfile5(undefined)).toBe(false);
  });

  it("isEac3Atmos exige l'E-AC-3 et la mention Atmos", () => {
    expect(isEac3Atmos(audio("eac3", 1, { Profile: "Dolby Digital Plus + Dolby Atmos" }))).toBe(true);
    expect(isEac3Atmos(audio("truehd", 1, { DisplayTitle: "TrueHD Atmos 7.1" }))).toBe(false);
    expect(isEac3Atmos(audio("eac3"))).toBe(false);
  });

  it("nativeMediaPlausible : le repli vers le système n'a de sens qu'avec un conteneur lu", () => {
    expect(nativeMediaPlausible("ios", "mkv", [video("h264")])).toBe(false);
    expect(nativeMediaPlausible("ios", "mp4", [video("h264")])).toBe(true);
    expect(nativeMediaPlausible("ios", "mp4", [video("vp9")])).toBe(false);
    expect(nativeMediaPlausible("android", "mkv", [video("hevc")])).toBe(true);
  });
});
