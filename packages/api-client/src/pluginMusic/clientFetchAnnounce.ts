/**
 * L'ANNONCE de l'appareil : tant que l'agent des requêtes déléguées tourne
 * (`clientFetchAgent.ts`, le bureau seul), chaque appel vers une extension
 * (`/api/plugins/…`) dit au serveur « je sais exécuter des requêtes pour
 * elle ». Le relais en fait une poignée pour l'extension ; un serveur d'avant
 * retire l'en-tête (`x-tentacle-*`) sans rien en faire.
 */

import { CLIENT_FETCH_ANNOUNCE_HEADER } from "@tentacle-tv/shared/pluginClientFetch";

let announcing = 0;

export function setClientFetchAnnounced(on: boolean): void {
  announcing = Math.max(0, announcing + (on ? 1 : -1));
}

/** Les en-têtes à ajouter à un appel `apiPath` (vide hors bureau, ou hors des routes d'extension). */
export function clientFetchAnnounceHeaders(apiPath: string): Record<string, string> {
  return announcing > 0 && apiPath.startsWith("/api/plugins/") ? { [CLIENT_FETCH_ANNOUNCE_HEADER]: "1" } : {};
}
