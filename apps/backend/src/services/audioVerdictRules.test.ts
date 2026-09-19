/**
 * Des zones au verdict : les bornes, les marges, la dernière zone de la queue,
 * l'aperçu absorbé, le doublon écarté, et le témoignage des voisins — accord
 * exigé à deux, seuils durcis à un, silence au doute.
 */

import { describe, expect, it } from "vitest";
import type { MatchZone } from "./audioMatch";
import {
  combineComparisons,
  pickIntro,
  pickOutro,
  settle,
  type Candidate,
  type NeighbourComparison,
} from "./audioVerdictRules";

const RUNTIME_MS = 1_420_000;
const HEAD_MS = 300_000;
const TAIL_MS = 360_000;

const zone = (aStartMs: number, aEndMs: number, density = 0.95): MatchZone => ({
  aStartMs, aEndMs, bStartMs: aStartMs + 27_000, bEndMs: aEndMs + 27_000,
  offsetMs: 27_000, density, distinctRatio: 0.9, votes: 500,
});

describe("pickIntro", () => {
  it("la zone la plus longue entre 15 et 150 s, avec les marges dans le sens sûr", () => {
    const { candidate, duplicate } = pickIntro([zone(20_000, 28_000), zone(140_000, 230_000)], HEAD_MS);
    expect(duplicate).toBe(false);
    expect(candidate).toEqual({ startMs: 141_000, endMs: 228_500, density: 0.95, contentAfter: false });
  });

  it("rien sous 15 s, rien au-dessus de 150 s", () => {
    expect(pickIntro([zone(0, 14_000)], HEAD_MS).candidate).toBeNull();
    expect(pickIntro([zone(0, 149_000)], HEAD_MS).candidate).not.toBeNull();
  });

  it("une zone qui couvre plus de la moitié de la fenêtre est un doublon", () => {
    const { candidate, duplicate } = pickIntro([zone(0, 151_000)], HEAD_MS);
    expect(duplicate).toBe(true);
    expect(candidate).toBeNull();
  });
});

describe("pickOutro", () => {
  it("la DERNIÈRE zone crédible, étendue jusqu'au bout quand il ne reste qu'un aperçu", () => {
    const zones = [zone(1_100_000, 1_150_000), zone(1_290_000, 1_387_000)];
    const { candidate } = pickOutro(zones, TAIL_MS, RUNTIME_MS);
    expect(candidate).toEqual({ startMs: 1_292_000, endMs: RUNTIME_MS, density: 0.95, contentAfter: false });
  });

  it("plus de 45 s après la zone : du contenu, la fin reste celle de la zone", () => {
    const { candidate } = pickOutro([zone(1_149_000, 1_238_000)], TAIL_MS, RUNTIME_MS);
    expect(candidate).toEqual({ startMs: 1_151_000, endMs: 1_238_000, density: 0.95, contentAfter: true });
  });

  it("un jingle de cinq secondes en toute fin ne fait pas un générique", () => {
    expect(pickOutro([zone(1_414_000, 1_419_000)], TAIL_MS, RUNTIME_MS).candidate).toBeNull();
  });

  it("le plancher est celui du résolveur (1 % de la durée, 45 s au plus)", () => {
    expect(pickOutro([zone(1_400_000, 1_416_000)], TAIL_MS, RUNTIME_MS).candidate).not.toBeNull(); // 16 s ≥ 14,2 s
    expect(pickOutro([zone(1_400_000, 1_413_000)], TAIL_MS, RUNTIME_MS).candidate).toBeNull(); // 13 s < 15 s
  });

  it("un doublon écarte tout", () => {
    expect(pickOutro([zone(1_060_000, 1_300_000)], TAIL_MS, RUNTIME_MS)).toEqual({ candidate: null, duplicate: true });
  });
});

const cand = (startMs: number, endMs: number, over: Partial<Candidate> = {}): Candidate => ({
  startMs, endMs, density: 0.95, contentAfter: false, ...over,
});

