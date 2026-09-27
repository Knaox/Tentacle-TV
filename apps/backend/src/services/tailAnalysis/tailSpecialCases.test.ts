/**
 * Les cas spéciaux du banc du 28 septembre 2026 (267 titres) : le générique
 * illustré qui précède une scène mi-générique, le chapitre nommé qui le dément,
 * l'aperçu du prochain épisode — et ce qui lui ressemble sans l'être.
 */

import { describe, expect, it } from "vitest";
import { isCreditsChapterName } from "../../playback/segmentChapters";
import { readTail } from "./tailReading";
import { Timeline, type TailInput } from "./tailTimeline";

type Strip = Array<[string, number]>;

const strip = (parts: Strip, stepS: number): string =>
  parts.map(([letter, seconds]) => letter.repeat(seconds / stepS)).join("");

interface Media {
  runtimeS: number;
  picture: Strip;
  audio?: { fromS: number; parts: Strip };
  providers?: Array<[number, number, boolean?]>;
  episode?: boolean;
  /** Les mesures des cases, lettre par lettre : `f` fond clair uni, `k` noir, `n` image ordinaire. */
  looks?: Strip;
}

const LOOKS: Record<string, { dark: number; modal: number }> = {
  f: { dark: 0.01, modal: 0.8 },
  k: { dark: 1, modal: 1 },
  n: { dark: 0.2, modal: 0.2 },
};

const input = (media: Media): TailInput => ({
  runtimeMs: media.runtimeS * 1000,
  intervalMs: 10_000,
  cellsFromMs: (media.runtimeS / 2) * 1000,
  cells: strip(media.picture, 10),
  audio: media.audio ? { fromMs: media.audio.fromS * 1000, classes: strip(media.audio.parts, 1) } : null,
  providerSpans: (media.providers ?? []).map(([a, b, named]) => ({ startMs: a * 1000, endMs: b * 1000, ...(named ? { named } : {}) })),
  ...(media.episode ? { episode: true } : {}),
  ...(media.looks ? { measures: [...strip(media.looks, 10)].map((l) => LOOKS[l]) } : {}),
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

  it("une voix dans la chanson du générique ne le coupe pas (« Homecoming », « Captain Marvel »)", () => {
    const reading = readTail(input({
      ...illustrated(),
      audio: { fromS: 6400, parts: [["S", 980], ["M", 90], ["S", 6], ["M", 24], ["S", 50], ["M", 400], ["Q", 50]] },
    }));
    expect(reading?.creditsStartMs).toBe(7_380_000);
    expect(reading?.scenes).toHaveLength(1);
  });

  it("une fois la minute atteinte, la vignette parlée arrête le bloc : la fin musicale reste au film (« Super Mario Galaxy »)", () => {
    const reading = readTail(input({
      ...illustrated(),
      audio: { fromS: 6400, parts: [["S", 900], ["M", 80], ["S", 6], ["M", 114], ["S", 50], ["M", 400], ["Q", 50]] },
    }));
    expect(reading?.creditsStartMs).toBe(7_390_000);
  });

  it("le nom de chapitre « End Titles » est un générique de fin, « Opening Credits » non", () => {
    expect(isCreditsChapterName("End Titles")).toBe(true);
    expect(isCreditsChapterName("End Credits")).toBe(true);
    expect(isCreditsChapterName("Générique de fin")).toBe(true);
    expect(isCreditsChapterName("Opening Credits")).toBe(false);
    expect(isCreditsChapterName("Without Incident")).toBe(false);
  });
});

/** Un épisode d'animé : l'histoire, l'ending chanté, puis la voix de l'aperçu jusqu'au bout. */
const anime = (endingAudio: Strip): Media => ({
  runtimeS: 1440,
  picture: [["E", 720]],
  audio: { fromS: 1100, parts: [["S", 220], ...endingAudio, ["S", 30]] },
  providers: [[1320, 1410]],
  episode: true,
});

describe("l'aperçu du prochain épisode", () => {
  it("la voix qui suit l'ending n'est pas une scène (One Piece, « Bleach », « Fullmetal Alchemist »)", () => {
    const reading = readTail(input(anime([["M", 90]])));
    expect(reading?.creditsStartMs).toBe(1_320_000);
    expect(reading?.scenes).toEqual([]);
    expect(reading?.preview).toEqual([1_410_000, 1_440_000]);
  });

  it("quelques syllabes chantées dans l'ending n'y changent rien (« L'attaque des Titans » S4E20)", () => {
    const reading = readTail(input(anime([["M", 40], ["S", 5], ["M", 45]])));
    expect(reading?.preview).toEqual([1_410_000, 1_440_000]);
    expect(reading?.scenes).toEqual([]);
  });

  it("la voix chantée de la seconde moitié de l'ending, soudée à l'aperçu, n'est pas une scène (One Piece S23E10)", () => {
    const reading = readTail(input(anime([["M", 45], ["S", 45]])));
    expect(reading?.scenes).toEqual([]);
    expect(reading?.preview).toEqual([1_410_000, 1_440_000]);
  });

  it("sur un film, la même fin est une scène : il n'y a pas d'aperçu", () => {
    expect(readTail(input({ ...anime([["M", 90]]), episode: false }))?.preview).toBeUndefined();
  });

  it("des cartons sur noir, un gag coupé par un interlude musical : une scène, pas un aperçu (« Rick et Morty » S1E10)", () => {
    const reading = readTail(input({
      runtimeS: 1300,
      picture: [["E", 560], ["C", 10], ["T", 20], ["E", 20], ["D", 10], ["E", 30]],
      audio: { fromS: 1000, parts: [["S", 210], ["M", 30], ["S", 20], ["M", 10], ["S", 30]] },
      episode: true,
    }));
    expect(reading?.creditsStartMs).toBe(1_210_000);
    expect(reading?.preview).toBeUndefined();
    expect(reading?.scenes).toHaveLength(1);
    expect(reading?.scenes[0].endMs).toBe(1_300_000);
  });
});

