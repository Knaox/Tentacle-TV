/**
 * Pont unique vers la couche native. Route vers Tauri ou Electron.
 *
 * Tout le code de `apps/web` passe par ici plutôt que d'importer
 * `@tauri-apps/*` directement. Deux raisons :
 *
 *  1. La même interface est servie par deux applications de bureau pendant la
 *     migration. Sans ce point de passage, il faudrait deux frontends.
 *  2. Le chemin Tauri reste STRICTEMENT identique à ce qu'il était : mêmes
 *     imports dynamiques, mêmes noms de commandes, mêmes évènements. L'app
 *     Tauri livre encore macOS et Linux, elle ne doit rien voir changer.
 *
 * Hors application de bureau, tout est silencieux : `invoke` rejette, `listen`
 * renvoie un désabonnement inerte. C'est le contrat qu'avaient déjà les
 * appelants, qui se gardent tous par `isDesktopApp()`.
 */

import { desktopKind } from "./detect";
import type { DesktopEventHandler, Unlisten } from "./types";

export { desktopKind, desktopPlatform, isDesktopApp, isElectronShell, isTauriShell } from "./detect";
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

  if (kind === "tauri") {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke<T>(command, args);
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

  if (kind === "tauri") {
    const { listen: tauriListen } = await import("@tauri-apps/api/event");
    return await tauriListen<T>(event, (e) => handler({ payload: e.payload }));
  }

  return () => undefined;
}

/** Version RÉELLE du bundle installé — jamais la constante de build web. */
export async function getVersion(): Promise<string> {
  const kind = desktopKind();

  if (kind === "electron") {
    return window.tentacle?.version ?? "";
  }

  if (kind === "tauri") {
    const { getVersion: tauriGetVersion } = await import("@tauri-apps/api/app");
    return await tauriGetVersion();
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

  if (kind === "tauri") {
    const { relaunch: tauriRelaunch } = await import("@tauri-apps/plugin-process");
    await tauriRelaunch();
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

  if (kind === "tauri") {
    const { openUrl: tauriOpenUrl } = await import("@tauri-apps/plugin-opener");
    await tauriOpenUrl(url);
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

  if (kind === "tauri") {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({ directory: true, multiple: false });
    return typeof chosen === "string" ? chosen : null;
  }

  return null;
}
