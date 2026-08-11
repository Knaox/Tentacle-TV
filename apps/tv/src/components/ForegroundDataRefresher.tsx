import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus, InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Rafraîchit les données de l'accueil au RETOUR au premier plan.
 *
 * Sur Android TV, l'app peut rester des heures en arrière-plan (changement de
 * source HDMI, bouton Home de la télécommande). Pendant ce temps l'utilisateur
 * a pu regarder un épisode sur mobile, ou la progression du média qu'il vient
 * de quitter n'est pas encore reflétée. `useFocusEffect` de HomeScreen ne se
 * déclenche PAS dans ce cas (l'écran reste « focused »), et le QueryClient est
 * en `refetchOnWindowFocus:false` → l'accueil affichait l'ancien cache.
 *
 * On invalide donc les requêtes volatiles de l'accueil sur la vraie transition
 * `background|inactive → active` (même garde anti-spurious que
 * ForegroundSessionValidator), différé après les interactions pour ne pas
 * concurrencer le rendu du retour.
 */
export function ForegroundDataRefresher() {
  const queryClient = useQueryClient();
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const previous = previousStateRef.current;
      previousStateRef.current = state;

      if (state !== "active") return;
      // Ignore l'event "active" spurieux du cold start.
      if (previous === "active" || previous === "unknown") return;

      InteractionManager.runAfterInteractions(() => {
        queryClient.invalidateQueries({ queryKey: ["featured"] });
        queryClient.invalidateQueries({ queryKey: ["resume-items"] });
        // exact : ne pas matcher ["next-up","unwatched-episodes"] & co (Limit 500)
        queryClient.invalidateQueries({ queryKey: ["next-up"], exact: true });
        queryClient.invalidateQueries({ queryKey: ["latest-items"] });
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        queryClient.invalidateQueries({ queryKey: ["watched-items"] });
      });
      // Pas de task.cancel ici : l'écouteur AppState est durable (pas de cleanup
      // par event) ; la task se résout d'elle-même après les interactions.
    });
    return () => sub.remove();
  }, [queryClient]);

  return null;
}