describe("la dernière image connue", () => {
  it("des sous-titres plus longs que la vidéo allongent le fichier : la fin est celle de l'image", () => {
    const t = new Timeline(input({ runtimeS: 3240, picture: [["E", 1500], ["K", 20]] }));
    expect(t.knownEndMs).toBe(3_140_000);
    expect(new Timeline(input({ runtimeS: 3240, picture: [["E", 1620]] })).knownEndMs).toBe(3_240_000);
  });
});

/** Un film qui finit sur son défilement (5600-6000 s), puis `tail` jusqu'au bout — cases alignées sur la seconde 3000. */
const ending = (tail: { picture: Strip; audio: Strip; looks: Strip }): TailInput => {
  const tailS = tail.picture.reduce((n, [, sec]) => n + sec, 0);
  return {
    runtimeMs: (6000 + tailS) * 1000,
    intervalMs: 10_000,
    cellsFromMs: 3_000_000,
    cells: strip([["E", 2600], ["T", 400], ...tail.picture], 10),
    audio: { fromMs: 5_000_000, classes: strip([["S", 600], ["M", 400], ...tail.audio], 1) },
    providerSpans: [],
    measures: [...strip([["n", 3000], ...tail.looks], 10)].map((l) => LOOKS[l]),
  };
};

describe("les logos de fin", () => {
  it("le château Disney puis la lampe Pixar sur son fond clair, en bruitages : pas une scène (« Toy Story »)", () => {
    const reading = readTail(ending({
      picture: [["E", 20], ["K", 10]],
      audio: [["Q", 10], ["S", 7], ["Q", 13]],
      looks: [["n", 10], ["f", 10], ["k", 10]],
    }));
    expect(reading?.scenes).toEqual([]);
  });

  it("quarante secondes de gag sur le logo, puis un fondu au noir : toujours un logo (« WALL·E »)", () => {
    const reading = readTail(ending({
      picture: [["E", 40], ["K", 10]],
      audio: [["Q", 8], ["S", 40], ["Q", 2]],
      looks: [["n", 10], ["f", 30], ["k", 10]],
    }));
    expect(reading?.scenes).toEqual([]);
  });

  it("le château Disney du centenaire (40 s en musique) puis la lampe Pixar : un logo (« Toy Story 5 »)", () => {
    const reading = readTail(ending({
      picture: [["E", 40], ["U", 10], ["K", 10]],
      audio: [["M", 40], ["S", 8], ["Q", 12]],
      looks: [["n", 40], ["f", 10], ["k", 10]],
    }));
    expect(reading?.scenes).toEqual([]);
  });

  it("un gag dialogué suivi du carton clair de la chaîne reste une scène (« Rick et Morty » S2E6)", () => {
    const reading = readTail(ending({
      picture: [["E", 20], ["U", 10]],
      audio: [["Q", 8], ["S", 19], ["Q", 3]],
      looks: [["n", 20], ["f", 10]],
    }));
    expect(reading?.scenes).toHaveLength(1);
  });

  it("une longue scène parlée qui finit sur un fond clair reste une scène (« Brave New World »)", () => {
    const reading = readTail(ending({
      picture: [["E", 50], ["K", 10]],
      audio: [["S", 45], ["Q", 15]],
      looks: [["n", 40], ["f", 10], ["k", 10]],
    }));
    expect(reading?.scenes).toHaveLength(1);
  });
});

describe("le marqueur du fournisseur posé dans le film", () => {
  /** Un film : marqueur à 5400 s dans la dernière scène (une minute de dialogue), défilement à 5600 s. */
  const film = (after: Strip, providerEnd = 6000): Media => ({
    runtimeS: 6000,
    picture: [["E", 2600], ["T", 400]],
    audio: { fromS: 5000, parts: [["S", 600], ...after] },
    providers: [[5400, providerEnd]],
  });

  it("le générique commence bien après lui : le verdict le démentira (« Baby Driver »)", () => {
    const reading = readTail(input(film([["M", 400]])));
    expect(reading?.creditsStartMs).toBe(5_600_000);
    expect(reading?.overrides).toBe(true);
  });

  it("s'il promet derrière lui une réplique suivie, on le garde (« La Nonne 2 » : le générique sonorisé, puis les Warren)", () => {
    const music = readTail(input({ ...film([["M", 400]], 5510), audio: { fromS: 5000, parts: [["S", 500], ["M", 500]] } }));
    expect(music?.overrides).toBe(true);
    const promised = readTail(input(film([["M", 400]], 5560)));
    expect(promised?.overrides).toBeUndefined();
  });
});

describe("One Piece sans ending : l'histoire, « To be continued », l'aperçu", () => {
  it("un marqueur né dans l'histoire et fini au carton : le générique commence au carton, l'aperçu n'est pas une scène", () => {
    const reading = readTail(input({
      runtimeS: 1400,
      picture: [["E", 700]],
      audio: { fromS: 1000, parts: [["S", 400]] },
      providers: [[1082, 1357]],
      episode: true,
    }));
    expect(reading?.creditsStartMs).toBe(1_357_000);
    expect(reading?.scenes).toEqual([]);
    expect(reading?.preview).toEqual([1_357_000, 1_400_000]);
    expect(reading?.overrides).toBe(true);
  });
});
