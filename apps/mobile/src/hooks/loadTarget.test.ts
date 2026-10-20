import { describe, expect, it } from "vitest";
import { LANDING_TIMEOUT_MS, loadTargetSeconds, progressCountsAsPosition } from "./loadTarget";

const RESUME_56_8 = 568_000_000;

describe("loadTargetSeconds — où poser le lecteur à son chargement", () => {
  it("en séance, le premier chargement va à la position du groupe, jamais à la reprise personnelle", () => {
    expect(loadTargetSeconds({ firstLoad: true, currentS: 116.1, resumeTicks: RESUME_56_8, startOverrideSeconds: 115.4 })).toBe(115.4);
    // La séance impose aussi le début du titre (0 : aucun saut).
    expect(loadTargetSeconds({ firstLoad: true, currentS: 0, resumeTicks: RESUME_56_8, startOverrideSeconds: 0 })).toBe(0);
  });

  it("hors séance, le premier chargement reprend où l'on en était ; les suivants gardent la position", () => {
    expect(loadTargetSeconds({ firstLoad: true, currentS: 0, resumeTicks: RESUME_56_8, startOverrideSeconds: undefined })).toBe(56.8);
    expect(loadTargetSeconds({ firstLoad: true, currentS: 0, resumeTicks: undefined, startOverrideSeconds: undefined })).toBe(0);
    expect(loadTargetSeconds({ firstLoad: false, currentS: 130.2, resumeTicks: RESUME_56_8, startOverrideSeconds: 115.4 })).toBe(130.2);
  });
});

describe("progressCountsAsPosition — la progression d'avant l'atterrissage du saut de départ", () => {
  const landing = { targetS: 276.4, sinceMs: 1_000 };
  it("loin de la cible, juste après le saut : ce n'est pas encore la position", () => {
    expect(progressCountsAsPosition(landing, 0.07, 1_500)).toBe(false);
  });
  it("atterri, ou trop tard pour attendre : la progression fait foi", () => {
    expect(progressCountsAsPosition(landing, 276.1, 1_500)).toBe(true);
    expect(progressCountsAsPosition(landing, 0.07, 1_000 + LANDING_TIMEOUT_MS)).toBe(true);
    expect(progressCountsAsPosition(null, 0.07, 1_500)).toBe(true);
  });
});
