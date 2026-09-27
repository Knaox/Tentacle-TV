/**
 * La lecture de bout en bout, sur des frises fabriquées d'après les cas du
 * banc (`docs/SEGMENTS-LABO-FIN.md`) : chacune porte le piège qu'une règle a
 * été posée pour déjouer.
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
  /** Le son depuis `audioFromS`, en secondes par lettre ; absent = pas d'audio. */
  audio?: { fromS: number; parts: Strip };
  providers?: Array<[number, number]>;
}

const input = (film: Film): TailInput => ({
  runtimeMs: film.runtimeS * 1000,
  intervalMs: 10_000,
  cellsFromMs: (film.runtimeS / 2) * 1000,
  cells: strip(film.picture, 10),
  audio: film.audio ? { fromMs: film.audio.fromS * 1000, classes: strip(film.audio.parts, 1) } : null,
  providerSpans: (film.providers ?? []).map(([a, b]) => ({ startMs: a * 1000, endMs: b * 1000 })),
});

const scenes = (...pairs: Array<[number, number]>) => pairs.map(([a, b]) => ({ startMs: a * 1000, endMs: b * 1000 }));

describe("readTail", () => {
  it("deux scènes : la mi-générique parlée, puis la post-générique après le défilement (« Avengers »)", () => {
    const reading = readTail(input({
      runtimeS: 8000,
      picture: [["E", 3000], ["C", 120], ["E", 120], ["T", 560], ["E", 100], ["K", 100]],
      audio: { fromS: 6400, parts: [["S", 600], ["M", 120], ["S", 120], ["M", 560], ["S", 100], ["Q", 100]] },
    }));
    expect(reading).toEqual({
      creditsStartMs: 7_000_000,
      scenes: scenes([7120, 7240], [7800, 7900]),
      crawl: [7_000_000, 7_800_000],
      audio: true,
    });
  });

  it("un logo en musique collé au bout n'est pas une scène (château Disney, lampe Pixar)", () => {
    const reading = readTail(input({
      runtimeS: 6000,
      picture: [["E", 2400], ["T", 500], ["K", 60], ["E", 30], ["K", 10]],
      audio: { fromS: 4800, parts: [["S", 600], ["M", 500], ["Q", 60], ["M", 30], ["Q", 10]] },
    }));
    expect(reading?.creditsStartMs).toBe(5_400_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("sans audio, une image courte près du bout ne compte pas ; une longue, loin du bout, si", () => {
    const logo = readTail(input({ runtimeS: 6000, picture: [["E", 2400], ["T", 500], ["K", 60], ["E", 30], ["K", 10]] }));
    expect(logo?.scenes).toEqual([]);
    expect(logo?.audio).toBe(false);
    const scene = readTail(input({ runtimeS: 6000, picture: [["E", 2400], ["T", 400], ["E", 100], ["K", 100]] }));
    expect(scene?.scenes).toEqual(scenes([5800, 5900]));
  });

  it("un marqueur de fournisseur posé dans la fin du film est écarté (« Deadpool », le baiser final)", () => {
    const reading = readTail(input({
      runtimeS: 6000,
      picture: [["E", 2500], ["U", 60], ["T", 400], ["K", 40]],
      audio: { fromS: 4800, parts: [["S", 700], ["M", 460], ["Q", 40]] },
      providers: [[5390, 6000]],
    }));
    expect(reading?.creditsStartMs).toBe(5_500_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("un marqueur tombé dans la dernière réplique avance jusqu'à sa fin", () => {
    const reading = readTail(input({
      runtimeS: 6000,
      picture: [["E", 2430], ["U", 70], ["T", 400], ["K", 100]],
      audio: { fromS: 4800, parts: [["S", 630], ["M", 470], ["Q", 100]] },
      providers: [[5400, 6000]],
    }));
    expect(reading?.creditsStartMs).toBe(5_430_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("les voix de l'ending d'un épisode ne sont pas une scène (« Frieren »)", () => {
    const reading = readTail(input({
      runtimeS: 1440,
      picture: [["E", 720]],
      audio: { fromS: 1200, parts: [["S", 240]] },
      providers: [[1350, 1440]],
    }));
    expect(reading).toEqual({ creditsStartMs: 1_350_000, scenes: [], crawl: null, audio: true });
  });

  it("après des cartons sur noir, la parole est une scène (« Rick et Morty »)", () => {
    const reading = readTail(input({
      runtimeS: 1320,
      picture: [["E", 570], ["C", 30], ["E", 60]],
      audio: { fromS: 1100, parts: [["S", 130], ["M", 30], ["S", 60]] },
      providers: [[1230, 1320]],
    }));
    expect(reading?.creditsStartMs).toBe(1_230_000);
    expect(reading?.scenes).toEqual(scenes([1260, 1320]));
  });

  it("une plage d'image entre les cartons et le défilement : parlée, une scène ; en musique, un montage", () => {
    const film = (middle: string): Film => ({
      runtimeS: 3300,
      picture: [["E", 1350], ["C", 30], ["D", 90], ["T", 130], ["K", 50]],
      audio: { fromS: 2700, parts: [["S", 300], ["M", 30], [middle, 90], ["M", 180]] },
      providers: [[3000, 3300]],
    });
    const spoken = readTail(input(film("S")));
    expect(spoken?.creditsStartMs).toBe(3_000_000);
    expect(spoken?.scenes).toEqual(scenes([3030, 3120]));
    // « Les Gardiens de la Galaxie 3 », 145:40 : des photos entre deux pans du défilement.
    expect(readTail(input(film("M")))?.scenes).toEqual([]);
  });

  it("court et sombre après le défilement : une scène si l'on y parle (« Harry Potter 2 »), un carton sinon", () => {
    const film = (sound: string): Film => ({
      runtimeS: 6000,
      picture: [["E", 2400], ["T", 560], ["D", 10], ["E", 10], ["K", 20]],
      audio: { fromS: 4800, parts: [["S", 600], ["M", 560], ["Q", 3], [sound, 7], ["Q", 30]] },
    });
    expect(readTail(input(film("S")))?.scenes).toEqual(scenes([5960, 5980]));
    expect(readTail(input(film("Q")))?.scenes).toEqual([]);
  });

  it("muet et court : un logo s'il court jusqu'au dernier instant (« Zootopie 2 »), une scène s'il finit sur un carton (« Ted 2 »)", () => {
    const logo = readTail(input({
      runtimeS: 6000,
      picture: [["E", 2400], ["T", 540], ["K", 40], ["E", 20]],
      audio: { fromS: 4800, parts: [["S", 600], ["M", 540], ["Q", 60]] },
    }));
    expect(logo?.scenes).toEqual([]);
    const scene = readTail(input({
      runtimeS: 6000,
      picture: [["E", 2400], ["T", 560], ["E", 20], ["T", 10], ["K", 10]],
      audio: { fromS: 4800, parts: [["S", 600], ["M", 560], ["Q", 40]] },
    }));
    expect(scene?.scenes).toEqual(scenes([5960, 5980]));
  });

  it("une scène qui sort du noir commence avec sa parole (l'œuf de Yoshi, « Super Mario Bros »)", () => {
    const reading = readTail(input({
      runtimeS: 5560,
      picture: [["E", 2400], ["T", 320], ["K", 20], ["D", 10], ["E", 30]],
      audio: { fromS: 4900, parts: [["S", 280], ["M", 320], ["Q", 4], ["S", 21], ["Q", 35]] },
    }));
    expect(reading?.creditsStartMs).toBe(5_180_000);
    expect(reading?.scenes).toEqual(scenes([5510, 5560]));
  });

  it("le générique remonte par-dessus une scène parlée prise entre deux crédits (« Palm Springs »)", () => {
    const reading = readTail(input({
      runtimeS: 5400,
      picture: [["E", 2100], ["C", 20], ["E", 100], ["U", 30], ["T", 330], ["K", 120]],
      audio: { fromS: 4200, parts: [["S", 600], ["M", 20], ["S", 100], ["M", 360], ["Q", 120]] },
    }));
    expect(reading?.creditsStartMs).toBe(4_800_000);
    expect(reading?.scenes).toEqual(scenes([4820, 4920]));
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

  it("le montage en musique qui clôt un épisode animé n'est pas le générique (« Rick et Morty » S1E6)", () => {
    const montage: Strip = [["L", 10], ["E", 10], ["L", 10], ["E", 10], ["L", 10], ["E", 10], ["L", 10]];
    const reading = readTail(input({
      runtimeS: 1220,
      picture: [["E", 420], ...montage, ["E", 20], ["T", 30], ["E", 60], ["U", 10]],
      audio: { fromS: 900, parts: [["S", 130], ["M", 120], ["S", 60], ["Q", 10]] },
    }));
    expect(reading?.creditsStartMs).toBe(1_120_000);
    expect(reading?.scenes).toEqual(scenes([1150, 1210]));
  });

  it("un marqueur au début d'un bloc du générique l'emporte sur un carton de l'épisode (« Jujutsu Kaisen » S1E3)", () => {
    const reading = readTail(input({
      runtimeS: 1440,
      picture: [["E", 510], ["T", 10], ["E", 10], ["T", 10], ["K", 10], ["U", 10], ["L", 80], ["E", 70], ["T", 10]],
      audio: { fromS: 1100, parts: [["S", 176], ["M", 84], ["S", 70], ["Q", 10]] },
      providers: [[1276, 1440]],
    }));
    expect(reading?.creditsStartMs).toBe(1_276_000);
    expect(reading?.scenes).toEqual(scenes([1360, 1430]));
  });

  it("une plage qui s'ouvre en musique : l'ending illustré, puis la scène (« Spy x Family » S1E7) ; qui s'ouvre en paroles, toute la scène (« Rick et Morty » S1E10)", () => {
    const film = (after: Strip): Film => ({
      runtimeS: 1460,
      picture: [["E", 590], ["T", 20], ["E", 110], ["K", 10]],
      audio: { fromS: 1200, parts: [["S", 120], ["M", 20], ...after, ["Q", 10]] },
    });
    const ending = readTail(input(film([["M", 55], ["S", 55]])))?.scenes ?? [];
    expect(ending).toHaveLength(1);
    expect(ending[0].startMs).toBeGreaterThanOrEqual(1_360_000);
    expect(ending[0].endMs).toBe(1_450_000);
    expect(readTail(input(film([["S", 15], ["M", 35], ["S", 60]])))?.scenes).toEqual(scenes([1340, 1450]));
  });

  it("dans le défilement, une chanson sur des cartons n'est pas une scène (« Joker »)", () => {
    const reading = readTail(input({
      runtimeS: 7300,
      picture: [["E", 3280], ["C", 60], ["D", 10], ["C", 290], ["K", 10]],
      audio: { fromS: 6600, parts: [["S", 330], ["M", 53], ["S", 15], ["M", 302]] },
    }));
    expect(reading?.creditsStartMs).toBe(6_930_000);
    expect(reading?.scenes).toEqual([]);
  });

  it("ni défilement ni marqueur : rien de sûr, rien à ranger", () => {
    expect(readTail(input({ runtimeS: 3000, picture: [["E", 1500]] }))).toBeNull();
  });
});
