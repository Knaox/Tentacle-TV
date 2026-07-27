/**
 * Fixtures partagées par les tests de la couche téléchargements.
 *
 * ⚠️ Ce fichier n'est PAS compilé dans `dist/` — voir l'`exclude` de
 * `tsconfig.json`. Il importe `vitest`, ce qui n'a rien à faire dans un paquet
 * livré. Il ne porte volontairement aucun test : son nom ne correspond pas au
 * motif que vitest collecte.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach } from "vitest";
import { ensureLayout, forgetRoot } from "./paths";
import { integer } from "./rows";
import type { ClaimSpec } from "./store";

const dossiers: string[] = [];

/** Racine de téléchargement jetable, `media/` et `meta/` déjà créés. */
export function racinePreparee(prefixe = "tentacle-test-"): string {
  const root = mkdtempSync(path.join(tmpdir(), prefixe));
  dossiers.push(root);
  ensureLayout(root);
  return root;
}

/** Écrit un faux média sous la racine, dossiers créés au besoin. */
export function ecrireMedia(root: string, rel: string, contenu = "data"): void {
  const cible = path.join(root, rel);
  mkdirSync(path.dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
}

/**
 * Un claim par défaut, surchargeable champ par champ. Les valeurs sont celles
 * de `store_tests.rs`, pour que les deux suites se comparent d'un coup d'œil.
 */
export function spec(partial: Partial<ClaimSpec> = {}): ClaimSpec {
  return {
    userId: "u",
    itemId: "item1",
    mediaSourceId: "ms1",
    variant: "original",
    preset: null,
    relPath: "media/item1/original-ms1.mkv",
    expectedSize: 4,
    autoDeleteAfterWatch: false,
    nowMs: 1_000,
    ...partial,
  };
}

/** Nombre de lignes d'une table. */
export function compter(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
  return row === undefined ? 0 : integer(row, "n");
}

/** Marque l'item comme vu — plusieurs invariants en dépendent. */
export function marquerVu(db: DatabaseSync, userId: string, itemId: string): void {
  db.prepare(
    `INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
     VALUES (?, ?, 0, 1, 1)`,
  ).run(userId, itemId);
}

// Les racines jetables partent à la fin de chaque test, et la racine mémorisée
// avec elles : un cache de module survivrait sinon d'un test à l'autre.
afterEach(() => {
  forgetRoot();
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});
