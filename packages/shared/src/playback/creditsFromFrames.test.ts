/**
 * Les séries de ce fichier ne sont pas inventées : elles reproduisent les
 * mesures prises le 29.08 sur une instance 10.11.8, film par film. Ce qui se
 * vérifie ici, ce sont les trois pièges qui feraient rater la scène — l'image
 * colorée isolée dans un générique, l'image claire (du texte blanc), et l'image
 * NOIRE au milieu d'une scène.
 */

import { describe, expect, it } from "vitest";
import { applyFrameVerdict, creditsFromFrames, type FrameSample } from "./creditsFromFrames";
import type { BoundsByType } from "./segmentChapters";

const STEP_MS = 10_000;

/** Fabrique une suite de vignettes à partir de tranches décrites en minutes. */
function series(
  slices: ReadonlyArray<{ fromMin: number; toMin: number; dark: number; saturation: number }>,
): FrameSample[] {
  const out: FrameSample[] = [];
  // Les bornes sont ramenées sur la grille des vignettes : une planche ne porte
  // pas d'image à 119,67 minutes, elle en porte une à 119:40.
  const grid = (minutes: number): number => Math.round((minutes * 60_000) / STEP_MS) * STEP_MS;
  for (const slice of slices) {
    for (let ms = grid(slice.fromMin); ms < grid(slice.toMin); ms += STEP_MS) {
      out.push({ ms, dark: slice.dark, saturation: slice.saturation });
    }
  }
  return out;
}

/** Remplace une vignette précise — le piège isolé. */
function poke(samples: FrameSample[], atMs: number, patch: Partial<FrameSample>): FrameSample[] {
  return samples.map((s) => (s.ms === atMs ? { ...s, ...patch } : s));
}

const NO_WAY_HOME_MS = 148.2 * 60_000;

/** Le film, tel qu'il a été mesuré : scène, générique, scène, queue noire. */
function noWayHome(): FrameSample[] {
  return series([
    { fromMin: 89, toMin: 138.67, dark: 0.4, saturation: 30 },
    { fromMin: 138.67, toMin: 146, dark: 0.9, saturation: 0.1 },
    { fromMin: 146, toMin: 148, dark: 0.2, saturation: 40 },
    { fromMin: 148, toMin: 148.2, dark: 1, saturation: 0 },
  ]);
}

