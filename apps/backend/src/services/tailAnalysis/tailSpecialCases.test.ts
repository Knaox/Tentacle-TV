/**
 * Les cas spéciaux du banc du 28 septembre 2026 (267 titres) : le générique
 * illustré qui précède une scène mi-générique, et le chapitre nommé qui le dément.
 */

import { describe, expect, it } from "vitest";
import { isCreditsChapterName } from "../../playback/segmentChapters";
import { readTail } from "./tailReading";
import type { TailInput } from "./tailTimeline";

type Strip = Array<[string, number]>;

const strip = (parts: Strip, stepS: number): string =>
  parts.map(([letter, seconds]) => letter.repeat(seconds / stepS)).join("");

interface Media {
  runtimeS: number;
  picture: Strip;
  audio?: { fromS: number; parts: Strip };
  providers?: Array<[number, number, boolean?]>;
}

const input = (media: Media): TailInput => ({
  runtimeMs: media.runtimeS * 1000,
  intervalMs: 10_000,
  cellsFromMs: (media.runtimeS / 2) * 1000,
  cells: strip(media.picture, 10),
  audio: media.audio ? { fromMs: media.audio.fromS * 1000, classes: strip(media.audio.parts, 1) } : null,
  providerSpans: (media.providers ?? []).map(([a, b, named]) => ({ startMs: a * 1000, endMs: b * 1000, ...(named ? { named } : {}) })),
});

const scenes = (...pairs: Array<[number, number]>) => pairs.map(([a, b]) => ({ startMs: a * 1000, endMs: b * 1000 }));

/** Film parlé, générique illustré en musique, scène parlée, défilement : « Homecoming ». */
const illustrated = (providers: Media["providers"] = []): Media => ({
  runtimeS: 8000,
  picture: [["E", 3550], ["T", 400], ["K", 50]],
  audio: { fromS: 6400, parts: [["S", 980], ["M", 120], ["S", 50], ["M", 400], ["Q", 50]] },
  providers,
});

describe("le générique illustré avant une scène mi-générique", () => {
  it("la musique d'avant la scène est du générique : la scène gagne son bouton (« Homecoming »)", () => {
    const reading = readTail(input(illustrated()));
    expect(reading?.creditsStartMs).toBe(7_380_000);
    // Une vignette de musique franchie au plus : l'ouverture musicale d'une scène.
    expect(reading?.scenes).toEqual(scenes([7490, 7550]));
  });

  it("un chapitre nommé « End Titles » au défilement dément la musique : c'était la fin du film (« L'Incroyable Hulk »)", () => {
    const reading = readTail(input(illustrated([[7550, 8000, true]])));
    expect(reading?.creditsStartMs).toBe(7_550_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("sans scène parlée derrière, la musique de fin reste au film (« Interstellar »)", () => {
    const reading = readTail(input({
      runtimeS: 8000,
      picture: [["E", 3550], ["T", 400], ["K", 50]],
      audio: { fromS: 6400, parts: [["S", 980], ["M", 570], ["Q", 50]] },
    }));
    expect(reading?.creditsStartMs).toBe(7_550_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("le nom de chapitre « End Titles » est un générique de fin, « Opening Credits » non", () => {
    expect(isCreditsChapterName("End Titles")).toBe(true);
    expect(isCreditsChapterName("End Credits")).toBe(true);
    expect(isCreditsChapterName("Générique de fin")).toBe(true);
    expect(isCreditsChapterName("Opening Credits")).toBe(false);
    expect(isCreditsChapterName("Without Incident")).toBe(false);
  });
});
