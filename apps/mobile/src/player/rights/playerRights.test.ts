import { describe, expect, it } from "vitest";
import { FULL_PLAYBACK_RIGHTS, collectPlaybackFailure, type MediaSource } from "@tentacle-tv/shared";
import { toPlaybackFailure } from "../problems/playbackFailure";
import { playerRightsOf } from "./playerRights";

/**
 * Le lecteur mobile ne demande jamais un mode que les droits du compte
 * refusent, et le dit : lecture interdite, conversion refusée, plafond de
 * débit d'un client distant (docs/DROITS-UTILISATEURS.md § 9.2).
 */

const source = {
  Id: "s", Bitrate: 20_000_000,
  MediaStreams: [{ Type: "Video", Codec: "hevc", Index: 0, Width: 3840, Height: 2160, BitRate: 19_000_000 }],
} as unknown as MediaSource;

describe("droits de lecture du lecteur mobile", () => {
  it("tous les droits : rien ne change", () => {
    const rights = playerRightsOf(FULL_PLAYBACK_RIGHTS, source);
    expect(rights.refusalBefore()).toBeNull();
    expect(rights.capBitrate(8_000_000)).toBe(8_000_000);
    expect(rights.capBitrate(0)).toBe(0);
  });

  it("lecture interdite : refusée avant la moindre requête, et dite", () => {
    const rights = playerRightsOf({ ...FULL_PLAYBACK_RIGHTS, mediaPlayback: false }, source);
    expect(rights.refusalBefore()).toBe("playback_not_allowed");
    const collected = collectPlaybackFailure(toPlaybackFailure({ from: "refusal", refusal: "playback_not_allowed" }));
    expect(JSON.stringify(collected)).toContain("playback_not_allowed");
  });

  it("plafond d'un client distant : le débit est borné, même en « Originale »", () => {
    const rights = playerRightsOf({ ...FULL_PLAYBACK_RIGHTS, maxBitrate: 4_000_000 }, source);
    expect(rights.capBitrate(0)).toBe(4_000_000);
    expect(rights.capBitrate(10_000_000)).toBe(4_000_000);
    const original = { key: "original", bitrate: null } as never;
    expect(rights.withCap(original)).not.toBe(original);
  });

  it("au-dessus du plafond sans droit de réencoder : refus d'avance", () => {
    const rights = playerRightsOf({ ...FULL_PLAYBACK_RIGHTS, maxBitrate: 4_000_000, videoTranscoding: false }, source);
    expect(rights.refusalBefore()).toBe("conversion_not_allowed");
  });

  it("une conversion refusée dans la proposition de Jellyfin : refusée", () => {
    const rights = playerRightsOf({ ...FULL_PLAYBACK_RIGHTS, videoTranscoding: false, audioTranscoding: false, remuxing: false }, source);
    expect(rights.refusalOf({ ...source, TranscodingUrl: null } as MediaSource, false)).toBe("conversion_not_allowed");
    expect(rights.refusalOf(source, true)).toBeNull();
  });
});
