import { describe, expect, it } from "vitest";
import { FULL_PLAYBACK_RIGHTS, type MediaSource } from "@tentacle-tv/shared";
import { castRightsAfter, castRightsBefore } from "./castRights";

/** Envoyer à la TV : refusé d'avance sans le droit de réencoder, borné par le plafond. */

describe("diffusion et droits de lecture", () => {
  it("tous les droits : rien ne change", () => {
    expect(castRightsBefore(FULL_PLAYBACK_RIGHTS)).toEqual({ refused: false, maxBitrate: undefined });
  });

  it("sans lecture, ou sans droit de réencoder : refusée d'avance", () => {
    expect(castRightsBefore({ ...FULL_PLAYBACK_RIGHTS, mediaPlayback: false }).refused).toBe(true);
    expect(castRightsBefore({ ...FULL_PLAYBACK_RIGHTS, videoTranscoding: false }).refused).toBe(true);
  });

  it("le plafond de ce client borne ce que la TV demande", () => {
    expect(castRightsBefore({ ...FULL_PLAYBACK_RIGHTS, maxBitrate: 6_000_000 }).maxBitrate).toBe(6_000_000);
  });

  it("une conversion refusée dans la proposition de Jellyfin : refusée", () => {
    const ms = { Id: "s", MediaStreams: [], TranscodingUrl: null } as unknown as MediaSource;
    expect(castRightsAfter({ ...FULL_PLAYBACK_RIGHTS, audioTranscoding: false }, ms, false)).toBe(true);
    expect(castRightsAfter(FULL_PLAYBACK_RIGHTS, ms, true)).toBe(false);
  });
});
