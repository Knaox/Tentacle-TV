/** Sans le droit, l'entrée de la musique gardée est ABSENTE (règle 15 du lot) ; sans Octave sur le serveur aussi (règle 16). */

import { describe, expect, it } from "vitest";
import { musicOfflineSurface } from "@tentacle-tv/offline-core/music";
import { musicEntryVisible, type MusicEntryInput } from "./musicEntryRule";

const OCTAVE = { available: true, settled: true };
const BASE: MusicEntryInput = { surfaceVisible: true, playable: 3, online: true, octave: OCTAVE, statusFailed: false, configKnown: true };
const surface = (keepRight: "granted" | "refused" | "unknown", profileSession = false, capability = true) =>
  musicOfflineSurface({ native: true, capability, profileSession, keepRight, hasContent: true, providerId: null, providerKeep: null });

describe("entrée de la musique gardée (mobile)", () => {
  it("compte de l'appareil, droit, musique gardée : présente", () => {
    expect(musicEntryVisible({ ...BASE, surfaceVisible: surface("granted").visible })).toBe(true);
  });

  it("sans le droit keepOffline → absente, même avec de la musique gardée", () => {
    expect(musicEntryVisible({ ...BASE, surfaceVisible: surface("refused").visible })).toBe(false);
  });

  it("session de profil → absente", () => {
    expect(musicEntryVisible({ ...BASE, surfaceVisible: surface("granted", true).visible })).toBe(false);
  });

  it("serveur qui ne déclare pas Octave (réponse établie, en ligne) → absente", () => {
    expect(musicEntryVisible({ ...BASE, octave: { available: false, settled: true } })).toBe(false);
  });

  it("hors ligne ou serveur en panne : la musique gardée reste écoutable", () => {
    expect(musicEntryVisible({ ...BASE, online: false, octave: { available: false, settled: true } })).toBe(true);
    expect(musicEntryVisible({ ...BASE, statusFailed: true, octave: { available: false, settled: true } })).toBe(true);
  });

  it("démarrage à froid sans réseau, appareil pas encore dit hors ligne : /api/config sans réponse n'est pas une absence", () => {
    expect(musicEntryVisible({ ...BASE, configKnown: false, octave: { available: false, settled: true } })).toBe(true);
  });

  it("rien de gardé en entier → absente", () => {
    expect(musicEntryVisible({ ...BASE, playable: 0 })).toBe(false);
    expect(musicEntryVisible({ ...BASE, playable: null })).toBe(false);
  });
});

describe("porte de la musique gardée — sans le droit, aucun bouton ni marque", () => {
  it("keepOffline refusé, profil, serveur sans offline.music sans rien de gardé : rien", () => {
    expect(surface("refused")).toEqual({ visible: false, library: false, externalFrom: null });
    expect(surface("granted", true).visible).toBe(false);
    const legacy = musicOfflineSurface({ native: true, capability: false, profileSession: false, keepRight: "granted", hasContent: false, providerId: null, providerKeep: null });
    expect(legacy).toEqual({ visible: false, library: false, externalFrom: null });
  });

  it("titre hors bibliothèque : sans le droit de l'extension (Sillon keepOffline), rien d'ailleurs", () => {
    const s = musicOfflineSurface({ native: true, capability: true, profileSession: false, keepRight: "granted", hasContent: false, providerId: "sillon", providerKeep: false });
    expect(s.externalFrom).toBeNull();
    expect(s.library).toBe(true);
  });
});
