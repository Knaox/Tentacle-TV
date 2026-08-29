import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBACK_SETTINGS, type NextEpisodeSettings } from "./playbackSettings";
import type { ResolvedSegment } from "./segmentTypes";
import { nextCardTriggerReached, nextEpisodeReachable } from "./nextTriggers";

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
