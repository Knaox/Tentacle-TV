import {
  createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { StyleSheet } from "react-native";
import { createBackLayers, type BackLayerKind, type BackLayers } from "@tentacle-tv/tv-core";
import { MenuPressInterceptor } from "../../components/focus/MenuPressInterceptor";
import { RAIL_ROUTES } from "../../navigation/railNavigate";
import { REDESIGN_ACTIVE } from "../redesignGate";

/**
 * Le RETOUR d'un écran, sur Apple TV — un seul chemin pour la touche Menu.
 *
 * Le navigateur pose une portée autour de chaque écran (`screenLayout`). Tout
 * ce qui a quelque chose à faire au Retour s'y inscrit comme une COUCHE
 * (`useBackLayer`) : un menu, la surimpression du lecteur, la page, le rail.
 * La pile (`createBackLayers`, tv-core) les consulte dans l'ordre
 * menu > surimpression > page > rail ; aucune couche active : l'appui revient
 * à UIKit, qui quitte l'application — la règle d'Apple.
 *
 * D'AVANCE : sur tvOS, un appui est pris ou laissé à UIKit dès qu'il
 * commence. La portée est donc un `MenuPressInterceptor` dont `enabled` dit
 * « une couche est active » ; il prend l'appui parti de n'importe quel
 * élément focalisé de l'écran et le rend à la pile.
 *
 * Menu ne dépile JAMAIS un écran de lui-même (`gestureEnabled: false` sur
 * Apple TV, patch de react-native-screens). Avant, le geste Retour d'UIKit
 * dépilait avant qu'on ait pu le retenir, `usePreventRemove` réempilait
 * l'écran après coup, et celui du dessous paraissait quelques images.
 * Reculer d'une page est désormais une couche comme une autre : une page
 * POUSSÉE (fiche, personne, bande-annonce, lecteur…) en a une par défaut,
 * `goBack`, qu'une couche « page » de l'écran remplace (la plus récente
 * répond) ; une page du RAIL n'en a pas — `RedesignScreen` y inscrit les
 * siennes (ouvrir le rail, aller sur Réglages), puis la sortie.
 *
 * Une `Modal` vit dans son propre contrôleur : son Menu va droit à son
 * `onRequestClose`, sans passer par ici. Elle s'inscrit quand même (couche
 * « menu », active tant qu'elle est ouverte) et `onRequestClose` ferme ce que
 * sa couche fermerait : elle est forcément la couche du dessus.
 *
 * Android TV : la portée ne fait rien — le Retour y arrive au JS par
 * BackHandler, écran par écran.
 */

interface BackScopeProps {
  route: { name: string };
  navigation: { canGoBack(): boolean; goBack(): void };
  children: ReactNode;
}

const BackContext = createContext<BackLayers | null>(null);

/** La couche « page » par défaut d'une page poussée : reculer. */
const DEFAULT_PAGE = "scope:page";

function AppleTvBackScope({ route, navigation, children }: BackScopeProps) {
  const [layers] = useState(createBackLayers);
  const taken = useSyncExternalStore(layers.subscribe, () => layers.target() !== null);
  const pushed = !RAIL_ROUTES.has(route.name) && navigation.canGoBack();
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  useLayoutEffect(() => {
    layers.set(DEFAULT_PAGE, { kind: "page", active: pushed, onBack: () => navigationRef.current.goBack() });
  }, [layers, pushed]);
  const onMenuPress = useCallback(() => void layers.back(), [layers]);
  return (
    <BackContext.Provider value={layers}>
      <MenuPressInterceptor enabled={taken} onMenuPress={onMenuPress} style={styles.fill}>
        {children}
      </MenuPressInterceptor>
    </BackContext.Provider>
  );
}

function PassThrough({ children }: BackScopeProps) {
  return <>{children}</>;
}

export const BackScope = REDESIGN_ACTIVE ? AppleTvBackScope : PassThrough;

/**
 * Inscrit une couche du Retour dans l'écran : tant qu'elle est `active`, le
 * prochain Retour lui revient, dans l'ordre menu > surimpression > page >
 * rail. `onBack` est relu à chaque appui. Sans portée (Android TV), rien.
 */
export function useBackLayer(kind: BackLayerKind, active: boolean, onBack: () => void): void {
  const layers = useContext(BackContext);
  const id = useId();
  const handler = useRef(onBack);
  handler.current = onBack;
  useLayoutEffect(() => {
    layers?.set(id, { kind, active, onBack: () => handler.current() });
  }, [layers, id, kind, active]);
  useLayoutEffect(() => (layers ? () => layers.remove(id) : undefined), [layers, id]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
