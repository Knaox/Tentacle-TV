import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ACTIVITY_SPINNER } from "./activitySpinner";

/**
 * Les vues de rendu d'Android TV recopient des règles de tv-core (elles
 * dessinent à chaque image, sans le JS) : ce test tient leurs constantes à
 * celles d'ici — une copie qui dérive ne se verrait qu'à l'œil, sur une
 * seule plateforme.
 */

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const KOTLIN = resolve(PACKAGE, "../../apps/tv/android/app/src/main/java/com/tentacletv/render");

const ktConstant = (code: string, name: string) => {
  const match = code.match(new RegExp(`const val ${name} = (\\d+(?:\\.\\d+)?)(?:f|L)?(?: / (\\d+(?:\\.\\d+)?)f)?`));
  if (!match) return Number.NaN;
  return match[2] ? Number(match[1]) / Number(match[2]) : Number(match[1]);
};

describe.runIf(existsSync(KOTLIN))("les miroirs natifs des règles de rendu", () => {
  it("l'indicateur d'activité : TentacleSpinnerView.kt reprend chaque constante d'ACTIVITY_SPINNER", () => {
    const kotlin = readFileSync(join(KOTLIN, "TentacleSpinnerView.kt"), "utf8");
    const { large, small } = ACTIVITY_SPINNER;
    const expected: Record<string, number> = {
      SPOKES: ACTIVITY_SPINNER.spokes,
      STEP_MS: ACTIVITY_SPINNER.stepMs,
      FRAME_MS: ACTIVITY_SPINNER.frameMs,
      FADE_MS: ACTIVITY_SPINNER.fadeMs,
      REST_ALPHA: ACTIVITY_SPINNER.restAlpha,
      LIT_ALPHA: ACTIVITY_SPINNER.litAlpha,
      LARGE_SPOKE: large.spokeWidth,
      LARGE_INNER: large.innerRadius,
      LARGE_OUTER: large.outerRadius,
      SMALL_SPOKE: small.spokeWidth,
      SMALL_INNER: small.innerRadius,
      SMALL_OUTER: small.outerRadius,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(ktConstant(kotlin, name), `TentacleSpinnerView.kt ${name}`).toBeCloseTo(value, 6);
    }
  });
});
