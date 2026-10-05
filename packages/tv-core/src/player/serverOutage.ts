/**
 * L'état de Jellyfin dit par le SERVEUR (`server:jellyfin`) dans la reprise
 * d'une lecture — la décision, pure.
 *
 * La reprise des téléviseurs (`decideRecovery`) sonde elle-même le chemin du
 * flux : elle apprend une panne après l'arrêt de l'image, 4 s de grâce et une
 * sonde (toutes les 5 s). Le serveur, lui, la connaît dès l'annonce de
 * Jellyfin ou à la deuxième sonde manquée (mesuré : 2 ms à 3 s). Son état
 * vaut donc une sonde qui fait foi :
 *
 *  - en panne : le chemin du flux est À TERRE, Jellyfin en cause — le bandeau
 *    le dit tout de suite, la relance attend ;
 *  - de retour : le flux se relance à la position, UNE fois, même si l'image
 *    tient encore sur sa réserve (un transcodage est mort avec Jellyfin ;
 *    PrismCore aussi, au bout de sa réserve) — sauf relance toute fraîche :
 *    la sonde de la TV a pu voir le retour la première.
 */

import type { Culprit, Health } from "./playbackRecovery";

/** Une relance plus récente que ça a déjà servi le retour de Jellyfin. */
export const RETURN_RESTART_SKIP_MS = 5_000;

export interface SourceProbe {
  source: Health;
  culprit: Culprit | null;
  checkedAt: number;
  downSince: number | null;
  downWhat: Culprit | null;
}

/** Jellyfin en panne, dit par le serveur : le chemin du flux est à terre depuis la première nouvelle. */
export function serverOutageProbe(now: number, prev: { downSince: number | null; downWhat: Culprit | null }): SourceProbe {
  return { source: "down", culprit: "media", checkedAt: now, downSince: prev.downSince ?? now, downWhat: prev.downWhat ?? "media" };
}

/** Jellyfin revenu, dit par le serveur : relancer le flux ? */
export function restartOnJellyfinReturn(args: {
  now: number;
  started: boolean;
  ended: boolean;
  restarting: boolean;
  lastRestartAt: number | null;
}): boolean {
  if (!args.started || args.ended || args.restarting) return false;
  return args.lastRestartAt === null || args.now - args.lastRestartAt >= RETURN_RESTART_SKIP_MS;
}
