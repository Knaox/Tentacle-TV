/**
 * Préférence « basculer l'écran en HDR pendant la lecture ».
 *
 * # Pourquoi c'est une option, et pourquoi elle est éteinte par défaut
 *
 * Changer le mode d'un écran coûte une à deux secondes de noir, le temps que
 * la liaison se resynchronise. Tous les lecteurs qui le proposent — madVR,
 * Kodi, Plex — en font une option, et Plex la laisse éteinte pour cette
 * raison. Sans bascule, mpv retombe sur le tone-mapping, qui donne une image
 * correcte sur un écran SDR.
 *
 * L'autre écueil justifie tout autant le choix : un écran laissé en HDR fait
 * paraître délavé TOUT le contenu SDR de Windows — le bureau, le navigateur,
 * l'application hors lecture.
 */

import { invoke, isDesktopApp } from "../desktop/bridge";

const KEY = "tentacle_hdr_auto";

/** L'utilisateur a-t-il demandé la bascule ? Éteinte par défaut. */
export function hdrAutoActive(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Enregistre la préférence et la transmet immédiatement au natif. */
export function setHdrAuto(active: boolean): void {
  try {
    localStorage.setItem(KEY, active ? "1" : "0");
  } catch {
    /* stockage indisponible : la préférence ne survivra pas, tant pis */
  }
  void pushHdrAuto();
}

/**
 * Transmet la préférence au processus natif.
 *
 * À appeler à l'initialisation du lecteur : c'est le natif qui lit le gamma du
 * média dès son ouverture et parle à Windows, mais c'est la page qui connaît la
 * préférence. Silencieux hors application de bureau, et silencieux si la
 * commande n'existe pas encore — le lecteur ne doit pas échouer pour ça.
 */
export async function pushHdrAuto(): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    await invoke("display_hdr_auto", { on: hdrAutoActive() });
  } catch {
    /* coquille sans cette commande : la bascule reste simplement inactive */
  }
}
