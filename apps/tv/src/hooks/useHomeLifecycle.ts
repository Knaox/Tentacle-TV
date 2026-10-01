import { useCallback, useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHomeWebSocket,
  usePreferencesLive,
  useRecoLive,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import { preloadCoreScreens } from "../navigation/AppNavigator";

/**
 * Ce que fait l'accueil au-delà de son affichage — le même, quelle que soit
 * son UI (l'actuelle sur Android TV, la refonte sur Apple TV) :
 *
 * - les carrousels, les recommandations reconstruites en fond, la mise en
 *   page de l'accueil et les réglages changés ailleurs arrivent en direct ;
 * - au RETOUR sur l'accueil (après le lecteur), les données volatiles se
 *   rafraîchissent — pas au premier montage (les requêtes démarrent déjà),
 *   `exact` sur « prochains épisodes » (le préfixe réveillait aussi ses deux
 *   requêtes de supplément), et après la transition ;
 * - une fois l'accueil interactif, les écrans paresseux se préchauffent.
 */
export function useHomeLifecycle(): void {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const token = storage.getItem("tentacle_token");

  // La révocation de ce jumelage s'écoute au niveau de l'app, pas ici :
  // `TVSessionGuard`, qui la reçoit sur n'importe quel écran.
  useHomeWebSocket({ token });
  useRecoLive({ token });
  usePreferencesLive({ token });

  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      const task = InteractionManager.runAfterInteractions(() => {
        queryClient.invalidateQueries({ queryKey: ["resume-items"] });
        queryClient.invalidateQueries({ queryKey: ["next-up"], exact: true });
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
      });
      return () => task.cancel();
    }, [queryClient]),
  );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(preloadCoreScreens);
    return () => task.cancel();
  }, []);
}