describe("settle — le témoignage des voisins", () => {
  it("deux voisins d'accord : le plus long, confirmé par deux", () => {
    const got = settle("intro", [cand(140_000, 226_000), cand(141_000, 230_000)], 2);
    expect(got).toEqual({ bounds: { startMs: 141_000, endMs: 230_000, source: "audio" }, confirmedBy: 2, reason: null });
  });

  it("deux voisins en désaccord : silence", () => {
    const got = settle("intro", [cand(140_000, 226_000), cand(140_000, 260_000)], 2);
    expect(got.bounds).toBeNull();
    expect(got.reason).toContain("désaccord");
  });

  it("un seul voisin l'entend : accepté s'il est long et dense, sinon silence", () => {
    expect(settle("intro", [cand(140_000, 226_000)], 2).confirmedBy).toBe(1);
    expect(settle("intro", [cand(140_000, 160_000)], 1).bounds).toBeNull();
    expect(settle("intro", [cand(140_000, 226_000, { density: 0.7 })], 1).bounds).toBeNull();
  });

  it("du contenu après le générique exige deux voisins", () => {
    const got = settle("ending", [cand(1_151_000, 1_238_000, { contentAfter: true })], 1);
    expect(got.bounds).toBeNull();
    expect(got.reason).toContain("contenu après");
    const both = settle("ending", [
      cand(1_151_000, 1_238_000, { contentAfter: true }),
      cand(1_150_000, 1_239_000, { contentAfter: true }),
    ], 2);
    expect(both.bounds).toEqual({ startMs: 1_150_000, endMs: 1_239_000, source: "audio" });
  });

  it("aucun voisin comparé, ou rien de partagé : le dire", () => {
    expect(settle("ending", [], 0).reason).toContain("aucun voisin");
    expect(settle("ending", [], 2).reason).toContain("rien de partagé");
  });
});

describe("combineComparisons", () => {
  const comparison = (over: Partial<NeighbourComparison> = {}): NeighbourComparison => ({
    neighbourId: "ep-2", introCompared: true, outroCompared: true, intro: null, outro: null, duplicate: false, ...over,
  });

  it("assemble intro et ending, garde la clé des voisins, aucune raison quand tout est posé", () => {
    const verdict = combineComparisons(
      [
        comparison({ intro: cand(140_000, 226_000), outro: cand(1_292_000, RUNTIME_MS) }),
        comparison({ neighbourId: "ep-4", intro: cand(140_000, 227_000), outro: cand(1_291_000, RUNTIME_MS) }),
      ],
      "ep-2,ep-4",
    );
    expect(verdict).toEqual({
      intro: { startMs: 140_000, endMs: 227_000, source: "audio" },
      outro: { startMs: 1_291_000, endMs: RUNTIME_MS, source: "audio" },
      confirmedBy: 2,
      neighbourKey: "ep-2,ep-4",
    });
  });

  it("le « rien » est un objet avec ses raisons — jamais null", () => {
    const verdict = combineComparisons([comparison(), comparison({ neighbourId: "ep-4" })], "ep-2,ep-4");
    expect(verdict).toMatchObject({ intro: null, outro: null, confirmedBy: 0, neighbourKey: "ep-2,ep-4" });
    expect(verdict.reason).toContain("intro : rien de partagé");
    expect(verdict.reason).toContain("ending : rien de partagé");
  });

  it("un voisin doublon est écarté, et dit", () => {
    const verdict = combineComparisons(
      [comparison({ duplicate: true, intro: cand(0, 300_000) }), comparison({ neighbourId: "ep-4", intro: cand(140_000, 226_000) })],
      "ep-2,ep-4",
    );
    expect(verdict.intro).toEqual({ startMs: 140_000, endMs: 226_000, source: "audio" });
    expect(verdict.confirmedBy).toBe(1);
    expect(verdict.reason).toContain("même fichier");
  });

  it("confirmé par deux seulement si tout ce qui est posé l'est", () => {
    const verdict = combineComparisons(
      [
        comparison({ intro: cand(140_000, 226_000), outro: cand(1_292_000, RUNTIME_MS) }),
        comparison({ neighbourId: "ep-4", outro: cand(1_291_000, RUNTIME_MS) }),
      ],
      "ep-2,ep-4",
    );
    expect(verdict.intro).not.toBeNull();
    expect(verdict.outro).not.toBeNull();
    expect(verdict.confirmedBy).toBe(1);
  });
});
