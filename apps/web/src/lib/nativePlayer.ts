import { useSyncExternalStore } from "react";

/**
 * L'interrupteur de DEBUG qui coupe le lecteur natif (mpv), pour éprouver le
 * lecteur de secours sans casser quoi que ce soit.
 *
 * Persisté en localStorage — survit au relancement, ce qui permet de tester le
 * démarrage complet de l'app en mode secours — mais l'état ne PORTE que si le
 * bundle est un build de debug : en paquet livré, `__PLAYER_DEBUG__` est faux,
 * `mpvDisabledByDebug()` répond toujours `false`, et une clé résiduelle est
 * inerte.
 *
 * Vit dans `lib/` et non `dev/` : `Watch.tsx` le lit à chaque montage, et un
 * import depuis `dev/` tirerait le bundle de debug dans le chemin de la page.
 */

const KEY = "tentacle_mpv_desactive";

const enabled = (): boolean => import.meta.env.DEV || __PLAYER_DEBUG__;

const subscribers = new Set<() => void>();

function readStorage(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let disabled = readStorage();

/** mpv est-il coupé par l'interrupteur de debug ? Toujours faux hors debug. */
export function mpvDisabledByDebug(): boolean {
  return enabled() && disabled;
}

/** Bascule l'interrupteur ; rend le nouvel état. Prise d'effet immédiate. */
export function toggleMpvDebug(): boolean {
  disabled = !disabled;
  try {
    localStorage.setItem(KEY, disabled ? "1" : "0");
  } catch {
    /* stockage indisponible : l'état vaut pour la session */
  }
  for (const subscriber of subscribers) subscriber();
  return disabled;
}

/** L'interrupteur, réactif — `Watch` s'y abonne pour basculer EN lecture. */
export function useMpvDisabledByDebug(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    () => mpvDisabledByDebug(),
  );
}
