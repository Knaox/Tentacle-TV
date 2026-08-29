import { describe, expect, it } from "vitest";
import type { SegmentType } from "./segmentTypes";
import { hasRewoundPastSkip, isSegmentSilenced, REWIND_TOLERANCE_MS } from "./skipMuting";

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
