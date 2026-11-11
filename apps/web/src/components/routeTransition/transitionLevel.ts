import { createContext } from "react";

/**
 * Un NIVEAU de transition de page — celui de `<Routes>` (la coquille entière, une fiche, la
 * connexion) ou celui de l'`<Outlet>` de la coquille (une section sous la barre).
 *
 * C'est le fil entre la page qui SORT et celle qui ARRIVE. La règle qu'il porte (lot « rf2 »,
 * nov. 2026) : **la page quittée reste à l'écran, intacte, jusqu'à ce que la page d'arrivée
 * soit prête**, puis s'efface par-dessus elle. Avant, la sortie partait au clic : l'écran
 * tombait vers le fond de page pendant que l'arrivée chargeait ses données et ses images, puis
 * se remplissait par à-coups — le « scintillement » relevé par Damien (banc `bench:page-flicker` :
 * de 4 à 20 images plus sombres que le départ et l'arrivée, à chaque première visite).
 *
 * Pur, sans React : la page d'arrivée y écrit ce qu'elle sait d'elle (`setArrival`), les pages
 * qui sortent s'y abonnent.
 */

export interface PageArrival {
  /** La page d'arrivée peut se montrer : la page quittée peut partir. */
  ready: boolean;
  /** La page quittée part d'un coup, sans fondu (le lecteur, le miroir, un calque qui couvre déjà). */
  instant: boolean;
}

export interface TransitionLevel {
  arrival(): PageArrival;
  setArrival(next: PageArrival): void;
  /** Les pages qui sortent et qu'on VOIT encore : tant qu'il y en a, l'arrivée se prépare cachée. */
  leaving(): number;
  /** Une page se met à sortir ; rend de quoi le défaire (elle est partie, ou revenue). */
  enterLeaving(): () => void;
  subscribe(listener: () => void): () => void;
}

export function createTransitionLevel(): TransitionLevel {
  let arrival: PageArrival = { ready: true, instant: false };
  let leaving = 0;
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };
  return {
    arrival: () => arrival,
    setArrival(next) {
      if (next.ready === arrival.ready && next.instant === arrival.instant) return;
      arrival = next;
      emit();
    },
    leaving: () => leaving,
    enterLeaving() {
      leaving += 1;
      emit();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        leaving -= 1;
        emit();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Le niveau où vit l'enveloppe d'une page ; absent hors des routes (tests, bancs) : aucune tenue. */
export const TransitionLevelContext = createContext<TransitionLevel | null>(null);
