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
 *  - de retour : le retour est TRANSPARENT (la règle des six lecteurs, shared
 *    `jellyfinReturn.ts`). L'image qui tient sur sa réserve continue, rien
 *    ne se relance — le serveur redit la lecture à Jellyfin. Le flux ne se
 *    relance tout de suite que s'il a été PERDU pendant la panne (une erreur
 *    confiée à la reprise) ; une image arrêtée, au bout de sa réserve, suit
 *    le chemin ordinaire de `decideRecovery` (grâce, chemin qui répond,
 *    relance immédiate : la panne vue la rend mûre) — un transcodage que
 *    Jellyfin ne reprend pas, PrismCore au bout de sa réserve aussi. Jamais
 *    sur une relance toute fraîche : la sonde de la TV a pu voir le retour la
 *    première.
 */

import { decideJellyfinReturn } from "@tentacle-tv/shared";
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

/** Jellyfin revenu, dit par le serveur : relancer le flux tout de suite ? */
export function restartOnJellyfinReturn(args: {
  now: number;
  started: boolean;
  ended: boolean;
  restarting: boolean;
  lastRestartAt: number | null;
  /** Le lecteur a perdu sa source pendant la panne (erreur confiée à la reprise). */
  lost: boolean;
}): boolean {
  if (!args.started || args.ended || args.restarting) return false;
  if (decideJellyfinReturn({ started: true, failedDuringOutage: args.lost }) === "resume") return false;
  return args.lastRestartAt === null || args.now - args.lastRestartAt >= RETURN_RESTART_SKIP_MS;
}
