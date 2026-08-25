/**
 * Détection de la coquille de bureau, une fois pour toutes au démarrage.
 *
 * Le résultat est figé au chargement du module : une coquille n'apparaît pas en
 * cours de session, et une détection paresseuse ouvrirait la porte aux courses
 * observées du temps de WebKitGTK, où le pont n'était pas toujours visible au
 * moment du routage.
 */

import type { DesktopKind } from "./types";

function detect(): DesktopKind | null {
  if (typeof window === "undefined") return null;

  // Electron : le preload a posé le pont AVANT tout script de la page.
  if (typeof window.tentacle === "object" && window.tentacle !== null) return "electron";

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

/** `true` uniquement dans l'app Electron. */
export function isElectronShell(): boolean {
  return kind === "electron";
}

/**
 * Plateforme réelle.
 *
 * Elle vient du processus principal (`process.platform`), donc elle est exacte.
 * Le repli sur l'analyse du user agent ne sert plus qu'au web, où il n'y a de
 * toute façon aucune capacité native à annoncer.
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

/**
 * Le montage vidéo sous Linux — `null` partout ailleurs.
 *
 * Deux mondes derrière un seul `platform: "linux"`, et ils ne promettent pas la
 * même chose : `wayland` fait le HDR mais impose la lecture en plein écran ;
 * `x11` rend la lecture fenêtrée et ne fera jamais de HDR. La valeur vient de la
 * coquille, qui seule connaît la session.
 */
export function montageLinux(): "wayland" | "x11" | null {
  return window.tentacle?.montage ?? null;
}
