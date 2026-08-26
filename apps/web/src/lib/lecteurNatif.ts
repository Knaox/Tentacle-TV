import { useSyncExternalStore } from "react";

/**
 * L'interrupteur de DEBUG qui coupe le lecteur natif (mpv), pour éprouver le
 * lecteur de secours sans casser quoi que ce soit.
 *
 * Persisté en localStorage — survit au relancement, ce qui permet de tester le
 * démarrage complet de l'app en mode secours — mais l'état ne PORTE que si le
 * bundle est un build de debug : en paquet livré, `__PLAYER_DEBUG__` est faux,
 * `mpvDesactiveParDebug()` répond toujours `false`, et une clé résiduelle est
 * inerte.
 *
 * Vit dans `lib/` et non `dev/` : `Watch.tsx` le lit à chaque montage, et un
 * import depuis `dev/` tirerait le bundle de debug dans le chemin de la page.
 */

const CLE = "tentacle_mpv_desactive";

const actif = (): boolean => import.meta.env.DEV || __PLAYER_DEBUG__;

const abonnes = new Set<() => void>();

function lireStockage(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

let desactive = lireStockage();

/** mpv est-il coupé par l'interrupteur de debug ? Toujours faux hors debug. */
export function mpvDesactiveParDebug(): boolean {
  return actif() && desactive;
}

/** Bascule l'interrupteur ; rend le nouvel état. Prise d'effet immédiate. */
export function basculerMpvDebug(): boolean {
  desactive = !desactive;
  try {
    localStorage.setItem(CLE, desactive ? "1" : "0");
  } catch {
    /* stockage indisponible : l'état vaut pour la session */
  }
  for (const abonne of abonnes) abonne();
  return desactive;
}

/** L'interrupteur, réactif — `Watch` s'y abonne pour basculer EN lecture. */
export function useMpvDesactiveParDebug(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      abonnes.add(onChange);
      return () => abonnes.delete(onChange);
    },
    () => mpvDesactiveParDebug(),
  );
}
