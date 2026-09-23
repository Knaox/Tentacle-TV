/**
 * La sorte de diffusion d'une lecture : ce que le serveur calcule vraiment,
 * pas ce que le client a déclaré.
 */

import { describe, expect, it } from "vitest";
import type { AdminSessionDto, AdminTranscodingDto } from "@tentacle-tv/shared";
import { countDeliveries, deliveryOf } from "./delivery";

function transcoding(isVideoDirect: boolean, isAudioDirect: boolean): AdminTranscodingDto {
  return { isVideoDirect, isAudioDirect, reasons: [] };
}

function session(overrides: Partial<AdminSessionDto>): AdminSessionDto {
  return {
    id: "s", userId: "u", userName: "Alice", userImageTag: null, client: "Tentacle", deviceName: "Mac",
    deviceId: "d", applicationVersion: "1", remoteAddress: null, lastActivity: "2026-09-23T10:00:00Z",
    supportsRemoteControl: true, viaTentacle: false,
    nowPlaying: { itemId: "i", name: "Dune", type: "Movie", imageItemId: "i" },
    isPaused: false, isMuted: false, positionTicks: 0, positionAt: 0,
    playMethod: "DirectPlay", source: { videoCodec: "hevc", audioCodec: "truehd" }, transcoding: null,
    watchGroupId: null,
    ...overrides,
  };
}

describe("deliveryOf", () => {
  it("lecture directe : rien ne tourne sur le serveur", () => {
    expect(deliveryOf(session({ playMethod: "DirectPlay" }))).toBe("direct");
    // Flux statique : le fichier part tel quel, sans travail décrit.
    expect(deliveryOf(session({ playMethod: "DirectStream" }))).toBe("direct");
  });

  it("un « Transcode » qui copie image et son est un remux", () => {
    expect(deliveryOf(session({ playMethod: "Transcode", transcoding: transcoding(true, true) }))).toBe("remux");
    expect(deliveryOf(session({ playMethod: "DirectStream", transcoding: transcoding(true, true) }))).toBe("remux");
  });

  it("image copiée, son converti : transcodage audio", () => {
    expect(deliveryOf(session({ playMethod: "Transcode", transcoding: transcoding(true, false) }))).toBe("audio");
  });

  it("image réencodée : transcodage, quel que soit le son", () => {
    expect(deliveryOf(session({ playMethod: "Transcode", transcoding: transcoding(false, true) }))).toBe("video");
    expect(deliveryOf(session({ playMethod: "Transcode", transcoding: transcoding(false, false) }))).toBe("video");
  });

  it("un « Transcode » sans description est pris au pire", () => {
    expect(deliveryOf(session({ playMethod: "Transcode", transcoding: null }))).toBe("video");
  });

  it("de la musique n'a pas d'image à réencoder", () => {
    const song = { itemId: "m", name: "Song", type: "Audio", imageItemId: "m" };
    expect(deliveryOf(session({ nowPlaying: song, source: { audioCodec: "flac" }, playMethod: "Transcode", transcoding: transcoding(false, false) }))).toBe("audio");
    expect(deliveryOf(session({ nowPlaying: song, source: { audioCodec: "flac" }, playMethod: "Transcode", transcoding: transcoding(false, true) }))).toBe("remux");
    expect(deliveryOf(session({ nowPlaying: song, source: null, playMethod: "Transcode", transcoding: null }))).toBe("audio");
  });
});

describe("countDeliveries", () => {
  it("compte les lectures, pas les sessions au repos", () => {
    const counts = countDeliveries([
      session({ id: "a" }),
      session({ id: "b", playMethod: "Transcode", transcoding: transcoding(true, true) }),
      session({ id: "c", playMethod: "Transcode", transcoding: transcoding(true, false) }),
      session({ id: "d", playMethod: "Transcode", transcoding: transcoding(false, false) }),
      session({ id: "e", nowPlaying: null, playMethod: null }),
    ]);
    expect(counts).toEqual({ direct: 1, remux: 1, audio: 1, video: 1 });
  });
});
