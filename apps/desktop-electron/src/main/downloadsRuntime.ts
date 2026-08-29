/**
 * Le moteur de téléchargement du processus principal, et ce qui l'entoure.
 *
 * C'est ici, et seulement ici, qu'on demande à Electron où vit le dossier de
 * données et qu'on relie le moteur au vrai réseau — tout `downloads/` est resté
 * sans dépendance à Electron, et c'est ce qui l'a rendu testable.
 */

import { app, powerMonitor, powerSaveBlocker } from "electron";
import { DownloadEngine } from "./downloads/engine";
import { heal } from "./downloads/heal";
import { makeFetcher } from "./downloads/netFetch";
import { resolveRoot } from "./downloads/paths";
import { purgeDueClaims } from "./downloads/purge";
import { electronTransferNet } from "./downloads/transferNet";
import type { Creds } from "./downloads/worker";
import { localDb } from "./localDb";
import { sendToPage } from "./pageEvents";
import { createSystemWakeLock } from "./powerSave";
import { combine, createLogindBackup, systemLauncher } from "./linux/logindInhibitor";

/** Tour de purge, comme côté Rust. */
const PURGE_TICK_MS = 60_000;

let engine: DownloadEngine | null = null;
let purgeTimer: ReturnType<typeof setInterval> | null = null;
let wakeConnected = false;

/**
 * Anti-suspension du système, posée tant qu'un transfert tourne.
 *
 * C'est ce qui fait tenir la promesse « les téléchargements continuent en
 * arrière-plan » : le moteur vit dans le processus principal, rien ne l'arrête
 * quand la fenêtre passe derrière — mais si l'utilisateur s'éloigne, Windows
 * endort le PC au bout de son délai d'inactivité et coupe le flux. L'écran, lui,
 * reste libre de s'éteindre.
 */
const systemWakeLock =
  process.platform === "linux"
    ? combine(createSystemWakeLock(powerSaveBlocker), createLogindBackup(systemLauncher))
    : createSystemWakeLock(powerSaveBlocker);

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
    onBusy: (busy) => {
      if (busy) systemWakeLock.prevent();
      else systemWakeLock.release();
    },
    onStarted: (creds) => {
      startPeriodicPurge();
      connectWake();
      runHeal(creds);
    },
  });
  return engine;
}

/**
 * Transferts qui ne sont pas finis, pour la garde de sortie.
 *
 * Ne CONSTRUIT PAS le moteur : pas de moteur, pas de transfert possible, et on
 * n'ouvre pas la base de données juste pour répondre à une fermeture de
 * fenêtre.
 */
export function transfersInFlight(): number {
  try {
    return engine?.pending() ?? 0;
  } catch {
    // Base indisponible : on ne retient pas la fermeture sur un doute.
    return 0;
  }
}

/**
 * Reprise au réveil de veille.
 *
 * L'anti-suspension repousse la veille d'INACTIVITÉ, pas celle que
 * l'utilisateur déclenche lui-même — rabattre l'écran, choisir « Mettre en
 * veille ». Le flux est alors coupé, le moteur classe ça en pause SYSTÈME, et
 * seul `start` la rattrapait : le téléchargement restait à l'arrêt jusqu'au
 * prochain lancement de l'application. `Once` de fait, comme la purge.
 */
function connectWake(): void {
  if (wakeConnected) return;
  wakeConnected = true;
  powerMonitor.on("resume", () => {
    engine?.resumeSystemPauses();
  });
}

/**
 * Purge des échéances d'auto-suppression.
 *
 * Première itération IMMÉDIATE : c'est elle qui rattrape ce qui est arrivé à
 * échéance pendant que l'application était fermée. Puis un tour par minute.
 * `Once` de fait — un moteur redémarré (reconnexion) ne pose pas un second
 * minuteur.
 */
function startPeriodicPurge(): void {
  if (purgeTimer !== null) return;
  const tick = (): void => {
    try {
      if (purgeDueClaims(localDb(), downloadsRoot(), Date.now(), null) > 0) {
        sendToPage("downloads://changed", undefined);
      }
    } catch {
      // Racine sur un disque débranché : on retentera dans une minute.
    }
  };
  tick();
  purgeTimer = setInterval(tick, PURGE_TICK_MS);
  // Le minuteur ne doit pas retenir le processus à la fermeture.
  purgeTimer.unref?.();
}

/** Réparation en tâche de fond, jamais attendue. */
function runHeal(creds: Creds): void {
  void heal(makeFetcher(creds.token), localDb(), creds.serverUrl, downloadsRoot(), Date.now())
    .then((healed) => {
      if (healed > 0) sendToPage("downloads://changed", undefined);
    })
    .catch(() => {
      // Best-effort : elle repassera au prochain démarrage.
    });
}

/** Arrête le minuteur de purge et rend l'anti-suspension. À l'extinction. */
export function stopDownloadsRuntime(): void {
  if (purgeTimer !== null) clearInterval(purgeTimer);
  purgeTimer = null;
  // Même devoir que l'anti-veille de l'écran (`releaseDisplayWakeLock`) : un blocage
  // laissé actif tient jusqu'à la fin du processus.
  systemWakeLock.release();
}
