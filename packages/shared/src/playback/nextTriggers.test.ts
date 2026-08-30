import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBACK_SETTINGS, type NextEpisodeSettings } from "./playbackSettings";
import type { ResolvedSegment } from "./segmentTypes";
import { autoNextEligible, nextCardTriggerReached, nextEpisodeReachable } from "./nextTriggers";
import { DEFAULT_PLAYBACK_SETTINGS as DEFAULTS } from "./playbackSettings";

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
 * LES DÉFAUTS VÉCUS, dans l'ordre : croiser la pilule faisait paraître la carte
 * « à suivre » puis emportait vers l'épisode suivant dix secondes plus tard ;
 * puis le bouton « aller à la scène post-générique » AFFICHÉ (mode bouton, sans
 * décompte) laissait le minuteur s'armer DESSOUS — l'épisode partait à dix
 * secondes, sans un geste ni une surface. La porte est désormais structurelle :
 * tout candidat de saut ferme la fenêtre, qu'il soit affiché ou en sourdine
 * (la croix ne supprime pas le candidat).
 */
describe("autoNextEligible — un candidat de saut ou un refus ferme la fenêtre", () => {
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

  it("LE FANTÔME — un candidat de saut affiché ferme la fenêtre, rien ne s'arme sous un bouton", () => {
    // « Aller à la scène post-générique » est à l'écran (mode bouton par
    // défaut) : la carte n'a aucune surface, le minuteur ne doit pas en avoir.
    expect(autoNextEligible(base)).toBe(false);
  });

  it("le réglage « off » ne fabrique aucun candidat : la fenêtre reste ouverte", () => {
    const settings = { ...DEFAULTS, outro: { ...DEFAULTS.outro, action: "off" as const } };
    expect(autoNextEligible({ ...base, settings })).toBe(true);
  });

  it("un générique normal n'a pas de candidat — la carte parle, la fenêtre est ouverte", () => {
    expect(autoNextEligible({ ...base, segments: [outro(1_200_000, RUNTIME)] })).toBe(true);
  });

  it("au générique final, plus de candidat : la fenêtre rouvre", () => {
    const withFinal = [outro(1_200_000, 1_380_000, true), outro(1_410_000, RUNTIME)];
    expect(autoNextEligible({ ...base, segments: withFinal, positionMs: 1_415_000 })).toBe(true);
  });

  it("la scène revendiquée ferme la fenêtre AU-DELÀ du candidat — générique final compris", () => {
    const withFinal = [outro(1_200_000, 1_380_000, true), outro(1_410_000, RUNTIME)];
    expect(
      autoNextEligible({ ...base, segments: withFinal, positionMs: 1_415_000, postCreditsClaimed: true }),
    ).toBe(false);
  });

  it("un candidat Aperçu près de la fin ferme aussi la fenêtre", () => {
    // Aperçu de l'épisode suivant collé à la fin (cas anime) : le seuil global
    // « avant la fin » est franchi, mais le bouton occupe la surface.
    const preview: ResolvedSegment = {
      type: "Preview",
      startMs: RUNTIME - 30_000,
      endMs: RUNTIME,
      source: "jellyfin",
      endsAtMediaEnd: true,
      hasContentAfter: false,
    };
    expect(autoNextEligible({ ...base, segments: [preview], positionMs: RUNTIME - 20_000 })).toBe(false);
    expect(autoNextEligible({ ...base, segments: [], positionMs: RUNTIME - 20_000 })).toBe(true);
  });
});
