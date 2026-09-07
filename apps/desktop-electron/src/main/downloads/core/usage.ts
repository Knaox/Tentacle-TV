/**
 * Ce que les titres gardés occupent sur l'appareil.
 *
 * La somme se lit en base plutôt que sur le disque : un parcours de dossiers à
 * chaque affichage coûterait cher pour une valeur qui ne bouge qu'aux
 * transferts. Le prix de ce choix, c'est qu'une ligne qui ment fait mentir
 * l'écran — d'où la réparation qui recale la base sur le disque.
 */

import type { DatabaseHandle } from "./adapters";
import { integer } from "./rows";

/** Octets occupés sur le disque par TOUS les fichiers, partiels compris. */
export function diskUsage(db: DatabaseHandle): number {
  const row = db.prepare("SELECT COALESCE(SUM(bytes_done), 0) AS n FROM files").get();
  return row === undefined ? 0 : integer(row, "n");
}
