/**
 * L'OUVERTURE d'un transcodage qui se fait attendre — avant la première
 * image, là où `decideRecovery` se tait (l'écran d'ouverture couvre tout).
 * La décision, pure, commune aux téléviseurs ; le crochet de l'app
 * (`useStartupWait`) observe l'ouverture et l'exécute.
 *
 * Un serveur peu puissant met parfois longtemps à livrer ses premiers
 * segments : l'écran d'ouverture le dit — une ligne discrète — sans jamais
 * conclure à l'échec tant que l'ouverture progresse. Deux minutes sans rien,
 * l'échec et « Réessayer » ; le chemin du flux vu à terre, l'échec tout de
 * suite : la reprise d'ouverture (`useStartupRecovery`) dit alors qui manque
 * et relance d'elle-même à son retour. Le réseau n'est accusé que MESURÉ
 * (`networkShortfall`).
 */

import { networkShortfall, type NetworkShortfall } from "./networkShortfall";
import { NO_PROGRESS_MS, type Health } from "./playbackRecovery";

export interface StartupWaitInput {
  now: number;
  /** Le flux à ouvrir est un TRANSCODAGE du serveur (ni lecture directe, ni PrismCore). */
  transcoding: boolean;
  /** Le flux est émis depuis (null : pas encore de flux). */
  emittedAt: number | null;
  /** Dernier signe de progression de l'ouverture : le lecteur prêt, la mémoire qui grossit. */
  lastProgressAt: number | null;
  /** L'ouverture a déjà échoué : l'écran d'échec s'en charge. */
  failed: boolean;
  /** Dernière sonde du chemin du flux, et quand. */
  source: Health;
  sourceCheckedAt: number | null;
  /** Une sonde est en vol. */
  probing: boolean;
  /** Le réseau mesuré et ce que le flux demande, en b/s. */
  measuredBps: number | null;
  neededBps: number | null;
}

/** Ce que dit l'écran d'ouverture : le serveur transcode, ou le réseau ne suit pas. */
export type StartupWaitHint = { kind: "transcoding" } | { kind: "slowNetwork"; network: NetworkShortfall };

export interface StartupWaitDecision {
  hint: StartupWaitHint | null;
  probe: boolean;
  /** Conclure à l'échec de l'ouverture. */
  fail: boolean;
}

/** Une ouverture de transcodage ordinaire tient en quelques secondes ; au-delà, on le dit. */
export const STARTUP_HINT_AFTER_MS = 6_000;
/** Pendant une longue ouverture, une sonde du chemin du flux au plus toutes les… */
export const STARTUP_PROBE_EVERY_MS = 15_000;

const IDLE: StartupWaitDecision = { hint: null, probe: false, fail: false };

export function decideStartupWait(input: StartupWaitInput): StartupWaitDecision {
  const { now, emittedAt } = input;
  if (!input.transcoding || emittedAt === null || input.failed) return IDLE;
  if (now - emittedAt < STARTUP_HINT_AFTER_MS) return IDLE;

  // Une sonde d'AVANT ce flux ne dit rien de lui.
  const probed = input.sourceCheckedAt !== null && input.sourceCheckedAt >= emittedAt;
  if (probed && input.source === "down") return { hint: null, probe: false, fail: true };
  // Deux minutes sans rien : ni lecteur prêt, ni mémoire qui grossit.
  const quietSince = Math.max(emittedAt, input.lastProgressAt ?? emittedAt);
  if (now - quietSince >= NO_PROGRESS_MS) return { hint: null, probe: false, fail: true };

  const due = !probed || now - (input.sourceCheckedAt ?? 0) >= STARTUP_PROBE_EVERY_MS;
  const shortfall = networkShortfall(input.measuredBps, input.neededBps);
  return {
    hint: shortfall ? { kind: "slowNetwork", network: shortfall } : { kind: "transcoding" },
    probe: due && !input.probing,
    fail: false,
  };
}
