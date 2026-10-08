import { existsSync, unlinkSync, writeFileSync } from "fs";
import { failureOf, type MigrationFailureReason } from "./migrationErrors";
import { migrationFailed, migrationFinished, migrationStarted, publicDatabaseState } from "./migrationState";
import { refuseSymlink, restrictToOwner } from "./migrationFiles";
import type { MigrationOutcome } from "./runMigration";

/**
 * Les ESSAIS de migration, jusqu'à réussite : au démarrage, puis avec un délai
 * croissant (30 s, 1 min, 2 min, 5 min, 10 min, puis toutes les 15 min) — et
 * tout de suite quand `tentacle db migrate` le demande (fichier déclencheur).
 * MariaDB reste intacte d'un essai à l'autre ; l'écran d'attente dit l'échec,
 * sobrement, et le prochain essai.
 *
 * Un fichier d'état (0600, dossier de données) dit à la CLI où en est l'essai
 * en cours : la CLI tourne dans un AUTRE processus (`docker exec`).
 */
export const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 900_000];

/** Le battement du fichier d'état pendant l'attente d'un essai : la CLI juge un serveur vivant à sa fraîcheur. */
export const STATUS_HEARTBEAT_MS = 10_000;
/** Au-delà, un fichier d'état n'atteste plus d'un serveur vivant (un PID réutilisé ne trompe plus la CLI). */
export const STATUS_STALE_MS = 2 * 60_000;

export interface MigrationStatusFile {
  state: "migrating" | "failed" | "done";
  /** Le processus qui mène les essais : la CLI lui demande un essai s'il vit, sinon migre elle-même. */
  pid?: number;
  attempt: number;
  updatedAt: number;
  percent: number;
  reason?: MigrationFailureReason;
  /** Pour l'administrateur qui lit le fichier sur la machine : noms de tables et comptes seulement. */
  detail?: string;
  retryAt?: number;
  summary?: { tables: number; rows: number; durationMs: number };
}

export function writeStatusFile(path: string, status: MigrationStatusFile): void {
  try {
    refuseSymlink(path);
    writeFileSync(path, `${JSON.stringify({ pid: process.pid, ...status })}\n`, { mode: 0o600 });
    restrictToOwner(path);
  } catch {
    /* le fichier d'état n'est qu'une aide à la CLI */
  }
}

export interface LoopOptions {
  statusFile: string;
  triggerFile: string;
  log: (line: string) => void;
  delays?: number[];
  /** Attente interrompable (tests) : par défaut, une vérification du déclencheur par seconde. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Attend `ms`, ou moins si le déclencheur apparaît (il est alors consommé) ; bat toutes les 10 s. */
async function waitForRetry(ms: number, options: LoopOptions, heartbeat: () => void): Promise<"timeout" | "trigger"> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((d: number) => new Promise<void>((r) => setTimeout(r, d)));
  const until = now() + ms;
  let beat = now();
  while (now() < until) {
    if (now() - beat >= STATUS_HEARTBEAT_MS) {
      beat = now();
      heartbeat();
    }
    if (existsSync(options.triggerFile)) {
      try {
        unlinkSync(options.triggerFile);
      } catch {
        /* déjà consommé */
      }
      return "trigger";
    }
    await sleep(Math.min(1000, Math.max(0, until - now())));
  }
  return "timeout";
}

export async function migrateUntilDone(run: () => Promise<MigrationOutcome>, options: LoopOptions): Promise<MigrationOutcome> {
  const now = options.now ?? Date.now;
  const delays = options.delays ?? RETRY_DELAYS_MS;
  for (let attempt = 1; ; attempt++) {
    migrationStarted(now());
    writeStatusFile(options.statusFile, { state: "migrating", attempt, updatedAt: now(), percent: 0 });
    // Un déclencheur posé avant cet essai n'a plus d'objet.
    if (existsSync(options.triggerFile)) unlinkSync(options.triggerFile);
    try {
      const outcome = await run();
      migrationFinished();
      const summary =
        outcome.kind === "migrated"
          ? { tables: outcome.report.tables.length, rows: outcome.report.rowsWritten, durationMs: outcome.report.durationMs }
          : { tables: 0, rows: 0, durationMs: 0 };
      writeStatusFile(options.statusFile, { state: "done", attempt, updatedAt: now(), percent: 100, summary });
      return outcome;
    } catch (err) {
      const failure = failureOf(err);
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      const retryAt = now() + delay;
      migrationFailed(failure.reason, retryAt);
      options.log(
        `[db-migration] Essai ${attempt} sans succès (${failure.reason}) : ${failure.detail}. MariaDB est intacte. ` +
          `Nouvel essai dans ${Math.round(delay / 1000)} s (ou tout de suite : tentacle db migrate).`,
      );
      const failed: MigrationStatusFile = {
        state: "failed",
        attempt,
        updatedAt: now(),
        percent: publicDatabaseState().progress?.percent ?? 0,
        reason: failure.reason,
        detail: failure.detail,
        retryAt,
      };
      writeStatusFile(options.statusFile, failed);
      await waitForRetry(delay, options, () => writeStatusFile(options.statusFile, { ...failed, updatedAt: now() }));
    }
  }
}
