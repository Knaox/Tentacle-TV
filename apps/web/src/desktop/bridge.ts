/**
 * Pont unique vers la couche native.
 *
 * Tout le code de `apps/web` passe par ici plutôt que d'appeler la coquille
 * directement. Le point de passage a servi à mener la migration de Tauri vers
 * Electron sans toucher aux appelants ; il reste utile pour la même raison
 * qu'avant — un seul endroit sait ce qui est sous la page.
 *
 * ⚠️ L'enveloppe `{ payload }` que rend `listen` est un héritage de Tauri.
 * Electron transmet la charge nue ; on la ré-enveloppe ici plutôt que de
 * toucher aux dizaines d'appelants qui la déballent.
 *
 * Hors application de bureau, tout est silencieux : `invoke` rejette, `listen`
 * renvoie un désabonnement inerte. C'est le contrat qu'avaient déjà les
 * appelants, qui se gardent tous par `isDesktopApp()`.
 */

import { desktopKind } from "./detect";
import type { DesktopEventHandler, Unlisten } from "./types";

export {
  desktopKind,
  desktopPlatform,
  isDesktopApp,
  isElectronShell,
  montageLinux,
} from "./detect";
export {
  supportsAppUpdates,
  supportsDownloads,
  supportsMpv,
  supportsOfflineSession,
  supportsSmtc,
} from "./capabilities";
export type { DesktopEvent, DesktopEventHandler, DesktopKind, Unlisten } from "./types";

const NOT_DESKTOP = "commande native appelée hors application de bureau";

/** Appelle une commande native. */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const kind = desktopKind();

  if (kind === "electron") {
    const bridge = window.tentacle;
    if (!bridge) throw new Error(NOT_DESKTOP);
    return (await bridge.invoke(command, args)) as T;
  }


  throw new Error(`${NOT_DESKTOP} : ${command}`);
}

/** S'abonne à un évènement natif. Renvoie le désabonnement. */
export async function listen<T>(event: string, handler: DesktopEventHandler<T>): Promise<Unlisten> {
  const kind = desktopKind();

  if (kind === "electron") {
    const bridge = window.tentacle;
    if (!bridge) return () => undefined;
    // Electron transmet la charge utile nue ; on la remet dans l'enveloppe
    // `{ payload }` attendue par tous les appelants, héritée de Tauri.
    return bridge.on(event, (payload) => handler({ payload: payload as T }));
  }


  return () => undefined;
}

/** Version RÉELLE du bundle installé — jamais la constante de build web. */
export async function getVersion(): Promise<string> {
  const kind = desktopKind();

  if (kind === "electron") {
    return window.tentacle?.version ?? "";
  }


  return "";
}

/** Redémarre l'application. Ne rend pas la main en cas de succès. */
export async function relaunch(): Promise<void> {
  const kind = desktopKind();

  if (kind === "electron") {
    await window.tentacle?.relaunch();
    return;
  }

}

/**
 * Ouvre une URL dans le navigateur du système.
 *
 * Le filtrage des schémas est fait CÔTÉ NATIF, jamais ici : une liste blanche
 * qui vit dans la page ne protège de rien.
 */
export async function openUrl(url: string): Promise<void> {
  const kind = desktopKind();

  if (kind === "electron") {
    await window.tentacle?.openExternal(url);
    return;
  }


  window.open(url, "_blank", "noopener,noreferrer");
}

/** Sélecteur de dossier natif. `null` si l'utilisateur annule. */
export async function pickFolder(): Promise<string | null> {
  const kind = desktopKind();

  if (kind === "electron") {
    return (await window.tentacle?.pickFolder()) ?? null;
  }


  return null;
}
