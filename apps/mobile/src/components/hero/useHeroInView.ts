import { useAnimatedScrollHandler, useSharedValue, type SharedValue } from "react-native-reanimated";

/**
 * Le héros d'une page est-il encore dans la vue ? Suivi sur le fil UI par le
 * défilement de la page, sans un seul rendu React : `inView` (1 ou 0) est lu
 * par le héros (`HeroBanner`), qui suspend sa rotation hors de la vue — ce
 * qui n'est pas affiché ne consomme rien — et la reprend où il l'avait
 * laissée quand il revient.
 *
 * `heroBottom` : la hauteur du héros dans le contenu de la page (au-delà, il
 * est passé sous l'en-tête).
 */
export function useHeroInView(heroBottom: number): { inView: SharedValue<number>; handler: ReturnType<typeof useAnimatedScrollHandler> } {
  const inView = useSharedValue(1);
  const handler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const next = event.contentOffset.y < heroBottom ? 1 : 0;
      if (next !== inView.value) inView.value = next;
    },
  }, [heroBottom]);
  return { inView, handler };
}
