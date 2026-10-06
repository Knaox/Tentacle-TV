import { describe, expect, it } from "vitest";
import { offersRestartAnyway, outcomeTone, readSegmentRun, stepState } from "./segmentRunModel";

const raw = {
  phase: "restarting",
  running: true,
  startedAt: "2026-10-06T13:00:00Z",
  finishedAt: null,
  plugins: [{ key: "introSkipper", outcome: "installed" }, { key: "theIntroDb", outcome: "repo-offline" }, { key: "skipMeDb", outcome: "inconnu" }],
  restart: null,
  configured: null,
  error: null,
};

describe("lecture d'un passage d'installation des greffons", () => {
  it("lit l'état, et ignore un résultat qu'il ne connaît pas", () => {
    const run = readSegmentRun(raw);
    expect(run?.plugins).toEqual([
      { key: "introSkipper", outcome: "installed" },
      { key: "theIntroDb", outcome: "repo-offline" },
      { key: "skipMeDb", outcome: null },
    ]);
    expect(readSegmentRun({ phase: "ailleurs" })).toBeNull();
    expect(readSegmentRun(null)).toBeNull();
  });

  it("les étapes : faites avant la phase en cours, à venir après", () => {
    const run = readSegmentRun(raw)!;
    expect(["repositories", "installing", "restarting", "configuring"].map((step) => stepState(run, step as never))).toEqual(["done", "done", "running", "pending"]);
  });

  it("le ton d'un greffon ne dépend que de « en place » ou non", () => {
    expect([outcomeTone("present"), outcomeTone("enabled"), outcomeTone("too-old"), outcomeTone(null)]).toEqual(["success", "success", "warning", "neutral"]);
  });

  it("« Redémarrer maintenant » seulement quand quelqu'un regardait", () => {
    const done = { ...readSegmentRun(raw)!, running: false, phase: "done" as const };
    expect(offersRestartAnyway({ ...done, restart: "deferred-playing" })).toBe(true);
    expect(offersRestartAnyway({ ...done, restart: "done" })).toBe(false);
    expect(offersRestartAnyway({ ...done, running: true, restart: "deferred-playing" })).toBe(false);
  });
});
