import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBACK_SETTINGS, type NextEpisodeSettings } from "./playbackSettings";
import type { ResolvedSegment } from "./segmentTypes";
import { autoNextEligible, nextCardTriggerReached, nextEpisodeReachable } from "./nextTriggers";
import { DEFAULT_PLAYBACK_SETTINGS as DEFAULTS } from "./playbackSettings";
import type { SegmentType } from "./segmentTypes";

const RUNTIME = 1_440_000; // 24 min

const outro = (startMs: number, endMs: number, hasContentAfter = false): ResolvedSegment => ({
  type: "Outro",
  startMs,
  endMs,
  source: "jellyfin",
  endsAtMediaEnd: endMs >= RUNTIME - 15_000,
  hasContentAfter,
});

const next = (patch: Partial<NextEpisodeSettings> = {}): NextEpisodeSettings => ({
  ...DEFAULT_PLAYBACK_SETTINGS.next,
  ...patch,
});

describe("nextCardTriggerReached — la fiche", () => {
  it("sans générique, c'est le seuil de la bibliothèque qui décide", () => {
    const settings = next({
      beforeEndRules: [{ libraryIds: ["anime"], mode: "seconds", value: 15 }],
    });
    expect(nextCardTriggerReached(RUNTIME - 20_000, RUNTIME, [], settings, "anime")).toBe(false);
    expect(nextCardTriggerReached(RUNTIME - 10_000, RUNTIME, [], settings, "anime")).toBe(true);
    // Une autre bibliothèque retombe sur le seuil global — 98 %, soit 28,8 s.
    expect(nextCardTriggerReached(RUNTIME - 20_000, RUNTIME, [], settings, "films")).toBe(true);
  });

  it("le repli est éteint : la fin reste nue", () => {
    const settings = next({ beforeEndEnabled: false });
    expect(nextCardTriggerReached(RUNTIME - 1_000, RUNTIME, [], settings)).toBe(false);
  });

  it("AVEC un générique, le repli ne s'applique JAMAIS — zéro collision", () => {
    // Le seuil dirait « oui » à 15 s de la fin ; le générique dit « non »
    // avant 20 min, et c'est lui qui commande.
    const settings = next({ beforeEndDefault: { mode: "seconds", value: 600 } });
    const segments = [outro(1_200_000, RUNTIME)];
    expect(nextCardTriggerReached(1_000_000, RUNTIME, segments, settings)).toBe(false);
    expect(nextCardTriggerReached(1_200_000, RUNTIME, segments, settings)).toBe(true);
  });

  it("une scène post-générique ferme la fenêtre : la fiche ne la couvre pas", () => {
    const segments = [outro(1_200_000, 1_380_000, true)];
    expect(nextCardTriggerReached(1_250_000, RUNTIME, segments, next())).toBe(true);
    // Après le saut, la position est SUR la fin du générique : plus de fiche.
    expect(nextCardTriggerReached(1_380_000, RUNTIME, segments, next())).toBe(false);
  });

  it("la fenêtre se ferme AVANT la cible du saut — l'atterrissage n'est jamais exact", () => {
    const segments = [outro(1_200_000, 1_380_000, true)];
    // Le bouton cède sa dernière seconde (`WINDOW_TAIL_MS`) ; la fiche ne doit
    // pas s'y engouffrer, sans quoi elle paraît juste avant la scène — et y
    // reste dès que le seek retombe derrière sa cible (image-clé mpv, hls.js,
    // décalage de flux, position échantillonnée à 1 Hz).
    expect(nextCardTriggerReached(1_379_000, RUNTIME, segments, next())).toBe(false);
    expect(nextCardTriggerReached(1_379_500, RUNTIME, segments, next())).toBe(false);
    expect(nextCardTriggerReached(1_380_000, RUNTIME, segments, next())).toBe(false);
    expect(nextCardTriggerReached(1_382_000, RUNTIME, segments, next())).toBe(false);
    // Elle reste ouverte partout ailleurs dans le générique.
    expect(nextCardTriggerReached(1_378_999, RUNTIME, segments, next())).toBe(true);
  });

  it("un SECOND générique après la scène rouvre la fiche — la donnée la plus sûre", () => {
    const segments = [outro(1_200_000, 1_380_000, true), outro(1_410_000, RUNTIME)];
    expect(nextCardTriggerReached(1_390_000, RUNTIME, segments, next())).toBe(false);
    expect(nextCardTriggerReached(1_410_000, RUNTIME, segments, next())).toBe(true);
  });
});

describe("nextEpisodeReachable — l'accès, qui ne disparaît plus", () => {
  it("du début du générique jusqu'au bout, scène post-générique comprise", () => {
    const segments = [outro(1_200_000, 1_380_000, true)];
    expect(nextEpisodeReachable(1_199_000, RUNTIME, segments, next())).toBe(false);
    expect(nextEpisodeReachable(1_200_000, RUNTIME, segments, next())).toBe(true);
    // C'est LE cas du défaut : la fiche s'est retirée, l'accès reste.
    expect(nextEpisodeReachable(1_390_000, RUNTIME, segments, next())).toBe(true);
    expect(nextEpisodeReachable(RUNTIME - 1, RUNTIME, segments, next())).toBe(true);
  });

  it("sans générique, il suit le seuil de la bibliothèque", () => {
    expect(nextEpisodeReachable(RUNTIME - 40_000, RUNTIME, [], next())).toBe(false);
    expect(nextEpisodeReachable(RUNTIME - 10_000, RUNTIME, [], next())).toBe(true);
  });
});

/**
 * LE DÉFAUT VÉCU : au générique, ne pas sauter mais CROISER la pilule faisait
 * paraître la carte « à suivre », puis emportait vers l'épisode suivant dix
 * secondes plus tard, sans un geste. La croix veut dire l'exact contraire.
 */
describe("autoNextEligible — les deux refus ferment la fenêtre", () => {
  const SCENE = [outro(1_200_000, 1_380_000, true)];
  const base = {
    segments: SCENE,
    positionMs: 1_250_000,
    runtimeMs: RUNTIME,
    hasStarted: true,
    isEpisode: true,
    hasNextEpisode: true,
    settings: DEFAULTS,
  };

  it("sans refus, le générique rend l'enchaînement éligible", () => {
    expect(autoNextEligible(base)).toBe(true);
  });

  it("LE DÉFAUT — le générique REFUSÉ ne peut plus armer l'enchaînement", () => {
    const muted = new Set<SegmentType>(["Outro"]);
    expect(autoNextEligible({ ...base, mutedSegments: muted })).toBe(false);
  });

  it("la scène post-générique revendiquée le ferme aussi", () => {
    expect(autoNextEligible({ ...base, postCreditsClaimed: true })).toBe(false);
  });

  it("un refus qui ne porte PAS sur le passage en cours ne change rien", () => {
    const muted = new Set<SegmentType>(["Intro"]);
    expect(autoNextEligible({ ...base, mutedSegments: muted })).toBe(true);
  });

  it("le refus ne survit pas à son passage : la fenêtre rouvre au générique final", () => {
    const muted = new Set<SegmentType>(["Outro"]);
    const withFinal = [outro(1_200_000, 1_380_000, true), outro(1_410_000, RUNTIME)];
    // Position dans le générique FINAL : plus aucun candidat de saut, donc plus
    // rien à refuser — la suite peut de nouveau se proposer.
    expect(
      autoNextEligible({ ...base, segments: withFinal, positionMs: 1_415_000, mutedSegments: muted }),
    ).toBe(true);
  });
});
