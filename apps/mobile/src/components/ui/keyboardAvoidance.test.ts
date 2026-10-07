import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keyboardAvoidanceBehavior } from "./keyboardAvoidance";

describe("keyboardAvoidanceBehavior", () => {
  it("Android évite toujours le clavier (bord à bord : plus de redimensionnement)", () => {
    expect(keyboardAvoidanceBehavior("android", true)).toBe("padding");
    expect(keyboardAvoidanceBehavior("android", false)).toBe("padding");
  });

  it("iOS garde le réglage de l'écran", () => {
    expect(keyboardAvoidanceBehavior("ios", true)).toBe("padding");
    expect(keyboardAvoidanceBehavior("ios", false)).toBeUndefined();
  });

  it("ailleurs (web), rien", () => {
    expect(keyboardAvoidanceBehavior("web", true)).toBeUndefined();
  });
});

/** Tous les fichiers .tsx sous `src/`. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("une seule source pour éviter le clavier", () => {
  it("aucun écran ne règle un KeyboardAvoidingView à la main", () => {
    const src = join(__dirname, "..", "..");
    const offenders = tsxFiles(src)
      .filter((path) => !path.endsWith("KeyboardAvoidingArea.tsx"))
      .filter((path) => readFileSync(path, "utf8").includes("KeyboardAvoidingView"));
    expect(offenders).toEqual([]);
  });
});
