import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { clipsOffscreenCells } from "./listClipping";

const OCTAVE = join(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("retrait des cellules hors écran (bogue des étagères de l'accueil)", () => {
  it("permis sur Android, jamais sur iOS (Fabric remonte mal les cellules réordonnées)", () => {
    expect(clipsOffscreenCells("android")).toBe(true);
    expect(clipsOffscreenCells("ios")).toBe(false);
  });

  it("aucune liste d'Octave ne l'allume en dur : toutes passent par la règle", () => {
    const offenders = sources(OCTAVE).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(/removeClippedSubviews(?!=\{clipsOffscreenCells\(Platform\.OS\)\})/g)].map(() => relative(OCTAVE, file));
    });
    // Le module de la règle la nomme dans son commentaire : il n'est pas une liste.
    expect(offenders.filter((f) => !f.endsWith("listClipping.ts"))).toEqual([]);
  });
});
