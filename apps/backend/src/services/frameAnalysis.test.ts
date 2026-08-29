/**
 * La règle qui décide de regarder ou non les vignettes est celle qui protège
 * les médias que Jellyfin détecte bien : elle doit se taire dès qu'un générique
 * crédible ne court pas jusqu'à la fin du fichier.
 */

import { describe, expect, it } from "vitest";
import { needsFrameAnalysis } from "./frameAnalysis";
import type { PlaybackSegmentsResponse, ResolvedSegment } from "../playback/segmentTypes";

const RUNTIME = 8_892_000;

function contract(segments: ResolvedSegment[]): PlaybackSegmentsResponse {
  return {
    version: 1, itemId: "x", runtimeMs: RUNTIME, segments, libraryId: null, resolvedAt: "",
  };
}

const outro = (over: Partial<ResolvedSegment>): ResolvedSegment => ({
  type: "Outro",
  startMs: 7_000_000,
  endMs: 8_000_000,
  source: "jellyfin",
  endsAtMediaEnd: false,
  hasContentAfter: true,
  ...over,
});

describe("faut-il regarder les vignettes", () => {
  it("oui, quand aucun générique n'a été signalé", () => {
    expect(needsFrameAnalysis(contract([]))).toBe(true);
  });

  it("oui, quand le générique court jusqu'à la fin du fichier", () => {
    expect(needsFrameAnalysis(contract([outro({ endsAtMediaEnd: true })]))).toBe(true);
  });

  it("NON, quand un générique crédible s'arrête avant la fin", () => {
    // « Deadpool » 2016 : les chapitres nommés ont donné la bonne réponse.
    expect(needsFrameAnalysis(contract([outro({})]))).toBe(false);
  });

  it("NON, quand l'un des deux génériques s'arrête avant la fin", () => {
    // Le modèle Plex : générique, scène, générique final.
    const contrat = contract([outro({}), outro({ startMs: 8_500_000, endsAtMediaEnd: true })]);
    expect(needsFrameAnalysis(contrat)).toBe(false);
  });

  it("non, quand la durée du média est inconnue — on ne saurait rien conclure", () => {
    expect(needsFrameAnalysis({ ...contract([]), runtimeMs: 0 })).toBe(false);
  });

  it("ne se laisse pas décider par un autre type de passage", () => {
    const intro: ResolvedSegment = { ...outro({}), type: "Intro" };
    expect(needsFrameAnalysis(contract([intro]))).toBe(true);
  });
});
