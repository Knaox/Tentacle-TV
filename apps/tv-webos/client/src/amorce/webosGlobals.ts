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

export interface CapacitesTeleviseur {
  modelName?: string;
  /**
   * `"OLED"` sur une dalle OLED — le seul champ de capacité que LG renseigne
   * vraiment, et celui d'où `dalleWebos.ts` tire la gamme quand tous les
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

let capacites: CapacitesTeleviseur | null = null;

function lirePalmSystem(): CapacitesTeleviseur | null {
  const global = window as unknown as { PalmSystem?: { deviceInfo?: string } };
  const brut = global.PalmSystem?.deviceInfo;
  if (!brut) return null;
  try {
    return JSON.parse(brut) as CapacitesTeleviseur;
  } catch {
    return null;
  }
}

function lireParametre(): CapacitesTeleviseur | null {
  const parametres = new URLSearchParams(window.location.search);
  const brut = parametres.get("tvinfo");
  if (!brut) return null;
  try {
    const lues = JSON.parse(brut) as CapacitesTeleviseur;
    parametres.delete("tvinfo");
    const requete = parametres.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (requete ? `?${requete}` : "") + window.location.hash,
    );
    return lues;
  } catch {
    return null;
  }
}

/** À appeler une fois, avant le premier rendu. */
export function lireCapacitesTeleviseur(): CapacitesTeleviseur {
  if (capacites) return capacites;
  capacites = lirePalmSystem() ?? lireParametre() ?? {};
  return capacites;
}

/** Ce que le reste du client interroge, sans se soucier de l'origine. */
export function capacitesTeleviseur(): CapacitesTeleviseur {
  return capacites ?? lireCapacitesTeleviseur();
}

/** Vrai dans une application webOS, faux dans un navigateur de bureau. */
export function surTeleviseur(): boolean {
  return "PalmSystem" in window;
}
