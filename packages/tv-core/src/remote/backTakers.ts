/**
 * Les PRENEURS du Retour d'Android TV : qui, au moment du geste, le prend.
 *
 * Sur Apple TV, Retour (Menu) est pris ou laissé à UIKit dès l'enfoncement,
 * par une vue native posée d'avance (`MenuPressInterceptor`). Android, lui,
 * demande au relâchement (`BackHandler`) : l'applicateur du Retour —
 * couches de l'écran, page poussée (le BackScope d'Android) — s'inscrit ici
 * et répond À CE MOMENT-LÀ, en appliquant sa décision (tv-core
 * `nav/backResolve`). Le dernier inscrit répond le premier : un écran posé
 * par-dessus passe avant celui d'en dessous.
 *
 * Module pur : ni React ni React Native — l'adaptateur Android
 * (`apps/tv/src/platform/androidtv/input/remoteInput.ts`) le branche sur
 * `BackHandler`.
 */

/** Applique le Retour s'il le prend, et rend vrai ; faux : il le laisse au suivant. */
export type BackTaker = () => boolean;

export interface BackTakers {
  add(taker: BackTaker): () => void;
  /** Le Retour, proposé du dernier inscrit au premier ; vrai s'il a été pris. */
  take(): boolean;
  /** Prévenu quand le premier preneur arrive (vrai) et quand le dernier part (faux). */
  onDemand(listener: (needed: boolean) => void): void;
}

export function createBackTakers(): BackTakers {
  const takers: BackTaker[] = [];
  const demand: Array<(needed: boolean) => void> = [];
  const notify = (needed: boolean) => {
    for (const listener of [...demand]) listener(needed);
  };
  return {
    add(taker) {
      takers.push(taker);
      if (takers.length === 1) notify(true);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        const index = takers.lastIndexOf(taker);
        if (index >= 0) takers.splice(index, 1);
        if (takers.length === 0) notify(false);
      };
    },
    take() {
      for (let i = takers.length - 1; i >= 0; i -= 1) if (takers[i]()) return true;
      return false;
    },
    onDemand(listener) {
      demand.push(listener);
    },
  };
}
