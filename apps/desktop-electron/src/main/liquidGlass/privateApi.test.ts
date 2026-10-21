/**
 * Le verrou du Mac App Store : aucune API PRIVÉE du verre dans ce qui part dans
 * le paquet — pas même son NOM dans un commentaire, que `tsc` recopie dans le
 * JavaScript de l'archive.
 *
 * Le verre ne passe que par les propriétés publiques d'AppKit (`nativeGlass.ts`).
 * Les variantes que d'autres atteignent par des sélecteurs non publics
 * (`electron-liquid-glass`, `docs/LIQUID-GLASS.md` § 2) ne sont ni appelées ni
 * citées : un examen automatique du Store cherche aussi des noms en texte.
 * Vérifié une fois sur le paquet MAS lui-même (archive et web embarqué).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Ce qu'aucun fichier livré ne doit contenir — écrit ici, dans un test, qui ne part pas. */
const FORBIDDEN = ["set_variant", "_variant", "scrimState", "subduedState", "_adaptiveAppearance", "_useReducedShadowRadius"];

function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const full = path.join(folder, name);
    if (statSync(full).isDirectory()) return sources(full);
    const shipped = name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "testkit.ts";
    return shipped ? [full] : [];
  });
}

describe("Mac App Store — aucune API privée du verre", () => {
  const root = path.resolve(process.cwd(), "src");
  const files = sources(root);

  it("le principal et le preload sont bien relus", () => {
    expect(files.some((f) => f.endsWith(path.join("liquidGlass", "nativeGlass.ts")))).toBe(true);
    expect(files.some((f) => f.endsWith(path.join("preload", "index.ts")))).toBe(true);
  });

  it.each(FORBIDDEN)("« %s » n'apparaît dans aucun fichier livré", (name) => {
    const hits = files.filter((file) => readFileSync(file, "utf8").includes(name));
    expect(hits.map((f) => path.relative(root, f))).toEqual([]);
  });
});
