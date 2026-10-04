import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REPEAT_PACING } from "../input/repeatPacing";
import { BURST_FOLLOW } from "./burstFollow";

/**
 * Les règles de focus que le natif APPLIQUE au geste (la géométrie n'est
 * juste qu'à ce moment-là) y sont recopiées, pas à pas : Apple TV
 * (`ios/TentacleTV/`) et Android TV (`android/.../com/tentacletv/focus/`).
 * Ce test tient leurs constantes à celles de tv-core — une copie qui dérive
 * ne se verrait sinon qu'à l'œil, sur une seule des deux plateformes.
 */

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = resolve(PACKAGE, "../../apps/tv");
const KOTLIN = join(APP, "android/app/src/main/java/com/tentacletv/focus");
const OBJC = join(APP, "ios/TentacleTV");

const read = (path: string) => readFileSync(path, "utf8");
const tsConstant = (code: string, name: string) => Number(code.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?)`))?.[1]);
const ktConstant = (code: string, name: string) => Number(code.match(new RegExp(`const val ${name} = (\\d+(?:\\.\\d+)?)f?`))?.[1]);
const objcConstant = (code: string, name: string) => Number(code.match(new RegExp(`static const CGFloat ${name} = (\\d+(?:\\.\\d+)?)`))?.[1]);

describe.runIf(existsSync(KOTLIN) && existsSync(OBJC))("les miroirs natifs des règles de focus", () => {
  const sections = read(join(PACKAGE, "src/focus/sections.ts"));

  it("la règle des sections : mêmes constantes dans tv-core, sur Apple TV et sur Android TV", () => {
    const kotlin = read(join(KOTLIN, "FocusNeighbors.kt"));
    const objc = read(join(OBJC, "TentacleFocusNeighbors.m"));
    for (const [name, objcName] of [
      ["STACK_SLACK", "kStackSlack"],
      ["SAME_EDGE", "kSameEdge"],
      ["FRONTIER_SLACK", "kFrontierSlack"],
    ] as const) {
      const value = tsConstant(sections, name);
      expect(Number.isFinite(value), name).toBe(true);
      expect(ktConstant(kotlin, name), `FocusNeighbors.kt ${name}`).toBe(value);
      expect(objcConstant(objc, objcName), `TentacleFocusNeighbors.m ${objcName}`).toBe(value);
    }
  });

  it("la cadence d'une flèche tenue : HoldPacer.kt lit chaque constante de REPEAT_PACING, et rien d'autre", () => {
    const kotlin = read(join(KOTLIN, "HoldPacer.kt"));
    const read_ = [...kotlin.matchAll(/num\("(\w+)"\)/g)].map((m) => m[1]).sort();
    expect(read_).toEqual(Object.keys(REPEAT_PACING).sort());
  });

  it("le segment d'un pas de tenue : RevealScroller.kt borne comme burstSegmentMs", () => {
    const kotlin = read(join(KOTLIN, "RevealScroller.kt"));
    const match = kotlin.match(/min\((\d+(?:\.\d+)?), max\((\d+(?:\.\d+)?), intervalMs \+ (\d+(?:\.\d+)?)\)\)/);
    expect(match, "burstSegmentMs introuvable dans RevealScroller.kt").not.toBeNull();
    const [, max, min, overlap] = match!.map(Number);
    expect({ max, min, overlap }).toEqual({ max: BURST_FOLLOW.maxSegmentMs, min: BURST_FOLLOW.minSegmentMs, overlap: BURST_FOLLOW.overlapMs });
  });
});
