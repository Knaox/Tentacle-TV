/**
 * Capacités du téléviseur, côté client.
 *
 * Deux chemins, dans cet ordre :
 *
 *   1. `PalmSystem` — le gestionnaire d'applications l'injecte dans toute page
 *      de l'application, y compris après la navigation vers le serveur. C'est
 *      le chemin normal, et il ne dépend d'aucune bibliothèque.
 *   2. le paramètre `?tvinfo=` posé par la coquille, en repli, pour le cas où
 *      l'injection n'aurait pas lieu.
 *
 * Le paramètre est retiré de l'URL dès qu'il est lu : le routeur ne doit pas
 * le voir passer d'écran en écran, et il n'a rien à faire dans une adresse que
 * l'utilisateur pourrait partager.
 */

export interface CapabilitiesTv {
  modelName?: string;
  /**
   * `"OLED"` sur une dalle OLED — le seul champ de capacité que LG renseigne
   * vraiment, et celui d'où `panelWebos.ts` tire la gamme quand tous les
   * booléens ci-dessous manquent.
   */
  panelType?: string;
  sdkVersion?: string;
  version?: string;
  versionMajor?: number;
  versionMinor?: number;
  uhd?: boolean;
  uhd8K?: boolean;
  oled?: boolean;
  hdr10?: boolean;
  dolbyVision?: boolean;
  dolbyAtmos?: boolean;
  screenWidth?: number;
  screenHeight?: number;
}

let capabilities: CapabilitiesTv | null = null;

function lirePalmSystem(): CapabilitiesTv | null {
  const global = window as unknown as { PalmSystem?: { deviceInfo?: string } };
  const raw = global.PalmSystem?.deviceInfo;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CapabilitiesTv;
  } catch {
    return null;
  }
}

function readParameter(): CapabilitiesTv | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("tvinfo");
  if (!raw) return null;
  try {
    const lues = JSON.parse(raw) as CapabilitiesTv;
    params.delete("tvinfo");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
    return lues;
  } catch {
    return null;
  }
}

/** À appeler une fois, avant le premier rendu. */
export function readTvCapabilities(): CapabilitiesTv {
  if (capabilities) return capabilities;
  capabilities = lirePalmSystem() ?? readParameter() ?? {};
  return capabilities;
}

/** Ce que le reste du client interroge, sans se soucier de l'origine. */
export function readTvCaps(): CapabilitiesTv {
  return capabilities ?? readTvCapabilities();
}

/** Vrai dans une application webOS, faux dans un navigateur de bureau. */
export function onTv(): boolean {
  return "PalmSystem" in window;
}
