import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { androidHapticFor, iosHapticFor, type HapticCue } from "./hapticCues";

const CUES: HapticCue[] = ["tap", "select", "commit", "longPress", "destructive", "success", "notice"];

/**
 * Les constantes de `HapticFeedbackConstants` et leur niveau d'API. expo-haptics
 * les lit par réflexion : une constante absente de l'appareil fait rejeter
 * l'appel. Seules les cinq premières ont un repli dans le module natif.
 */
const SINCE_API: Record<string, number> = {
  "long-press": 3,
  "virtual-key": 5,
  "keyboard-tap": 8,
  "clock-tick": 21,
  "context-click": 23,
  "text-handle-move": 27,
  confirm: 30,
  reject: 30,
  "gesture-start": 30,
  "gesture-end": 30,
  "segment-tick": 34,
  "segment-frequent-tick": 34,
  "toggle-on": 34,
  "toggle-off": 34,
  "drag-start": 34,
};

describe("signaux haptiques", () => {
  it("Android : chaque signal joue une constante que l'appareil connaît (API 26 à 36)", () => {
    for (let api = 26; api <= 36; api++) {
      for (const cue of CUES) {
        const value = androidHapticFor(cue, api);
        expect(SINCE_API[value], `${cue} @ API ${api} → ${value}`).toBeLessThanOrEqual(api);
      }
    }
  });

  it("Android : l'appui long est l'effet d'appui long du système", () => {
    expect(androidHapticFor("longPress", 26)).toBe("long-press");
    expect(androidHapticFor("longPress", 36)).toBe("long-press");
  });

  it("Android : un appui confirmé reste le plus léger des clics", () => {
    expect(androidHapticFor("tap", 26)).toBe("context-click");
    expect(androidHapticFor("tap", 36)).toBe("context-click");
  });

  it("Android : les constantes récentes dès leur niveau d'API, leur équivalent avant", () => {
    expect(androidHapticFor("commit", 29)).toBe("virtual-key");
    expect(androidHapticFor("commit", 30)).toBe("confirm");
    expect(androidHapticFor("select", 33)).toBe("clock-tick");
    expect(androidHapticFor("select", 34)).toBe("segment-tick");
  });

  it("iOS : l'échelle d'UIKit — léger, sélection, moyen, lourd, succès", () => {
    expect(iosHapticFor("tap")).toEqual({ kind: "impact", style: "light" });
    expect(iosHapticFor("select")).toEqual({ kind: "selection" });
    expect(iosHapticFor("commit")).toEqual({ kind: "impact", style: "medium" });
    expect(iosHapticFor("longPress")).toEqual({ kind: "impact", style: "medium" });
    expect(iosHapticFor("destructive")).toEqual({ kind: "impact", style: "heavy" });
    expect(iosHapticFor("success")).toEqual({ kind: "notification", type: "success" });
  });
});

/** Tous les fichiers source du mobile (`src/`, `app/`), tests exclus. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("la règle haptique tient dans tout le mobile", () => {
  const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = [...sources(join(mobileRoot, "src")), ...sources(join(mobileRoot, "app"))];

  it("seul utils/haptics.ts fait vibrer (hapticCues.ts n'en lit que des types)", () => {
    const module = new Set([join("src", "utils", "haptics.ts"), join("src", "utils", "hapticCues.ts")]);
    const offenders = files
      .filter((path) => /["']expo-haptics["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(mobileRoot, path))
      .filter((path) => !module.has(path));
    expect(offenders).toEqual([]);
    const cues = readFileSync(join(mobileRoot, "src", "utils", "hapticCues.ts"), "utf8");
    expect(cues).toMatch(/import type \{[^}]*\} from "expo-haptics"/);
    expect(cues).not.toMatch(/^import \{[^}]*\} from "expo-haptics"/m);
  });

  it("aucun retour haptique au poser du doigt", () => {
    // Un gestionnaire `onPressIn` qui appelle `haptic(` sur la même ligne, ou
    // une fonction nommée `…PressIn` qui le fait dans son corps.
    const offenders = files.filter((path) => {
      const source = readFileSync(path, "utf8");
      return /onPressIn[^\n]*haptic\(/.test(source)
        || /PressIn\s*=\s*(?:useCallback\()?\([^)]*\)\s*=>\s*\{[^}]*haptic\(/.test(source);
    }).map((path) => relative(mobileRoot, path));
    expect(offenders).toEqual([]);
  });
});
