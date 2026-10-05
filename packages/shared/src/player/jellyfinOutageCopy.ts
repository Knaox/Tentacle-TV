import type { JellyfinHealthState } from "../types/sessionChannelMessages";

/**
 * Ce que dit le bandeau d'un lecteur pendant une panne de Jellyfin — la même
 * phrase sur le web, le bureau, le mobile et les téléviseurs (espace `player`,
 * `jellyfinOutage.*`). Un titre par état : `docker restart` passe par
 * « s'arrête » puis « redémarre — presque prêt » (mesuré : SIGTERM annonce
 * ServerShuttingDown, le chargement répond 503), `docker stop` par « est
 * arrêté ». `long` : la panne dure, l'écran d'arrêt prend la place du bandeau.
 */
const TITLES: Record<Exclude<JellyfinHealthState, "up">, string> = {
  restarting: "player:jellyfinOutage.restarting",
  "shutting-down": "player:jellyfinOutage.shuttingDown",
  down: "player:jellyfinOutage.down",
  starting: "player:jellyfinOutage.starting",
};

export interface JellyfinOutageCopy {
  titleKey: string;
  hintKey: string;
}

export function jellyfinOutageCopy(state: JellyfinHealthState, long: boolean): JellyfinOutageCopy | null {
  if (state === "up") return null;
  return long
    ? { titleKey: "player:jellyfinOutage.longTitle", hintKey: "player:jellyfinOutage.longHint" }
    : { titleKey: TITLES[state], hintKey: "player:jellyfinOutage.hint" };
}
