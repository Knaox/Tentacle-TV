import { describe, expect, it } from "vitest";
import type { SegmentType } from "./segmentTypes";
import { segmentsRewoundInto, hasRewoundPastSkip, isSegmentSilenced, REWIND_TOLERANCE_MS } from "./skipMuting";

const muted = (...types: SegmentType[]): ReadonlySet<SegmentType> => new Set(types);

describe("isSegmentSilenced — ce que veut dire la croix", () => {
  it("un type non refusé se montre toujours, habillage ou pas", () => {
    expect(isSegmentSilenced(muted(), "Intro", false)).toBe(false);
    expect(isSegmentSilenced(muted("Outro"), "Intro", false)).toBe(false);
  });

  it("refusé : masqué sur l'image, rendu avec les contrôles", () => {
    expect(isSegmentSilenced(muted("Intro"), "Intro", false)).toBe(true);
    expect(isSegmentSilenced(muted("Intro"), "Intro", true)).toBe(false);
  });

  it("sans habillage connu, le refus masque complètement", () => {
    expect(isSegmentSilenced(muted("Intro"), "Intro", undefined)).toBe(true);
  });

  it("le refus porte sur le TYPE, donc sur toute la lecture — pas sur un passage", () => {
    // Deux traversées de l'intro dans le même épisode : la seconde est muette aussi.
    const refus = muted("Intro");
    expect(isSegmentSilenced(refus, "Intro", false)).toBe(true);
    expect(isSegmentSilenced(refus, "Intro", false)).toBe(true);
  });
});

describe("hasRewoundPastSkip — revenir dans un passage qu'on vient de sauter", () => {
  it("aucun saut en cours : rien à réarmer", () => {
    expect(hasRewoundPastSkip(10_000, null)).toBe(false);
  });

  it("la position rattrape la cible : on attend, la pilule reste muette", () => {
    expect(hasRewoundPastSkip(89_000, 90_000)).toBe(false);
    expect(hasRewoundPastSkip(95_000, 90_000)).toBe(false);
  });

  it("retour franc en arrière : le bouton se réaffiche", () => {
    expect(hasRewoundPastSkip(90_000 - REWIND_TOLERANCE_MS - 1, 90_000)).toBe(true);
    expect(hasRewoundPastSkip(30_000, 90_000)).toBe(true);
  });
});

/**
 * Signalé à l'usage : après avoir croisé un bouton, revenir en arrière ne
 * redonnait pas la croix. Rejouer un passage, c'est le redemander.
 */
describe("segmentsRewoundInto — le retour en arrière lève la sourdine", () => {
  const refusals = new Map<SegmentType, number>([["Intro", 40_000], ["Outro", 1_250_000]]);

  it("rester devant les deux refus ne lève rien", () => {
    expect(segmentsRewoundInto(refusals, 1_300_000)).toEqual([]);
  });

  it("revenir derrière le refus du générique lève celui-là, et lui seul", () => {
    // 20 min : on est repassé avant le refus de l'outro, mais bien après celui
    // de l'intro — qu'il n'y a donc aucune raison de relever.
    expect(segmentsRewoundInto(refusals, 1_200_000)).toEqual(["Outro"]);
  });

  it("revenir au tout début les lève tous", () => {
    expect([...segmentsRewoundInto(refusals, 0)].sort()).toEqual(["Intro", "Outro"]);
  });

  it("la tolérance d'une seconde tient : un échantillon un peu court ne lève rien", () => {
    const intro = new Map<SegmentType, number>([["Intro", 40_000]]);
    expect(segmentsRewoundInto(intro, 39_500)).toEqual([]);
    expect(segmentsRewoundInto(intro, 38_500)).toEqual(["Intro"]);
  });

  it("aucun refus : rien à faire", () => {
    expect(segmentsRewoundInto(new Map(), 0)).toEqual([]);
  });
});
