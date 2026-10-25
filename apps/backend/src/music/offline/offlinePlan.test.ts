/**
 * Le plan de la musique gardée : l'Allégé audio seulement là où l'administration
 * le permet ET où la source y gagne ; sinon l'original, avec sa taille exacte.
 */

import { describe, expect, it } from "vitest";
import type { IndexRow } from "../index/indexTypes";
import { planTrack } from "./offlinePlan";

const ID = "0123456789abcdef0123456789abcdef";

function track(format: IndexRow["format"], extra: Partial<IndexRow> = {}): IndexRow {
  return {
    id: ID, kind: "track", name: "Atlantean Twilight", sortName: "atlantean twilight", albumId: null, albumName: null,
    albumArtist: null, artists: [], year: null, trackNumber: 1, discNumber: 1, durationMs: 200_000, recordingMbid: null,
    releaseMbid: null, releaseGroupMbid: null, artistMbid: null, format, sizeBytes: 12_000_000, normalizationGain: null,
    imageTag: null, childCount: null, dateCreated: null, ...extra,
  };
}

const FLAC = { codec: "flac", container: "flac", sampleRate: 96_000, bitDepth: 24, bitrate: 499_261, channels: 2, lossless: true };
const MP3 = { codec: "mp3", container: "mp3", sampleRate: 44_100, bitDepth: null, bitrate: 256_000, channels: 2, lossless: false };

describe("planTrack", () => {
  it("un FLAC avec le mode Allégé : l'Allégé audio AAC 256 kb/s, taille estimée", () => {
    expect(planTrack(track(FLAC), { light: true })).toEqual({
      id: ID,
      variant: "light",
      preset: "a256",
      path: `/api/downloads/light/${ID}?mediaSourceId=${ID}&preset=a256`,
      container: "m4a",
      expectedSize: null,
      estimatedSize: Math.ceil(((200 * 256_000) / 8) * 1.05),
    });
  });

  it("sans le mode Allégé : l'original tel quel, sa taille pour le contrôle d'intégrité", () => {
    expect(planTrack(track(FLAC), { light: false })).toMatchObject({
      variant: "original",
      preset: null,
      path: `/api/downloads/original/${ID}?mediaSourceId=${ID}`,
      container: "flac",
      expectedSize: 12_000_000,
    });
  });

  it("un MP3 n'est jamais réencodé : l'Allégé n'y gagnerait rien", () => {
    expect(planTrack(track(MP3), { light: true }).variant).toBe("original");
    expect(planTrack(track({ ...MP3, bitrate: 900_000 }), { light: true }).variant).toBe("light");
  });

  it("un conteneur inconnu ou bizarre ne nomme jamais un fichier", () => {
    expect(planTrack(track({ ...FLAC, container: "mov,mp4,m4a" }), { light: false }).container).toBe("mov");
    expect(planTrack(track({ ...FLAC, container: "../x" }), { light: false }).container).toBe("audio");
    expect(planTrack(track(null), { light: true })).toMatchObject({ variant: "original", container: "audio" });
  });
});
