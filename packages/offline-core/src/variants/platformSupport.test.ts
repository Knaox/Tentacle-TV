/**
 * Les ensembles par moteur sont ce que le routeur et les profils Jellyfin
 * lisent : un codec oublié ici, c'est un transcodage inutile là-bas.
 */

import { describe, expect, it } from "vitest";
import {
  ANDROID_LOCAL_SUPPORT,
  ANDROID_MPV_SUPPORT,
  ANDROID_NATIVE_SUPPORT,
  IOS_LOCAL_SUPPORT,
  IOS_MPV_SUPPORT,
  IOS_NATIVE_SUPPORT,
  supportList,
  supportsToken,
  unionSupport,
} from "./platformSupport";

describe("platformSupport", () => {
  it("le natif iOS garde ses chaînes DirectPlay historiques, octet pour octet", () => {
    expect(supportList(IOS_NATIVE_SUPPORT.containers)).toBe("mp4,m4v,mov");
    expect(supportList(IOS_NATIVE_SUPPORT.videoCodecs)).toBe("h264,hevc");
    expect(supportList(IOS_NATIVE_SUPPORT.audioCodecs)).toBe("aac,flac,alac,ac3,eac3,mp3");
  });

  it("le natif Android aussi, ses jetons historiques en tête ; l'extension FFmpeg ajoute DTS, TrueHD, PCM", () => {
    expect(supportList(ANDROID_NATIVE_SUPPORT.containers).startsWith("mp4,m4v,mkv,webm")).toBe(true);
    expect(supportList(ANDROID_NATIVE_SUPPORT.videoCodecs)).toBe("h264,hevc,vp9");
    expect(supportList(ANDROID_NATIVE_SUPPORT.audioCodecs).startsWith("aac,mp3,flac,opus,vorbis,ac3,eac3")).toBe(true);
    for (const audio of ["dts", "truehd", "mlp", "alac", "pcm_s16le", "mp2"]) {
      expect(ANDROID_NATIVE_SUPPORT.audioCodecs.has(audio)).toBe(true);
    }
    expect(ANDROID_NATIVE_SUPPORT.containers.has("ts")).toBe(true);
    expect(ANDROID_NATIVE_SUPPORT.subtitleCodecs.has("pgssub")).toBe(true);
  });

  it("le lecteur avancé lit ce que le natif refuse : MKV, DTS, TrueHD, ASS, PGS, DivX", () => {
    for (const container of ["mkv", "avi", "ts", "wmv", "webm"]) {
      expect(IOS_MPV_SUPPORT.containers.has(container)).toBe(true);
    }
    for (const audio of ["dts", "truehd", "opus", "vorbis", "pcm_s16le"]) {
      expect(IOS_MPV_SUPPORT.audioCodecs.has(audio)).toBe(true);
      expect(IOS_NATIVE_SUPPORT.audioCodecs.has(audio)).toBe(false);
    }
    for (const video of ["mpeg2video", "mpeg4", "vc1", "vp9", "av1"]) {
      expect(IOS_MPV_SUPPORT.videoCodecs.has(video)).toBe(true);
    }
    for (const sub of ["ass", "ssa", "pgssub", "dvdsub", "subrip", "vtt"]) {
      expect(IOS_MPV_SUPPORT.subtitleCodecs.has(sub)).toBe(true);
    }
    expect(IOS_NATIVE_SUPPORT.subtitleCodecs.has("ass")).toBe(false);
    expect(IOS_NATIVE_SUPPORT.subtitleCodecs.has("pgssub")).toBe(false);
    // Android rend l'ASS (appauvri), pas les images DVD.
    expect(ANDROID_NATIVE_SUPPORT.subtitleCodecs.has("ass")).toBe(true);
    expect(ANDROID_NATIVE_SUPPORT.subtitleCodecs.has("dvdsub")).toBe(false);
  });

  it("le lecteur avancé désentrelace, AVPlayer non", () => {
    expect(IOS_NATIVE_SUPPORT.deinterlaces).toBe(false);
    expect(IOS_MPV_SUPPORT.deinterlaces).toBe(true);
    expect(ANDROID_MPV_SUPPORT).toBe(IOS_MPV_SUPPORT);
  });

  it("l'union contient les deux moteurs et désentrelace dès que l'un le fait", () => {
    const union = unionSupport(IOS_NATIVE_SUPPORT, IOS_MPV_SUPPORT);
    for (const value of IOS_NATIVE_SUPPORT.audioCodecs) expect(union.audioCodecs.has(value)).toBe(true);
    for (const value of IOS_MPV_SUPPORT.containers) expect(union.containers.has(value)).toBe(true);
    expect(union.deinterlaces).toBe(true);
    // Le natif iOS vient en premier : ses jetons gardent leur ordre en tête de liste.
    expect(supportList(union.containers).startsWith("mp4,m4v,mov")).toBe(true);
  });

  it("hors ligne : les deux moteurs réunis — un MKV DTS se garde tel quel sur iPhone", () => {
    expect(IOS_LOCAL_SUPPORT.containers.has("mkv")).toBe(true);
    expect(IOS_LOCAL_SUPPORT.audioCodecs.has("dts")).toBe(true);
    expect(IOS_LOCAL_SUPPORT.subtitleCodecs.has("pgssub")).toBe(true);
    expect(IOS_LOCAL_SUPPORT.deinterlaces).toBe(true);
    expect(supportList(IOS_LOCAL_SUPPORT.containers).startsWith("mp4,m4v,mov")).toBe(true);
    expect(ANDROID_LOCAL_SUPPORT.containers.has("avi")).toBe(true);
    expect(ANDROID_LOCAL_SUPPORT.audioCodecs.has("truehd")).toBe(true);
  });

  it("un conteneur Jellyfin en liste est lu si un jeton est connu", () => {
    expect(supportsToken(IOS_NATIVE_SUPPORT.containers, "mov,mp4,m4a,3gp,3g2,mj2")).toBe(true);
    expect(supportsToken(IOS_NATIVE_SUPPORT.containers, "mkv")).toBe(false);
    expect(supportsToken(IOS_NATIVE_SUPPORT.containers, "MP4")).toBe(true);
    expect(supportsToken(IOS_NATIVE_SUPPORT.containers, undefined)).toBe(false);
    expect(supportsToken(IOS_NATIVE_SUPPORT.containers, "")).toBe(false);
    expect(supportsToken(IOS_MPV_SUPPORT.containers, "matroska,webm")).toBe(true);
  });
});
