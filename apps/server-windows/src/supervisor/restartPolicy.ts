/**
 * Que faire quand le serveur sort ? Règle pure (horloge injectée), d'après le
 * protocole du fil A, § 4.
 *
 * - arrêt demandé par l'hôte → rien ne relance ;
 * - 75 (`RESTART`) → relance tout de suite, sans compter un échec ;
 * - 0 (`STOPPED`) sans demande → arrêté : l'icône propose de redémarrer ;
 * - échec AVANT `tentacle:ready` avec une cause connue → jamais de boucle :
 *   l'hôte dit la cause (port, autre instance, droits) ;
 * - tout le reste est un plantage : délai croissant, et passé `LOOP_LIMIT`
 *   plantages en `LOOP_WINDOW_MS`, on arrête de relancer.
 */
import { SERVER_EXIT_CODES, type StartupFailure } from "../protocol";

/** Délais successifs entre deux relances après plantage. */
export const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000] as const;
export const LOOP_WINDOW_MS = 10 * 60_000;
export const LOOP_LIMIT = 5;

/** Les causes qui bloquent sans relancer (le serveur ne repartirait pas mieux). */
export type BlockedCause = Exclude<StartupFailure, "unexpected"> | "crash_loop";

export type ExitDecision =
  | { action: "restart"; delayMs: number }
  | { action: "stopped" }
  | { action: "blocked"; cause: BlockedCause };

export interface ServerExit {
  code: number | null;
  /** L'hôte avait envoyé `tentacle:shutdown` (Quitter, changement de port…). */
  requestedByHost: boolean;
  /** `tentacle:startup-failed` reçu avant la sortie. */
  startupFailure: StartupFailure | null;
}

export class RestartPolicy {
  private crashes: number[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  decide(exit: ServerExit): ExitDecision {
    if (exit.requestedByHost) return { action: "stopped" };
    if (exit.code === SERVER_EXIT_CODES.RESTART) return { action: "restart", delayMs: 0 };
    if (exit.code === SERVER_EXIT_CODES.STOPPED) return { action: "stopped" };
    const failure = exit.startupFailure;
    if (failure !== null && failure !== "unexpected") return { action: "blocked", cause: failure };
    return this.crash();
  }

  /** Un démarrage réussi depuis longtemps efface l'ardoise (cf. `LOOP_WINDOW_MS`). */
  reset(): void {
    this.crashes = [];
  }

  private crash(): ExitDecision {
    const at = this.now();
    this.crashes = this.crashes.filter((t) => at - t < LOOP_WINDOW_MS);
    this.crashes.push(at);
    if (this.crashes.length >= LOOP_LIMIT) return { action: "blocked", cause: "crash_loop" };
    const index = Math.min(this.crashes.length - 1, BACKOFF_MS.length - 1);
    return { action: "restart", delayMs: BACKOFF_MS[index] ?? 60_000 };
  }
}
