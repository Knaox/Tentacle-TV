/**
 * La porte de la musique gardée : bureau, capacité du serveur, compte de
 * l'appareil, droits de l'extension pour un titre d'ailleurs.
 */

import { describe, expect, it } from "vitest";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { canKeepTrack, musicOfflineSurface, type MusicOfflineInputs } from "./keepRules";

const BASE: MusicOfflineInputs = {
  native: true,
  capability: true,
  profileSession: false,
  keepRight: "granted",
  hasContent: false,
  providerId: "musique",
  providerKeep: true,
};

function track(partial: Partial<MusicTrack>): MusicTrack {
  return {
    key: "jf:a", jellyfinId: "a", external: null, title: "T", artists: [], album: null, durationMs: null, trackNumber: null,
    discNumber: null, year: null, artworkUrl: null, mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: "library", format: null, favorite: false, ...partial,
  };
}

const LIBRARY = track({});
const ELSEWHERE = track({ key: "ext:musique:x", jellyfinId: null, external: { pluginId: "musique", id: "x" }, availability: "remote" });

describe("musicOfflineSurface", () => {
  it("compte de l'appareil, droit et capacité : tout se garde", () => {
    const s = musicOfflineSurface(BASE);
    expect(s).toEqual({ visible: true, library: true, externalFrom: "musique" });
    expect(canKeepTrack(LIBRARY, s)).toBe(true);
    expect(canKeepTrack(ELSEWHERE, s)).toBe(true);
  });

  it("le web, un serveur d'avant : rien de nouveau", () => {
    expect(musicOfflineSurface({ ...BASE, native: false }).visible).toBe(false);
    const before = musicOfflineSurface({ ...BASE, capability: false });
    expect(before.library).toBe(false);
    expect(canKeepTrack(LIBRARY, before)).toBe(false);
  });

  it("une session de profil n'en voit rien, même avec de la musique gardée par le compte", () => {
    expect(musicOfflineSurface({ ...BASE, profileSession: true, hasContent: true })).toEqual({ visible: false, library: false, externalFrom: null });
  });

  it("sans le droit de garder (EnableContentDownloading), rien", () => {
    expect(musicOfflineSurface({ ...BASE, keepRight: "refused", hasContent: true }).visible).toBe(false);
  });

  it("hors ligne sans droit connu : ce qui est gardé reste visible, rien de nouveau", () => {
    expect(musicOfflineSurface({ ...BASE, capability: false, keepRight: "unknown", hasContent: true })).toEqual({ visible: true, library: false, externalFrom: null });
  });

  it("un titre d'ailleurs exige l'extension et SON droit", () => {
    expect(canKeepTrack(ELSEWHERE, musicOfflineSurface({ ...BASE, providerKeep: false }))).toBe(false);
    expect(canKeepTrack(ELSEWHERE, musicOfflineSurface({ ...BASE, providerKeep: null }))).toBe(false);
    expect(canKeepTrack(ELSEWHERE, musicOfflineSurface({ ...BASE, providerId: null }))).toBe(false);
    expect(canKeepTrack({ ...ELSEWHERE, external: { pluginId: "autre", id: "x" } }, musicOfflineSurface(BASE))).toBe(false);
    // La bibliothèque, elle, ne dépend pas de l'extension.
    expect(canKeepTrack(LIBRARY, musicOfflineSurface({ ...BASE, providerKeep: false }))).toBe(true);
  });
});

describe("titre indisponible (lot « fl »)", () => {
  it("jamais gardé : ni le geste, ni la tenue à jour d'une playlist gardée ne le tentent ; lisible de nouveau, il se garde", () => {
    const s = musicOfflineSurface(BASE);
    expect(canKeepTrack({ ...ELSEWHERE, unavailable: "notStreamable" }, s)).toBe(false);
    expect(canKeepTrack({ ...ELSEWHERE, unavailable: null }, s)).toBe(true);
  });
});
