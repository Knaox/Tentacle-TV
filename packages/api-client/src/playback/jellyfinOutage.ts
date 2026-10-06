import type { JellyfinHealthState } from "@tentacle-tv/shared";
import type { JellyfinHealth } from "../socket/jellyfinHealth";

/**
 * Ce qu'un lecteur fait d'une panne de Jellyfin — la règle des six lecteurs
 * (web, bureau, mobile iOS et Android, Apple TV, Android TV), pure.
 *
 *  - `outage` : un bandeau dit l'état (« Jellyfin redémarre… »), la lecture
 *    directe continue sur son tampon, et AUCUN détecteur de problème ne
 *    parle : une erreur de flux pendant une panne n'a qu'une cause, déjà dite.
 *  - `long` : la panne dure (`LONG_OUTAGE_MS`) — un message avec
 *    « Réessayer », la position gardée.
 *  - `recovering` : Jellyfin est revenu (`recoveries` a changé) ; la lecture
 *    continue sans rien recharger, sauf s'il le faut (shared
 *    `jellyfinReturn.ts`) ; les détecteurs se taisent encore
 *    `RECOVERY_GRACE_MS`, le temps que le flux se reconnecte.
 *
 * Les messages sont temporaires (`useOutageNotice`).
 */

export const LONG_OUTAGE_MS = 180_000;
export const RECOVERY_GRACE_MS = 15_000;

export type OutagePhase = "none" | "outage" | "long" | "recovering";

export interface OutageView {
  phase: OutagePhase;
  state: JellyfinHealthState;
  /** Les détecteurs d'erreur et de blocage du lecteur se taisent. */
  suppressErrors: boolean;
  /** Change à chaque retour de Jellyfin : la clé de relance du flux. */
  recoveries: number;
  /** Dans combien de ms la vue change d'elle-même (`null` : jamais). */
  nextChangeInMs: number | null;
}

/**
 * Depuis quand la panne dure, en heure locale : le plus ancien de « appris
 * ici » et du début dit par le serveur, ramené à l'horloge locale quand le
 * décalage est connu (un lecteur qui se connecte EN pleine panne).
 */
function outageStart(health: JellyfinHealth, clockOffsetMs: number | null): number | null {
  if (health.outageSeenAt === null) return null;
  if (clockOffsetMs === null) return health.outageSeenAt;
  return Math.min(health.outageSeenAt, health.since - clockOffsetMs);
}

export function outageView(health: JellyfinHealth, now: number, clockOffsetMs: number | null = null): OutageView {
  const base = { state: health.state, recoveries: health.recoveries };
  if (health.state !== "up") {
    const start = outageStart(health, clockOffsetMs) ?? now;
    const elapsed = Math.max(0, now - start);
    return elapsed >= LONG_OUTAGE_MS
      ? { ...base, phase: "long", suppressErrors: true, nextChangeInMs: null }
      : { ...base, phase: "outage", suppressErrors: true, nextChangeInMs: LONG_OUTAGE_MS - elapsed };
  }
  const sinceRecovery = health.recoveredAt === null ? Infinity : now - health.recoveredAt;
  if (sinceRecovery < RECOVERY_GRACE_MS) {
    return { ...base, phase: "recovering", suppressErrors: true, nextChangeInMs: RECOVERY_GRACE_MS - sinceRecovery };
  }
  return { ...base, phase: "none", suppressErrors: false, nextChangeInMs: null };
}

/**
 * Le voile plein écran « serveur injoignable » (web, mobile) cède-t-il au
 * message du lecteur ? Oui quand le lecteur est ouvert et que c'est Jellyfin
 * seul qui manque, une panne DITE par le serveur (reprise comprise) : le
 * voile recouvrirait une image qui joue encore sur sa réserve, et le message
 * temporaire du lecteur dit déjà la cause. Le serveur Tentacle lui-même
 * injoignable, ou un serveur qui ne dit rien de Jellyfin : le voile, comme avant.
 */
export function veilYieldsToPlayer(p: { playerOpen: boolean; reason: string | null; phase: OutagePhase }): boolean {
  return p.playerOpen && p.reason === "jellyfin" && p.phase !== "none";
}
