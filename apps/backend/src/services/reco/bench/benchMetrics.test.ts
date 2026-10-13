import { describe, expect, it } from "vitest";
import { intraListDiversity, intrusions, ndcgAtK, novelty, popularityCalibration, recallAtK } from "./benchMetrics";
import type { JudgedTitle } from "./benchMetrics";

const t = (key: string, votes: number | null, facets: string[] = [], universes: JudgedTitle["universes"] = []): JudgedTitle => ({
  key, title: key, voteCount: votes, facetKeys: facets, universes,
});

describe("mesures du banc", () => {
  it("rappel et NDCG d'un titre caché par essai", () => {
    expect(recallAtK([0, 5, 25, null], 20)).toBe(0.5);
    expect(ndcgAtK([0], 20)).toBe(1);
    expect(ndcgAtK([1], 20)).toBeCloseTo(1 / Math.log2(3));
    expect(ndcgAtK([null, 30], 20)).toBe(0);
  });

  it("un intrus : listé à éviter, ou d'un univers que le compte ne regarde pas", () => {
    const res = intrusions([t("a", 1), t("b", 1, [], ["anime"]), t("c", 1)], new Set(["c"]), ["anime"]);
    expect(res.rate).toBeCloseTo(2 / 3);
    expect(res.intruders.map((i) => i.why)).toEqual(["anime", "à éviter"]);
  });

  it("calibration de popularité : même répartition = 0, opposées = 1", () => {
    expect(popularityCalibration([5000, 6000], [5500, 7000]).jsDivergence).toBe(0);
    expect(popularityCalibration([50, 60], [30000, 40000]).jsDivergence).toBe(1);
  });

  it("diversité et nouveauté", () => {
    expect(intraListDiversity([t("a", 1, ["x", "y"]), t("b", 1, ["x", "y"])])).toBe(0);
    expect(intraListDiversity([t("a", 1, ["x"]), t("b", 1, ["y"])])).toBe(1);
    expect(novelty([t("a", 40_000)])).toBe(0);
    expect(novelty([t("a", 39)])).toBeCloseTo(3, 0);
  });
});
