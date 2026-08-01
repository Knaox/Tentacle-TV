/**
 * Le dump de stockage local laissé par l'app Tauri : le lire, le rendre, le
 * retirer.
 *
 * # Ce qui est en jeu
 *
 * `localStorage` est rangé par ORIGINE. Sous Tauri c'est
 * `http://tauri.localhost` ; ici c'est `tentacle://app`, une origine neuve, qui
 * ne voit donc rien. Sans cette reprise, la première version Electron
 * déconnecte **tout le monde**.
 *
 * L'app Tauri livrée écrit déjà la sauvegarde (`migration/localStorageExport.ts`)
 * dans une ligne de `session_cache` sous un identifiant synthétique — la base
 * survit à la migration, `localStorage` non.
 *
 * # Pourquoi ce fichier est séparé de l'IPC
 *
 * Il n'importe pas `electron`, donc il se teste. Cette restitution n'a qu'UNE
 * seule occasion de fonctionner, chez chaque utilisateur, et elle ne peut pas
 * être éprouvée à l'écran en développement : sa seule preuve est ici.
 */

import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { settingGet, settingSet } from "./db";

/** Identifiant synthétique : jamais un vrai identifiant Jellyfin. */
export const CLE_MIGRATION = "__tentacle_migration_v1__";

/**
 * Trace durable du passage.
 *
 * Fait doublon avec la suppression de la ligne dans le cas nominal, et sert
 * dans un seul cas : celui de la machine de développement, où l'app Tauri
 * tourne encore et RÉÉCRIT la sauvegarde. Sans cette clé, chaque lancement
 * d'Electron rejouerait un dump ressuscité.
 */
export const CLE_TRACE = "migration_v1_restored";

/**
 * Forme écrite par l'app Tauri. Validée plutôt que crue : ce JSON vient d'une
 * AUTRE application, dans une version qu'on ne choisit pas.
 */
const DUMP = z.object({
  version: z.literal(1),
  savedAt: z.number().optional(),
  origin: z.string().optional(),
  entries: z.record(z.string()),
});

/** Ce qu'on a trouvé. Chaque cas mérite sa trace, y compris les échecs. */
export type PriseDump =
  | { etat: "aucune" }
  | { etat: "deja-faite" }
  | { etat: "illisible"; raison: string }
  | { etat: "prise"; entries: Record<string, string>; origine: string | null };

/**
 * Rend le dump et le retire, ou dit pourquoi il n'y a rien à rendre.
 *
 * Une sauvegarde illisible est CONSERVÉE, sans trace : un analyseur corrigé
 * plus tard doit pouvoir retenter. Une sauvegarde lue est retirée — elle porte
 * le jeton en clair, on ne le laisse pas en double dans la base.
 */
export function takeMigrationDump(db: DatabaseSync, now: number): PriseDump {
  if (settingGet(db, CLE_TRACE) !== null) return { etat: "deja-faite" };

  const row = db
    .prepare("SELECT profile_json FROM session_cache WHERE jellyfin_user_id = ?")
    .get(CLE_MIGRATION);
  if (row === undefined) return { etat: "aucune" };

  const brut = row["profile_json"];
  if (typeof brut !== "string") return { etat: "illisible", raison: "colonne vide" };

  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch (error) {
    return { etat: "illisible", raison: `json : ${String(error)}` };
  }

  const parsed = DUMP.safeParse(json);
  if (!parsed.success) return { etat: "illisible", raison: parsed.error.message };

  db.prepare("DELETE FROM session_cache WHERE jellyfin_user_id = ?").run(CLE_MIGRATION);
  settingSet(db, CLE_TRACE, String(now));
  return {
    etat: "prise",
    entries: parsed.data.entries,
    origine: parsed.data.origin ?? null,
  };
}
