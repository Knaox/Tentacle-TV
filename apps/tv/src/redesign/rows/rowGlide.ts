import { useCallback, useMemo, useRef } from "react";
import type { ScrollView } from "react-native";
import { cancelAnimation, scrollTo, useAnimatedReaction, useReducedMotion, useSharedValue, type AnimatedRef } from "react-native-reanimated";
import { motionTo } from "../motion/motion";

/**
 * Le passage EN TÊTE d'une rangée, joué AVEC la grande carte de l'aperçu
 * (tv-core `trailerPreviewRowHead.ts`, `motion: "withPreview"`) : le même
 * mouvement que sa croissance (`unfold`, `CardPreviewTile`), image par image
 * sur le fil d'interface. La carte glisse vers la tête pendant qu'elle grandit
 * — un seul geste. En butée, le défilement compense exactement la croissance :
 * le bord droit de la grande carte reste en place, elle grandit vers la
 * gauche ; jamais elle ne dépasse de l'écran le temps du mouvement (un
 * défilement animé ordinaire, plus lent à partir que le ressort, la laissait
 * déborder à droite puis revenir).
 *
 * `glideBack` : la même chose au REPLI d'une carte (le retour de `unfold`) —
 * la rangée recule de ce que la carte rend, et la voisine focalisée ne bouge
 * pas.
 *
 * `stop` au moindre pas du focus : la plateforme (le moteur de focus de tvOS,
 * Android) reprend la piste sans qu'on la lui dispute. Animations réduites,
 * profil sans mouvement : la piste va à sa place d'un coup, comme la carte.
 */
export function useRowGlide(track: AnimatedRef<ScrollView>) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  const from = useSharedValue(0);
  const to = useSharedValue(0);
  const active = useSharedValue(false);
  // Côté JS : un glissé est en cours — un pas du focus ne réveille le fil d'interface que dans ce cas.
  const gliding = useRef(false);

  useAnimatedReaction(
    () => progress.value,
    (value, previous) => {
      if (!active.value || value === previous) return;
      scrollTo(track, from.value + (to.value - from.value) * value, 0, false);
    },
  );

  const glide = useCallback(
    (start: number, target: number) => {
      cancelAnimation(progress);
      gliding.current = true;
      from.value = start;
      to.value = target;
      active.value = true;
      progress.value = 0;
      progress.value = motionTo(1, "unfold", reduced);
    },
    [progress, from, to, active, reduced],
  );

  const glideBack = useCallback(
    (start: number, target: number) => {
      cancelAnimation(progress);
      gliding.current = true;
      from.value = target;
      to.value = start;
      active.value = true;
      progress.value = 1;
      progress.value = motionTo(0, "unfold", reduced);
    },
    [progress, from, to, active, reduced],
  );

  const stop = useCallback(() => {
    if (!gliding.current) return;
    gliding.current = false;
    active.value = false;
    cancelAnimation(progress);
  }, [progress, active]);

  // Un objet STABLE : `rowPreviewRoom` en tire les gestionnaires de la rangée —
  // neuf à chaque rendu, il faisait se réinscrire la rangée au port de
  // `rowRewind` (qui oubliait alors qu'elle était défilée) et redessiner toutes
  // ses cartes.
  return useMemo(() => ({ glide, glideBack, stop }), [glide, glideBack, stop]);
}
