/**
 * Le blocage que `powerSaveBlocker` ne pose PAS sous Linux.
 *
 * # Ce qui manque, mesuré
 *
 * Sous Wayland, Chromium tient l'écran éveillé par `zwp_idle_inhibit_v1` — un
 * protocole du compositeur, pas un service du système. Relevé le 25.08.2026 sur
 * KDE Plasma 6.7.4, `powerSaveBlocker.isStarted()` répondant `true` pour les
 * deux blocages :
 *
 *     systemd-inhibit --list                        → aucune ligne à nous
 *     org.kde.Solid.PowerManagement.PolicyAgent
 *       ListInhibitions                             → aas 0 (aucune inhibition)
 *
 * L'écran ne s'éteint pas, et c'est déjà l'essentiel. Mais **rien ne retient
 * logind** : sur une machine réglée avec `IdleAction=suspend`, ou devant un
 * `systemctl suspend` d'un gestionnaire de session minimal, un film de deux
 * heures sans une touche pressée se fait endormir. L'app Tauri avait raison
 * d'ajouter ce verrou-là (`linux/sleep_inhibit.rs`).
 *
 * # Pourquoi `systemd-inhibit` et pas D-Bus
 *
 * L'inhibiteur de logind est un DESCRIPTEUR DE FICHIER : il vit tant qu'on le
 * tient ouvert, et se libère à sa fermeture — y compris si l'application meurt
 * brutalement, ce qui est exactement la propriété qu'on veut. `systemd-inhibit`
 * est l'outil que systemd fournit pour cela, il est présent partout où logind
 * l'est, et il évite une bibliothèque D-Bus entière pour un seul appel. Un
 * processus fils, tué à la libération : le noyau referme le descripteur.
 *
 * Sur une distribution sans systemd — Artix, Void, Alpine — la commande n'existe
 * pas et le renfort s'efface sans bruit. Il n'y a alors rien à inhiber.
 */

import { spawn } from "node:child_process";
import type { WakeLock } from "../powerSave";

/** Un processus fils, réduit à ce qu'on lui demande. */
export interface ChildProcess {
  kill(): void;
  /** A-t-il déjà rendu la main ? */
  done(): boolean;
}

/** De quoi lancer `systemd-inhibit`, injecté pour rester vérifiable. */
export type Launcher = (command: string, args: readonly string[]) => ChildProcess | null;

const WHO = "Tentacle TV";
const WHY = "Lecture vidéo en cours";

/**
 * Le renfort logind. `prevent` est idempotent, `release` toujours sûr.
 *
 * `idle:sleep` couvre les deux chemins par lesquels la machine s'endort : le
 * délai d'inactivité, et une demande de veille explicite.
 */
export function createLogindBackup(launch: Launcher): WakeLock {
  let child: ChildProcess | null = null;
  return {
    prevent(): void {
      if (child !== null && !child.done()) return;
      child = launch("systemd-inhibit", [
        "--what=idle:sleep",
        `--who=${WHO}`,
        `--why=${WHY}`,
        "--mode=block",
        // Un processus qui ne fait rien et qu'on tue : c'est le descripteur
        // qu'il tient ouvert qui compte, pas ce qu'il exécute.
        "sleep",
        "infinity",
      ]);
    },
    release(): void {
      if (child === null) return;
      if (!child.done()) child.kill();
      child = null;
    },
  };
}

/** Deux veilles vues comme une seule — ni l'une ni l'autre ne doit être oubliée. */
export function combine(...wakeLocks: readonly WakeLock[]): WakeLock {
  return {
    prevent: () => wakeLocks.forEach((v) => { v.prevent(); }),
    release: () => wakeLocks.forEach((v) => { v.release(); }),
  };
}

/**
 * Le lanceur réel. Rend `null` là où `systemd-inhibit` n'existe pas.
 *
 * `detached: false` est délibéré : le fils doit mourir avec nous si nous mourons
 * mal — c'est ce qui garantit que l'inhibiteur ne survit jamais à
 * l'application. `stdio: "ignore"` évite qu'un tampon jamais lu ne se remplisse.
 */
export const systemLauncher: Launcher = (command, args) => {
  try {
    const child = spawn(command, [...args], { stdio: "ignore", detached: false });
    let done = false;
    child.on("error", () => { done = true; });
    child.on("exit", () => { done = true; });
    return {
      kill: () => { child.kill("SIGTERM"); },
      done: () => done,
    };
  } catch {
    return null;
  }
};
