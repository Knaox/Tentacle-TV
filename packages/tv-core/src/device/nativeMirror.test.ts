import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RENDER_TIER_THRESHOLDS } from "./renderTier";

/**
 * Le micro-test se MESURE en Kotlin (`MicroBench.kt`) et se JUGE ici : le
 * seuil ne vaut que pour la version du travail qui l'a calibré. Changer l'un
 * sans l'autre, c'est juger un score avec le barème d'un autre test.
 */

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEVICE = resolve(PACKAGE, "../../apps/tv/android/app/src/main/java/com/tentacletv/device");

describe.runIf(existsSync(DEVICE))("le miroir natif du niveau de rendu", () => {
  it("MicroBench.kt mesure à la version que juge RENDER_TIER_THRESHOLDS", () => {
    const kotlin = readFileSync(resolve(DEVICE, "MicroBench.kt"), "utf8");
    expect(Number(kotlin.match(/const val VERSION = (\d+)/)?.[1])).toBe(RENDER_TIER_THRESHOLDS.benchVersion);
  });

  it("le micro-test tient sous 300 ms", () => {
    const kotlin = readFileSync(resolve(DEVICE, "MicroBench.kt"), "utf8");
    expect(Number(kotlin.match(/const val BUDGET_MS = (\d+)L/)?.[1])).toBeLessThan(300);
  });

  it("le module lit les propriétés de débogage que documente tv-core", () => {
    const kotlin = readFileSync(resolve(DEVICE, "DeviceModule.kt"), "utf8");
    for (const prop of ["debug.tentacle.lite", "debug.tentacle.lite.signals", "debug.tentacle.lite.bench"]) {
      expect(kotlin).toContain(`"${prop}"`);
    }
  });
});
