/**
 * La connexion unique à la base locale, pour le processus principal.
 *
 * Séparé de `downloads/db.ts` parce que lui n'importe jamais `electron` : c'est
 * ce qui rend la couche stockage testable sous vitest. Ici, et ici seulement,
 * on demande à Electron où vit le dossier de données.
 *
 * Ouverture PARESSEUSE : la première commande qui a besoin de la base la crée.
 * Un utilisateur qui n'a jamais rien téléchargé ne paie donc rien, et surtout
 * l'ouverture ne se produit pas avant `whenReady` — `app.getPath` n'y répondrait
 * pas correctement.
 */

import { app } from "electron";
import type { DatabaseSync } from "node:sqlite";
import { dbPath, open } from "./downloads/db";

let handle: DatabaseSync | null = null;

/** La connexion, ouverte au premier appel. */
export function localDb(): DatabaseSync {
  if (handle === null) handle = open(dbPath(app.getPath("userData")));
  return handle;
}

/**
 * Ferme la base, si elle a été ouverte.
 *
 * Appelée à l'extinction : WAL laisse un `-wal` et un `-shm` à côté du fichier,
 * et une fermeture propre les replie dans la base. Les laisser ne corrompt
 * rien, mais l'app Tauri qui rouvrirait le même fichier hériterait d'un journal
 * à rejouer sans raison.
 */
export function closeLocalDb(): void {
  if (handle === null) return;
  handle.close();
  handle = null;
}
