/**
 * Garde : toute modale en `position: fixed` passe par un PORTAIL.
 *
 * Un `backdrop-filter` (le verre), un `filter`, un `transform` ou la propriété
 * `scale` (la lentille de lg-physique) font de leur élément le BLOC CONTENEUR
 * de ses descendants en `position: fixed`. Une modale rendue sous une surface
 * de verre ne couvre donc plus la fenêtre : `DownloadDialog`, ouvert depuis la
 * capsule de la fiche, tenait dans 240 × 54 px, son bouton hors de la fenêtre
 * — impossible de garder un titre hors ligne (relevé par lg-banc, 21/10).
 *
 * Règle : un fichier qui rend une modale (`aria-modal`) en `fixed` la monte par
 * `createPortal`, ou passe par une primitive qui le fait (`Modal`, `Sheet`,
 * `FloatingLayer`). Les seules exceptions sont des écrans plein cadre montés à
 * la RACINE de l'app, jamais sous une surface — dits ci-dessous.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..", "..");

/** Écrans plein cadre montés à la racine de l'app (portes de démarrage). */
const ROOT_SCREENS = new Set([
  // Porte de la migration MariaDB → SQLite : remplace toute l'app.
  "databaseMigration/DatabaseMigrationScreen.tsx",
  // Cadre de « accès suspendu » : remplace toute l'app.
  "accountAccess/AccessFrame.tsx",
]);

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) tsxFiles(path, out);
    else if (name.endsWith(".tsx") && !name.includes(".test.")) out.push(path);
  }
  return out;
}

const PORTAL = /createPortal\(|<Modal\b|<Sheet\b|<FloatingLayer\b/;

describe("modales et surfaces de verre", () => {
  it("toute modale en position fixed passe par un portail", () => {
    const offenders = tsxFiles(SRC)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return source.includes("aria-modal") && /\bfixed\b/.test(source) && !PORTAL.test(source);
      })
      .map((file) => relative(SRC, file))
      .filter((file) => !ROOT_SCREENS.has(file));
    expect(offenders).toEqual([]);
  });

  it("les dialogues du hors ligne, ouverts depuis une capsule de verre, sont en portail", () => {
    for (const file of ["downloads/DownloadDialog.tsx", "downloads/DeleteDownloadModal.tsx"]) {
      expect(readFileSync(join(SRC, file), "utf8")).toMatch(/createPortal\([\s\S]*document\.body/);
    }
  });
});
