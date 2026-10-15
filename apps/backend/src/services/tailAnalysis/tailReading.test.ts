/**
 * La lecture de bout en bout, sur des frises fabriquées d'après les cas du
 * banc (`docs/SEGMENTS-LABO-FIN.md`) : chacune porte le piège qu'une règle a
 * été posée pour déjouer. Les vignettes seules : l'analyse audio est retirée.
 */

import { describe, expect, it } from "vitest";
import { readTail } from "./tailReading";
import type { TailInput } from "./tailTimeline";

type Strip = Array<[string, number]>;

/** Une frise : des lettres tenues pendant `seconds`, une case par `stepS` secondes. */
const strip = (parts: Strip, stepS: number): string =>
  parts.map(([letter, seconds]) => letter.repeat(seconds / stepS)).join("");

interface Film {
  runtimeS: number;
  /** L'image depuis la moitié du média, en secondes par lettre. */
  picture: Strip;
  providers?: Array<[number, number]>;
}

const input = (film: Film): TailInput => ({
  runtimeMs: film.runtimeS * 1000,
  intervalMs: 10_000,
  cellsFromMs: (film.runtimeS / 2) * 1000,
  cells: strip(film.picture, 10),
  providerSpans: (film.providers ?? []).map(([a, b]) => ({ startMs: a * 1000, endMs: b * 1000 })),
});

const scenes = (...pairs: Array<[number, number]>) => pairs.map(([a, b]) => ({ startMs: a * 1000, endMs: b * 1000 }));

describe("readTail", () => {
  it("après le défilement, une plage d'image est une scène (« Avengers », le shawarma)", () => {
    const reading = readTail(input({
      runtimeS: 8000,
      picture: [["E", 3000], ["C", 120], ["E", 120], ["T", 560], ["E", 100], ["K", 100]],
    }));
    expect(reading).toEqual({
      creditsStartMs: 7_000_000,
      scenes: scenes([7800, 7900]),
      crawl: [7_000_000, 7_800_000],
      audio: false,
    });
  });

  it("une image courte près du bout ne compte pas (château Disney, lampe Pixar) ; une longue, loin du bout, si", () => {
    const logo = readTail(input({ runtimeS: 6000, picture: [["E", 2400], ["T", 500], ["K", 60], ["E", 30], ["K", 10]] }));
    expect(logo?.creditsStartMs).toBe(5_400_000);
    expect(logo?.scenes).toEqual([]);
    const scene = readTail(input({ runtimeS: 6000, picture: [["E", 2400], ["T", 400], ["E", 100], ["K", 100]] }));
    expect(scene?.scenes).toEqual(scenes([5800, 5900]));
  });

  it("muet et court jusqu'au dernier instant : un logo (« Zootopie 2 »)", () => {
    const reading = readTail(input({ runtimeS: 6000, picture: [["E", 2400], ["T", 540], ["K", 40], ["E", 20]] }));
    expect(reading?.scenes).toEqual([]);
  });

  it("le dernier marqueur de fournisseur avant le défilement donne le début du générique", () => {
    const reading = readTail(input({
      runtimeS: 6000,
      picture: [["E", 2500], ["U", 60], ["T", 400], ["K", 40]],
      providers: [[5390, 6000]],
    }));
    expect(reading?.creditsStartMs).toBe(5_390_000);
    expect(reading?.crawl).toEqual([5_560_000, 5_960_000]);
  });

  it("un marqueur sans défilement : le générique, sans scène (l'ending d'un épisode)", () => {
    const reading = readTail(input({ runtimeS: 1440, picture: [["E", 720]], providers: [[1350, 1440]] }));
    expect(reading).toEqual({ creditsStartMs: 1_350_000, scenes: [], crawl: null, audio: false });
  });

  it("le générique remonte à travers cartons et aplats jusqu'à la première image", () => {
    const reading = readTail(input({
      runtimeS: 5400,
      picture: [["E", 2100], ["C", 20], ["E", 100], ["U", 30], ["T", 330], ["K", 120]],
    }));
    expect(reading?.creditsStartMs).toBe(4_920_000);
    expect(reading?.crawl).toEqual([4_950_000, 5_280_000]);
  });

  it("une ville de nuit loin avant le défilement ne l'allonge pas (« Iron Man 2 »)", () => {
    const reading = readTail(input({
      runtimeS: 7500,
      picture: [["E", 1950], ["T", 70], ["E", 1230], ["T", 400], ["K", 100]],
    }));
    expect(reading).toEqual({ creditsStartMs: 7_000_000, scenes: [], crawl: [7_000_000, 7_400_000], audio: false });
  });

  it("le noir ne coupe pas le générique : trois minutes de noir entre les cartons et la fin (« Parasite »)", () => {
    const reading = readTail(input({ runtimeS: 5900, picture: [["E", 2450], ["C", 60], ["K", 170], ["D", 10], ["T", 20], ["K", 240]] }));
    expect(reading?.creditsStartMs).toBe(5_400_000);
    expect(reading?.crawl).toEqual([5_400_000, 5_660_000]);
  });

  it("un bloc court ne rejoint pas le défilement à travers de l'image (la ville de nuit, « The Amazing Spider-Man »)", () => {
    const reading = readTail(input({ runtimeS: 8200, picture: [["E", 3520], ["T", 30], ["D", 20], ["C", 60], ["T", 400], ["K", 70]] }));
    expect(reading?.creditsStartMs).toBe(7_670_000);
  });

  it("le montage de texte clair qui clôt un épisode animé n'est pas le générique (« Rick et Morty » S1E6)", () => {
    const montage: Strip = [["L", 10], ["E", 10], ["L", 10], ["E", 10], ["L", 10], ["E", 10], ["L", 10]];
    const reading = readTail(input({
      runtimeS: 1220,
      picture: [["E", 420], ...montage, ["E", 20], ["T", 30], ["E", 60], ["U", 10]],
    }));
    expect(reading?.creditsStartMs).toBe(1_120_000);
    expect(reading?.crawl).toEqual([1_120_000, 1_150_000]);
  });

  it("un marqueur au début d'un bloc du générique l'emporte sur un carton de l'épisode (« Jujutsu Kaisen » S1E3)", () => {
    const reading = readTail(input({
      runtimeS: 1440,
      picture: [["E", 510], ["T", 10], ["E", 10], ["T", 10], ["K", 10], ["U", 10], ["L", 80], ["E", 70], ["T", 10]],
      providers: [[1276, 1440]],
    }));
    expect(reading?.creditsStartMs).toBe(1_276_000);
    expect(reading?.scenes).toEqual(scenes([1360, 1430]));
  });

  it("dans le défilement, des cartons ne portent pas de scène (« Joker »)", () => {
    const reading = readTail(input({
      runtimeS: 7300,
      picture: [["E", 3280], ["C", 60], ["D", 10], ["C", 290], ["K", 10]],
    }));
    expect(reading?.creditsStartMs).toBe(6_930_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("ni défilement ni marqueur : rien de sûr, rien à ranger", () => {
    expect(readTail(input({ runtimeS: 3000, picture: [["E", 1500]] }))).toBeNull();
  });
});
