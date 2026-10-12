import { SHUTDOWN_TIMINGS } from "../../serverHost/hostProtocol";

/**
 * L'arrêt du serveur, UN SEUL pour tous les chemins : signal (Docker, Ctrl+C),
 * message `tentacle:shutdown` de l'hôte Windows, perte de son canal, et
 * redémarrage décidé par une extension (sortie 75). Avant, le chemin des
 * signaux attendait `app.close()` sans limite — un flux vidéo relayé le
 * retenait — et la base n'était jamais fermée.
 *
 * Ordre : tâches de fond, puis HTTP, puis la base, puis le verrou d'instance ;
 * chaque étape est bornée et une étape en échec n'empêche pas la suivante.
 * Les étapes s'inscrivent au fil du démarrage : un arrêt demandé pendant la
 * migration depuis MariaDB, avant que le HTTP existe, fait le reste.
 */
export interface ShutdownSteps {
  stopBackgroundWork: () => Promise<void> | void;
  closeHttp: () => Promise<unknown>;
  closeDatabase: () => Promise<void>;
  releaseLock: () => void;
}

export type ShutdownTimings = Pick<typeof SHUTDOWN_TIMINGS, "backgroundStopMs" | "httpCloseMs" | "databaseCloseMs">;

export interface ServerShutdown {
  /** Inscrit (ou remplace) des étapes ; une étape absente est sautée. */
  register: (steps: Partial<ShutdownSteps>) => void;
  /** Idempotent : un second appel pendant l'arrêt rend la même promesse, sans changer le code. */
  run: (exitCode: number, reason: string) => Promise<void>;
  isRunning: () => boolean;
}

/** `true` si l'étape a fini, `false` si le plafond l'a coupée. */
async function within(step: () => Promise<unknown> | unknown, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(step).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createServerShutdown(
  exit: (code: number) => void,
  timings: ShutdownTimings = SHUTDOWN_TIMINGS,
  log: (line: string) => void = (line) => console.log(line),
): ServerShutdown {
  const steps: Partial<ShutdownSteps> = {};
  let running: Promise<void> | null = null;

  const step = async (name: string, fn: (() => Promise<unknown> | unknown) | undefined, ms: number) => {
    if (!fn) return;
    try {
      if (!(await within(fn, ms))) log(`[Arrêt] ${name} : plafond de ${ms} ms atteint, on continue`);
    } catch (error) {
      log(`[Arrêt] ${name} en échec : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const sequence = async (exitCode: number, reason: string) => {
    log(`[Arrêt] ${reason} — arrêt propre (sortie ${exitCode})`);
    await step("tâches de fond", steps.stopBackgroundWork, timings.backgroundStopMs);
    await step("fermeture HTTP", steps.closeHttp, timings.httpCloseMs);
    await step("fermeture de la base", steps.closeDatabase, timings.databaseCloseMs);
    try {
      steps.releaseLock?.();
    } catch {
      /* le système rend le verrou à la sortie, de toute façon */
    }
    exit(exitCode);
  };

  return {
    register: (more) => {
      Object.assign(steps, more);
    },
    run: (exitCode, reason) => {
      running ??= sequence(exitCode, reason);
      return running;
    },
    isRunning: () => running !== null,
  };
}

/** L'arrêt du processus. */
export const serverShutdown = createServerShutdown((code) => process.exit(code));

/**
 * Les signaux d'arrêt. Sous Windows s'ajoutent SIGBREAK (Ctrl+Pause) et SIGHUP
 * (console fermée, que Node émule) ; sous Linux SIGHUP garde son sens — un
 * serveur lancé par `nohup` ne doit pas s'arrêter à la fermeture du terminal.
 */
export function shutdownSignals(platform: NodeJS.Platform = process.platform): NodeJS.Signals[] {
  return platform === "win32" ? ["SIGTERM", "SIGINT", "SIGBREAK", "SIGHUP"] : ["SIGTERM", "SIGINT"];
}

/** Un signal mène à l'arrêt propre ; le même signal une seconde fois tue (`once`), comme avant. */
export function listenForShutdownSignals(shutdown: ServerShutdown = serverShutdown, exitCode = 0): void {
  for (const signal of shutdownSignals()) {
    process.once(signal, () => {
      void shutdown.run(exitCode, signal);
    });
  }
}
