import { useCallback, useRef, useState } from "react";
import { runOnJS, useAnimatedReaction, type SharedValue } from "react-native-reanimated";

/** En dessous, l'opacité ne se voit plus : la sortie est finie. */
const GONE = 0.001;

/**
 * Faut-il garder MONTÉ ce qui s'efface avec `progress` (0 → 1, celle d'un
 * `useMotion`) ? Avec `unmountHidden`, une fois `on` retombé et la sortie
 * jouée jusqu'au bout, la vue se démonte ; elle remonte dès que `on`
 * revient, et la même valeur la fait entrer depuis 0 — à l'œil, rien ne
 * change. Sans (`unmountHidden` faux), toujours monté : le comportement
 * d'avant.
 *
 * Pourquoi : sur Android TV, une vue à opacité 0 n'est pas gratuite (rendus
 * React, mise en page, ce qu'elle suit à chaque seconde) et surtout, elle
 * reste FOCALISABLE — le moteur de focus d'Android ne tient pas compte de la
 * transparence, celui de tvOS si. L'adaptateur de la plateforme dit lequel
 * des deux il faut (`platform/<plateforme>/player`).
 */
export function useMountedWhileVisible(on: boolean, progress: SharedValue<number>, unmountHidden: boolean): boolean {
  const [mounted, setMounted] = useState(on || !unmountHidden);
  if ((on || !unmountHidden) && !mounted) setMounted(true);
  // Lu au retour du fil d'interface : une sortie finie juste quand `on`
  // revient ne démonte rien.
  const onRef = useRef(on);
  onRef.current = on;

  const unmount = useCallback(() => {
    if (!onRef.current) setMounted(false);
  }, []);
  useAnimatedReaction(
    () => progress.value <= GONE,
    (gone, wasGone) => {
      if (unmountHidden && gone && wasGone === false) runOnJS(unmount)();
    },
    [unmountHidden, unmount],
  );
  return on || mounted || !unmountHidden;
}
