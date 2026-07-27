/**
 * Le moteur de téléchargement du processus principal, et ce qui l'entoure.
 *
 * C'est ici, et seulement ici, qu'on demande à Electron où vit le dossier de
 * données et qu'on relie le moteur au vrai réseau — tout `downloads/` est resté
 * sans dépendance à Electron, et c'est ce qui l'a rendu testable.
 */

import { app } from "electron";
import { DownloadEngine } from "./downloads/engine";
import { heal } from "./downloads/heal";
import { makeFetcher } from "./downloads/netFetch";
import { resolveRoot } from "./downloads/paths";
import { purgeDueClaims } from "./downloads/purge";
import { electronTransferNet } from "./downloads/transferNet";
import type { Creds } from "./downloads/worker";
import { localDb } from "./localDb";
import { sendToPage } from "./pageEvents";

/** Tour de purge, comme côté Rust. */
const PURGE_TICK_MS = 60_000;

let engine: DownloadEngine | null = null;
let purgeTimer: ReturnType<typeof setInterval> | null = null;

/** Racine de téléchargement effective. */
export function downloadsRoot(): string {
  return resolveRoot(localDb(), app.getPath("userData"));
}

/** Le moteur, construit au premier appel. */
export function downloadsEngine(): DownloadEngine {
  if (engine !== null) return engine;
  engine = new DownloadEngine({
    db: localDb(),
    root: downloadsRoot,
    net: electronTransferNet,
    makeFetcher,
    emit: sendToPage,
    now: () => Date.now(),
    onStarted: (creds) => {
      demarrerPurgePeriodique();
      lancerReparation(creds);
    },
  });
  return engine;
}

/**
 * Purge des échéances d'auto-suppression.
 *
 * Première itération IMMÉDIATE : c'est elle qui rattrape ce qui est arrivé à
 * échéance pendant que l'application était fermée. Puis un tour par minute.
 * `Once` de fait — un moteur redémarré (reconnexion) ne pose pas un second
 * minuteur.
 */
function demarrerPurgePeriodique(): void {
  if (purgeTimer !== null) return;
  const tour = (): void => {
    try {
      if (purgeDueClaims(localDb(), downloadsRoot(), Date.now(), null) > 0) {
        sendToPage("downloads://changed", undefined);
      }
    } catch {
      // Racine sur un disque débranché : on retentera dans une minute.
    }
  };
  tour();
  purgeTimer = setInterval(tour, PURGE_TICK_MS);
  // Le minuteur ne doit pas retenir le processus à la fermeture.
  purgeTimer.unref?.();
}

/** Réparation en tâche de fond, jamais attendue. */
function lancerReparation(creds: Creds): void {
  void heal(makeFetcher(creds.token), localDb(), creds.serverUrl, downloadsRoot(), Date.now())
    .then((repares) => {
      if (repares > 0) sendToPage("downloads://changed", undefined);
    })
    .catch(() => {
      // Best-effort : elle repassera au prochain démarrage.
    });
}

/** Arrête le minuteur de purge. À l'extinction. */
export function stopDownloadsRuntime(): void {
  if (purgeTimer !== null) clearInterval(purgeTimer);
  purgeTimer = null;
}
