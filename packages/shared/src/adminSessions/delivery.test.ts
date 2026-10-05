/**
 * La sorte de diffusion d'une lecture : ce que le serveur calcule vraiment,
 * pas ce que le client a déclaré.
 */

import { describe, expect, it } from "vitest";
import type { AdminSessionDto, AdminTranscodingDto } from "../types/adminSessionsDto";
import { countDeliveries, declaredTranscodeOnly, deliveryOf } from "./delivery";

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

  it("un « Transcode » sans aucun encodage chez Jellyfin : direct, déclaré seulement", () => {
    // Mesuré le 2026-10-05 : un épisode lu en Static=true, déclaré « Transcode » par le client.
    const declared = session({ playMethod: "Transcode", transcoding: null });
    expect(deliveryOf(declared)).toBe("direct");
    expect(declaredTranscodeOnly(declared)).toBe(true);
    expect(declaredTranscodeOnly(session({ playMethod: "Transcode", transcoding: transcoding(false, false) }))).toBe(false);
    expect(declaredTranscodeOnly(session({ playMethod: "DirectPlay" }))).toBe(false);
  });

  it("de la musique n'a pas d'image à réencoder", () => {
    const song = { itemId: "m", name: "Song", type: "Audio", imageItemId: "m" };
    expect(deliveryOf(session({ nowPlaying: song, source: { audioCodec: "flac" }, playMethod: "Transcode", transcoding: transcoding(false, false) }))).toBe("audio");
    expect(deliveryOf(session({ nowPlaying: song, source: { audioCodec: "flac" }, playMethod: "Transcode", transcoding: transcoding(false, true) }))).toBe("remux");
    // Sans encodage chez Jellyfin, la musique déclarée « Transcode » part telle quelle.
    expect(deliveryOf(session({ nowPlaying: song, source: null, playMethod: "Transcode", transcoding: null }))).toBe("direct");
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
