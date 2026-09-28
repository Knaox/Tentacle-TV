import { useEffect } from "react";
import { useNavigation } from "expo-router";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collapseDetailChain } from "@/utils/detailChain";

/**
 * Replie la chaîne de fiches sous l'écran courant (cf. `utils/detailChain`).
 *
 * **À la fin de la transition d'entrée, pas au focus.** Le focus arrive au
 * premier instant du glissement : la fiche d'en dessous est encore à l'écran,
 * et la retirer ferait apparaître l'accueil derrière la fiche qui entre. Une
 * fois la transition finie, elle est entièrement couverte — la retirer ne se
 * voit pas, et libère sa mémoire (images, requêtes, animations).
 *
 * Aucun appel de `router.replace` aux sites d'appel : la pile est corrigée à
 * l'arrivée, quel que soit le chemin — y compris ceux qu'on ajoutera.
 */
export function useDetailChain(): void {
  // Type seulement : le mobile ne déclare pas @react-navigation, expo-router
  // l'embarque (même précaution que `usePluginOverlay`).
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  useEffect(() => navigation.addListener("transitionEnd", (e) => {
    // `closing` : c'est cette fiche qui s'en va, il n'y a rien à replier.
    if (e.data.closing || !e.target) return;
    const state = navigation.getState();
    const routes = collapseDetailChain(state.routes, e.target);
    if (!routes) return;
    const removed = state.routes.length - routes.length;
    // `CommonActions.reset` sans importer @react-navigation/native : l'action
    // n'est que cet objet. Les clés conservées ne remontent aucun écran.
    navigation.dispatch({
      type: "RESET",
      payload: { ...state, routes, index: state.index - removed },
    });
  }), [navigation]);
}
