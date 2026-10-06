import type { JellyfinHealthState } from "../types/sessionChannelMessages";

/**
 * Ce que dit le bandeau d'un lecteur pendant une panne de Jellyfin — la même
 * phrase sur le web, le bureau, le mobile et les téléviseurs (espace `player`,
 * `jellyfinOutage.*`). Un titre par état : `docker restart` passe par
 * « s'arrête » puis « redémarre — presque prêt » (mesuré : SIGTERM annonce
 * ServerShuttingDown, le chargement répond 503), `docker stop` par « est
 * arrêté ». `long` : la panne dure, le message le dit (« ne répond toujours pas »).
 *
 * Chaque message est TEMPORAIRE, compte à rebours visible : il paraît à
 * chaque nouvelle OCCASION (un nouvel état de Jellyfin, la panne qui devient
 * longue), puis s'efface — la lecture continue sur sa réserve, et le retour
 * de Jellyfin se passe sans un mot (`jellyfinReturn.ts`).
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

/** Le temps d'un message de panne (suspendu au survol, au focus, fenêtre cachée). */
export const OUTAGE_NOTICE_MS = 10_000;
/** « Ne répond toujours pas » : le temps de lire, et de « Réessayer ». */
export const LONG_OUTAGE_NOTICE_MS = 20_000;

/** Ce qui fait reparaître un message effacé : un autre état, ou la panne devenue longue. */
export function outageNoticeOccasion(state: JellyfinHealthState, long: boolean): string {
  return `${state}:${long ? "long" : "short"}`;
}

export function outageNoticeDurationMs(long: boolean): number {
  return long ? LONG_OUTAGE_NOTICE_MS : OUTAGE_NOTICE_MS;
}
