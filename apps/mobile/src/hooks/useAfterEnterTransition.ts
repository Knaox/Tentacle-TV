import { useEffect, useState } from "react";
import { useNavigation } from "expo-router";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

/**
 * Au plus tard : un écran ouvert sans transition (lien profond, premier
 * écran) n'attend pas un évènement qui ne viendra pas.
 */
const FALLBACK_MS = 650;

/**
 * Vrai une fois l'écran ARRIVÉ — sa transition d'entrée finie
 * (`transitionEnd`), ou au plus tard après `FALLBACK_MS`.
 *
 * Pour ce qui est sous le pli et cher à monter : monté dans le même rendu
 * synchrone que l'écran, il retardait le départ du glissement ; monté à
 * l'arrivée, il est prêt avant que le doigt n'ait pu y descendre.
 */
export function useAfterEnterTransition(): boolean {
  // Type seulement : le mobile ne déclare pas @react-navigation (cf. `useDetailChain`).
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (arrived) return undefined;
    const done = () => setArrived(true);
    const timer = setTimeout(done, FALLBACK_MS);
    const unsubscribe = navigation.addListener("transitionEnd", (e) => {
      if (!e.data.closing) done();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation, arrived]);

  return arrived;
}