describe("le générique lu dans les vignettes", () => {
  it("trouve le générique ET la scène là où Jellyfin ne voit rien", () => {
    const verdict = creditsFromFrames(noWayHome(), NO_WAY_HOME_MS);
    expect(verdict).not.toBeNull();
    expect(verdict?.outro.startMs).toBe(138 * 60_000 + 40_000);
    expect(verdict?.outro.endMs).toBe(146 * 60_000);
    expect(verdict?.sceneAfter).toBe(true);
    expect(verdict?.outro.source).toBe("frames");
  });

  it("ne se laisse pas couper par deux images claires DANS le générique", () => {
    // Mesuré : 142:20 et 142:30 portent du texte blanc (noir 61 % et 71 %).
    let samples = noWayHome();
    samples = poke(samples, 142 * 60_000 + 20_000, { dark: 0.61 });
    samples = poke(samples, 142 * 60_000 + 30_000, { dark: 0.71 });
    const verdict = creditsFromFrames(samples, NO_WAY_HOME_MS);
    expect(verdict?.outro.endMs).toBe(146 * 60_000);
  });

  it("ne se laisse pas couper par une image noire DANS la scène", () => {
    // Mesuré : 146:40, une coupe au milieu de la scène post-générique.
    const samples = poke(noWayHome(), 146 * 60_000 + 40_000, { dark: 1, saturation: 0 });
    const verdict = creditsFromFrames(samples, NO_WAY_HOME_MS);
    expect(verdict?.outro.endMs).toBe(146 * 60_000);
    expect(verdict?.sceneAfter).toBe(true);
  });

  it("ne prend pas la queue noire du fichier pour un générique", () => {
    // Sans scène après lui, le générique va jusqu'au bout — et pas jusqu'à la
    // queue noire, qui n'est pas un passage à elle seule.
    const samples = series([
      { fromMin: 89, toMin: 119.67, dark: 0.4, saturation: 30 },
      { fromMin: 119.67, toMin: 127.9, dark: 0.9, saturation: 2 },
    ]);
    const verdict = creditsFromFrames(samples, 127.9 * 60_000);
    expect(verdict?.sceneAfter).toBe(false);
    expect(verdict?.outro.endMs).toBe(127.9 * 60_000);
  });

  it("tient malgré un générique ILLUSTRÉ (deux images colorées isolées)", () => {
    // « Deadpool & Wolverine » : 121:20 et 122:10 sont en couleur.
    let samples = series([
      { fromMin: 110, toMin: 119.67, dark: 0.5, saturation: 12 },
      { fromMin: 119.67, toMin: 126.83, dark: 0.85, saturation: 1 },
      { fromMin: 126.83, toMin: 127.83, dark: 0.3, saturation: 28 },
    ]);
    samples = poke(samples, 121 * 60_000 + 20_000, { dark: 0.69, saturation: 7.1 });
    samples = poke(samples, 122 * 60_000 + 10_000, { dark: 0.75, saturation: 18.4 });
    const verdict = creditsFromFrames(samples, 127.9 * 60_000);
    expect(verdict?.outro.startMs).toBe(119 * 60_000 + 40_000);
    expect(verdict?.sceneAfter).toBe(true);
  });

  it("ne dit RIEN quand rien n'est sûr", () => {
    expect(creditsFromFrames([], 100_000)).toBeNull();
    expect(creditsFromFrames(noWayHome(), 0)).toBeNull();
    // Un film qui n'est que scène : aucun générique à fabriquer.
    const noCredits = series([{ fromMin: 60, toMin: 120, dark: 0.2, saturation: 40 }]);
    expect(creditsFromFrames(noCredits, 120 * 60_000)).toBeNull();
  });

  it("ne prend pas un passage sombre de la PREMIÈRE moitié pour un générique", () => {
    const nightScene = series([
      { fromMin: 0, toMin: 20, dark: 0.95, saturation: 1 },
      { fromMin: 20, toMin: 100, dark: 0.3, saturation: 35 },
    ]);
    expect(creditsFromFrames(nightScene, 100 * 60_000)).toBeNull();
  });
});

describe("ce que le verdict a le droit de changer", () => {
  const verdict = {
    outro: { startMs: 8_320_000, endMs: 8_760_000, source: "frames" as const },
    sceneAfter: true,
  };
  const runtime = 8_892_000;

  it("fournit le générique quand personne ne l'a vu", () => {
    const bounds: BoundsByType = new Map();
    applyFrameVerdict(bounds, verdict, runtime);
    expect(bounds.get("Outro")).toEqual([verdict.outro]);
  });

  it("ne touche PAS un générique qui ne finit pas à la fin du fichier", () => {
    // « Deadpool » 2016 : les chapitres nommés ont donné la bonne réponse.
    const kept = { startMs: 6_058_000, endMs: 6_418_000, source: "chapters" as const };
    const bounds: BoundsByType = new Map([["Outro", [kept]]]);
    applyFrameVerdict(bounds, verdict, runtime);
    expect(bounds.get("Outro")).toEqual([kept]);
  });

  it("n'affine QUE la fin d'un générique qui court jusqu'au bout", () => {
    const bounds: BoundsByType = new Map([
      ["Outro", [{ startMs: 7_189_000, endMs: runtime, source: "jellyfin" as const }]],
    ]);
    applyFrameVerdict(bounds, verdict, runtime);
    // Le DÉBUT reste celui du fournisseur : il l'a mesuré sur la vidéo.
    expect(bounds.get("Outro")).toEqual([
      { startMs: 7_189_000, endMs: 8_760_000, source: "jellyfin" },
    ]);
  });

  it("ne raccourcit rien quand il n'a pas vu de scène", () => {
    const outro = { startMs: 7_189_000, endMs: runtime, source: "jellyfin" as const };
    const bounds: BoundsByType = new Map([["Outro", [{ ...outro }]]]);
    applyFrameVerdict(bounds, { ...verdict, sceneAfter: false }, runtime);
    expect(bounds.get("Outro")).toEqual([outro]);
  });

  it("ne touche à rien sans verdict", () => {
    const bounds: BoundsByType = new Map();
    applyFrameVerdict(bounds, null, runtime);
    expect(bounds.size).toBe(0);
  });
});
