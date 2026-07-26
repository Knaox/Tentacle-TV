/**
 * Détection du shell de bureau, une fois pour toutes au démarrage.
 *
 * Le résultat est figé au chargement du module : ni Tauri ni Electron
 * n'apparaissent en cours de session, et une détection paresseuse ouvrirait
 * la porte aux courses observées sur WebKitGTK (cf. `mpvRuntime.isTauri`,
 * où `__TAURI_INTERNALS__` pouvait n'être pas encore visible au routage).
 */

import type { DesktopKind } from "./types";

function detect(): DesktopKind | null {
  if (typeof window === "undefined") return null;

  // Electron : le preload a posé le pont AVANT tout script de la page.
  if (typeof window.tentacle === "object" && window.tentacle !== null) return "electron";

  // Tauri : trois signaux, comme l'ancien `isTauriApp`. Sur certaines
  // webviews Linux, `__TAURI_INTERNALS__` peut manquer au premier examen —
  // d'où les deux replis, conservés à l'identique.
  if ("__TAURI_INTERNALS__" in window) return "tauri";
  if ("__TAURI__" in window) return "tauri";
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Tauri")) return "tauri";

  return null;
}

const kind: DesktopKind | null = detect();

/** Shell détecté, ou `null` sur le web. */
export function desktopKind(): DesktopKind | null {
  return kind;
}

/** `true` dans l'app de bureau, quel que soit le shell. */
export function isDesktopApp(): boolean {
  return kind !== null;
}

/** `true` uniquement dans l'app Tauri (macOS, Linux pendant la migration). */
export function isTauriShell(): boolean {
  return kind === "tauri";
}

/** `true` uniquement dans l'app Electron. */
export function isElectronShell(): boolean {
  return kind === "electron";
}

/**
 * Plateforme réelle.
 *
 * Sous Electron elle vient du processus principal, donc elle est exacte.
 * Sous Tauri on garde l'analyse du user agent, faute de mieux — c'est ce que
 * faisait déjà `mpvRuntime`.
 */
export type DesktopPlatform = "windows" | "macos" | "linux" | "web";

export function desktopPlatform(): DesktopPlatform {
  // Hors application de bureau, la réponse est « web » et rien d'autre. Le
  // système d'exploitation sous le navigateur ne regarde personne ici : un
  // Chrome sous Windows n'a pas les capacités natives de Windows, et laisser
  // filtrer « windows » ferait croire à ses appelants qu'il les a.
  if (kind === null) return "web";

  if (kind === "electron") {
    const p = window.tentacle?.platform;
    if (p === "win32") return "windows";
    if (p === "darwin") return "macos";
    if (p === "linux") return "linux";
  }
  if (typeof navigator === "undefined") return "web";
  if (navigator.platform?.startsWith("Mac") || /Macintosh|Mac OS X/i.test(navigator.userAgent)) {
    return "macos";
  }
  if (navigator.platform?.startsWith("Win") || /Windows NT/i.test(navigator.userAgent)) {
    return "windows";
  }
  return "linux";
}
