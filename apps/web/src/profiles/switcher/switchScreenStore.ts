import { useSyncExternalStore } from "react";

/**
 * « Changer de profil » : l'écran « Qui regarde ? » posé sur l'application
 * déjà lancée (`WhoIsWatchingHost`), ouvert depuis le menu de l'avatar ou la
 * feuille de la fenêtre étroite. Un seul à la fois. Ses phases :
 *
 * - `closed` : rien n'est monté — aucune requête, aucun coût ;
 * - `opening` : l'écran paraît en fondu, PAR-DESSUS la page ;
 * - `shown` : l'écran couvre tout, et la coquille dessous n'est plus peinte
 *   (`AppLayout` : `visibility: hidden`, sa mise en page et son défilement
 *   intacts — Annuler la rend telle quelle) ;
 * - `closing` : la page est rendue, l'écran s'efface dessus ; puis le focus
 *   revient d'où l'on était parti (l'avatar).
 */
export type SwitchScreenPhase = "closed" | "opening" | "shown" | "closing";

let phase: SwitchScreenPhase = "closed";
let returnFocus: HTMLElement | null = null;
const listeners = new Set<() => void>();

function setPhase(next: SwitchScreenPhase): void {
  phase = next;
  for (const listener of listeners) listener();
}

/** Ouvrir l'écran ; `from` reprend le focus quand il se referme. */
export function openSwitchScreen(from: HTMLElement | null = null): void {
  if (phase !== "closed") return;
  returnFocus = from;
  setPhase("opening");
}

/** Annuler, Échap, le profil en cours choisi, « Gérer les profils » : l'écran s'efface. */
export function closeSwitchScreen(): void {
  if (phase === "opening" || phase === "shown") setPhase("closing");
}

/** La fin d'un fondu : l'écran couvre tout, ou il est parti (le focus revient alors). */
export function settleSwitchScreen(): void {
  if (phase === "opening") {
    setPhase("shown");
    return;
  }
  if (phase !== "closing") return;
  const target = returnFocus;
  returnFocus = null;
  setPhase("closed");
  if (target?.isConnected) target.focus({ preventScroll: true });
}

/** La coquille démontée (déconnexion…) : rien ne doit rester ouvert pour la suivante. */
export function resetSwitchScreen(): void {
  returnFocus = null;
  if (phase !== "closed") setPhase("closed");
}

export function readSwitchScreenPhase(): SwitchScreenPhase {
  return phase;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Le rendu à plat (bancs) lit la même phase : l'application n'est jamais rendue côté serveur. */
export function useSwitchScreenPhase(): SwitchScreenPhase {
  return useSyncExternalStore(subscribe, readSwitchScreenPhase, readSwitchScreenPhase);
}
