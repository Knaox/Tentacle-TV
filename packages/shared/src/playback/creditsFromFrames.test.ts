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
    // La première vignette de SCÈNE est à 146:00 ; la borne s'arrête une
    // vignette avant — la transition vit dans cet intervalle, et y sauter
    // arrivait jusqu'à dix secondes après le début de la scène.
    expect(verdict?.outro.endMs).toBe(146 * 60_000 - 10_000);
    expect(verdict?.sceneAfter).toBe(true);
    expect(verdict?.outro.source).toBe("frames");
  });

  it("ne se laisse pas couper par deux images claires DANS le générique", () => {
    // Mesuré : 142:20 et 142:30 portent du texte blanc (noir 61 % et 71 %).
    let samples = noWayHome();
    samples = poke(samples, 142 * 60_000 + 20_000, { dark: 0.61 });
    samples = poke(samples, 142 * 60_000 + 30_000, { dark: 0.71 });
    const verdict = creditsFromFrames(samples, NO_WAY_HOME_MS);
    expect(verdict?.outro.endMs).toBe(146 * 60_000 - 10_000);
  });

  it("ne se laisse pas couper par une image noire DANS la scène", () => {
    // Mesuré : 146:40, une coupe au milieu de la scène post-générique.
    const samples = poke(noWayHome(), 146 * 60_000 + 40_000, { dark: 1, saturation: 0 });
    const verdict = creditsFromFrames(samples, NO_WAY_HOME_MS);
    expect(verdict?.outro.endMs).toBe(146 * 60_000 - 10_000);
    expect(verdict?.sceneAfter).toBe(true);
  });

  it("recule d'un pas EXPLICITE quand l'appelant connaît l'intervalle", () => {
    // Une grille à 20 s (vieux réglage serveur) : le pas transmis fait foi,
    // la médiane des écarts n'est qu'un repli.
    const verdict = creditsFromFrames(noWayHome(), NO_WAY_HOME_MS, 20_000);
    expect(verdict?.outro.endMs).toBe(146 * 60_000 - 20_000);
  });

  it("ne recule jamais sous le début du générique (pas de grille absurde)", () => {
    const verdict = creditsFromFrames(noWayHome(), NO_WAY_HOME_MS, 10 * 60_000);
    expect(verdict?.outro.endMs).toBe(138 * 60_000 + 40_000 + 1_000);
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

  it("Brave New World : les cartes illustrées SOMBRES rejoignent le générique", () => {
    // Relevé le 30.08 : cartes rouges/bleues sur noir, saturation 8,7 → 27,2 —
    // au seuil 18 le générique n'était vu qu'à 109:50 au lieu de ~108:00. Deux
    // vignettes plus claires (108:20 et 109:10, mesurées) fragmentent la tête ;
    // le lissage rend les deux premières cartes au film — départ à 108:30,
    // c'est le prix du garde-fou.
    const runtime = 118.5 * 60_000;
    let samples = series([
      { fromMin: 100, toMin: 108, dark: 0.15, saturation: 19.4 },
      { fromMin: 108, toMin: 110.5, dark: 0.85, saturation: 15 },
      { fromMin: 110.5, toMin: 117.5, dark: 0.88, saturation: 0.2 },
      { fromMin: 117.5, toMin: 118.4, dark: 0.45, saturation: 23 },
    ]);
    samples = poke(samples, 108 * 60_000 + 20_000, { dark: 0.46, saturation: 17.7 });
    samples = poke(samples, 109 * 60_000 + 10_000, { dark: 0.62, saturation: 36.1 });
    const verdict = creditsFromFrames(samples, runtime);
    expect(verdict?.outro.startMs).toBe(108 * 60_000 + 30_000);
    expect(verdict?.outro.endMs).toBe(117.5 * 60_000 - 10_000);
    expect(verdict?.sceneAfter).toBe(true);
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

  it("Avatar : un défilement DENSE sans preuve de scène n'est pas une scène", () => {
    // Mesuré le 30.08 : le cast d'« Avatar : la voie de l'eau » défile en
    // colonnes si serrées que la part de noir tombe à 0,62-0,68 — trois
    // minutes classées « scène » en plein générique, saturation maximale 0.
    // Aucune vignette n'y ressemble à une scène : le passage rejoint
    // l'enveloppe, et rien n'est promis.
    const runtime = 192.63 * 60_000;
    const samples = series([
      { fromMin: 170, toMin: 185.5, dark: 0.2, saturation: 30 },
      { fromMin: 185.5, toMin: 188, dark: 0.9, saturation: 0.3 },
      { fromMin: 188, toMin: 191.7, dark: 0.65, saturation: 0 },
      { fromMin: 191.7, toMin: 192.6, dark: 0.9, saturation: 0.1 },
    ]);
    const verdict = creditsFromFrames(samples, runtime);
    expect(verdict?.sceneAfter).toBe(false);
    expect(verdict?.outro.endMs).toBe(runtime);
    expect(verdict?.finalCredits).toBeNull();
  });

  it("Iron Man : le stinger SOMBRE de fin de fichier est repêché", () => {
    // Mesuré le 30.08 : la scène de Nick Fury (125:10 → 126:00) est si sombre
    // que trois vignettes sur cinq passent les seuils du générique — le
    // lissage l'absorbait. La preuve (saturation 38 à 125:50) l'ancre, la
    // remontée s'arrête au dernier vrai défilement (deux noyaux d'affilée).
    const runtime = 126.01 * 60_000;
    const samples = [
      ...series([
        { fromMin: 100, toMin: 117.6, dark: 0.3, saturation: 25 },
        { fromMin: 117.6, toMin: 125.17, dark: 0.9, saturation: 0.5 },
      ]),
      { ms: 125 * 60_000 + 10_000, dark: 0.57, saturation: 7.4 },
      { ms: 125 * 60_000 + 20_000, dark: 0.77, saturation: 9.9 },
      { ms: 125 * 60_000 + 30_000, dark: 0.99, saturation: 8.9 },
      { ms: 125 * 60_000 + 40_000, dark: 1.0, saturation: 0 },
      { ms: 125 * 60_000 + 50_000, dark: 0.74, saturation: 38.4 },
    ];
    const verdict = creditsFromFrames(samples, runtime);
    expect(verdict?.sceneAfter).toBe(true);
    expect(verdict?.outro.endMs).toBe(125 * 60_000);
    expect(verdict?.finalCredits).toBeNull();
  });

  it("un logo coloré de quelques secondes en toute fin n'est pas un stinger", () => {
    // Le repêchage exige vingt secondes retrouvées : deux vignettes saturées
    // collées à la fin (un logo animé) ne suffisent pas.
    const runtime = 128 * 60_000;
    const samples = [
      ...series([
        { fromMin: 100, toMin: 119.67, dark: 0.3, saturation: 25 },
        { fromMin: 119.67, toMin: 127.8, dark: 0.9, saturation: 0.5 },
      ]),
      { ms: 127 * 60_000 + 50_000, dark: 0.2, saturation: 60 },
    ];
    const verdict = creditsFromFrames(samples, runtime);
    expect(verdict?.sceneAfter).toBe(false);
    expect(verdict?.outro.endMs).toBe(runtime);
  });

  it("ne dit RIEN quand rien n'est sûr", () => {
    expect(creditsFromFrames([], 100_000)).toBeNull();
    expect(creditsFromFrames(noWayHome(), 0)).toBeNull();
    // Un film qui n'est que scène : aucun générique à fabriquer.
    const noCredits = series([{ fromMin: 60, toMin: 120, dark: 0.2, saturation: 40 }]);
    expect(creditsFromFrames(noCredits, 120 * 60_000)).toBeNull();
  });

  it("ne prend pas une bataille NOCTURNE pour un générique", () => {
    // Le défaut du premier montage, mesuré sur « No Way Home » : 89 → 94 min,
    // noir 90 %, saturation 8 — le troisième acte, de nuit. Il passait pour le
    // générique, et le bouton proposait de sauter la fin du film.
    const samples = series([
      { fromMin: 89, toMin: 94, dark: 0.9, saturation: 8 },
      { fromMin: 94, toMin: 138.67, dark: 0.4, saturation: 30 },
      { fromMin: 138.67, toMin: 146, dark: 0.9, saturation: 0.1 },
      { fromMin: 146, toMin: 148.2, dark: 0.2, saturation: 40 },
    ]);
    const verdict = creditsFromFrames(samples, NO_WAY_HOME_MS);
    expect(verdict?.outro.startMs).toBe(138 * 60_000 + 40_000);
  });

  it("ne retient pas un passage sombre SANS noyau, même sans concurrent", () => {
    // La même bataille, seule : rien ne porte de défilement de texte, donc rien
    // n'est proposé. Le silence vaut mieux qu'un saut au hasard.
    const samples = series([
      { fromMin: 60, toMin: 89, dark: 0.4, saturation: 30 },
      { fromMin: 89, toMin: 94, dark: 0.9, saturation: 8 },
      { fromMin: 94, toMin: 100, dark: 0.4, saturation: 30 },
    ]);
    expect(creditsFromFrames(samples, 100 * 60_000)).toBeNull();
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
    finalCredits: null,
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

  it("REMPLACE un marqueur posé après la fin du générique qu'on a vu", () => {
    // « No Way Home » : Jellyfin pose un « générique » de 46 s à 147:25, soit
    // quarante minutes après le vrai — la queue du fichier. Il survit au filtre
    // de crédibilité d'une seconde, et le bouton proposait de terminer le film.
    const bounds: BoundsByType = new Map([
      ["Outro", [{ startMs: 8_845_000, endMs: runtime, source: "jellyfin" as const }]],
    ]);
    applyFrameVerdict(bounds, verdict, runtime);
    expect(bounds.get("Outro")).toEqual([verdict.outro]);
  });

  it("ne remplace pas un marqueur par plus court que lui", () => {
    const long = { startMs: 8_500_000, endMs: runtime, source: "jellyfin" as const };
    const bounds: BoundsByType = new Map([["Outro", [{ ...long }]]]);
    // Un verdict de 30 s posé avant lui : plus court, donc pas plus digne de foi.
    applyFrameVerdict(
      bounds,
      { outro: { startMs: 8_400_000, endMs: 8_430_000, source: "frames" }, sceneAfter: true, finalCredits: null },
      runtime,
    );
    expect(bounds.get("Outro")).toEqual([long]);
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

describe("le générique FINAL, après la scène", () => {
  const RUNTIME = 148.2 * 60_000;

  /** Générique, scène, puis le générique reprend jusqu'au bout. */
  function withFinalCredits(): FrameSample[] {
    return series([
      { fromMin: 89, toMin: 138.67, dark: 0.4, saturation: 30 },
      { fromMin: 138.67, toMin: 144, dark: 0.9, saturation: 0.1 },
      { fromMin: 144, toMin: 146, dark: 0.2, saturation: 40 },
      { fromMin: 146, toMin: 148.2, dark: 0.9, saturation: 0.1 },
    ]);
  }

  it("le trouve, et le fait courir jusqu'à la fin du média", () => {
    const verdict = creditsFromFrames(withFinalCredits(), RUNTIME);
    expect(verdict?.outro.endMs).toBe(144 * 60_000 - 10_000);
    expect(verdict?.sceneAfter).toBe(true);
    // Son début ne recule PAS : en avance, « Terminer la lecture » mordrait
    // sur la fin de la scène.
    expect(verdict?.finalCredits).toEqual({
      startMs: 146 * 60_000,
      endMs: RUNTIME,
      source: "frames",
    });
  });

  it("ne dit rien quand la scène est la dernière chose du média", () => {
    const verdict = creditsFromFrames(noWayHome(), NO_WAY_HOME_MS);
    expect(verdict?.sceneAfter).toBe(true);
    expect(verdict?.finalCredits).toBeNull();
  });

  it("le pose en SECOND générique, à côté du principal", () => {
    const bounds: BoundsByType = new Map();
    const final = { startMs: 8_760_000, endMs: 8_892_000, source: "frames" as const };
    applyFrameVerdict(
      bounds,
      {
        outro: { startMs: 8_320_000, endMs: 8_700_000, source: "frames" },
        sceneAfter: true,
        finalCredits: final,
      },
      8_892_000,
    );
    const outros = bounds.get("Outro");
    expect(outros).toHaveLength(2);
    expect(outros?.[1]).toEqual(final);
  });

  it("ne le pose pas quand il chevauche le générique principal", () => {
    const bounds: BoundsByType = new Map();
    applyFrameVerdict(
      bounds,
      {
        outro: { startMs: 8_320_000, endMs: 8_760_000, source: "frames" },
        // Incohérent : il commencerait AVANT la fin du principal.
        finalCredits: { startMs: 8_700_000, endMs: 8_892_000, source: "frames" },
        sceneAfter: true,
      },
      8_892_000,
    );
    expect(bounds.get("Outro")).toHaveLength(1);
  });
});
