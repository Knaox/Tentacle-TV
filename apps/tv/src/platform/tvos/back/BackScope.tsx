import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { StyleSheet } from "react-native";
import { backOutcome, createBackLayers, isPushedPage, takesBack } from "@tentacle-tv/tv-core";
import { MenuPressInterceptor } from "../../../components/focus/MenuPressInterceptor";
import { receiveMenu } from "../input";
import { BackLayersContext } from "../../shared/back/BackLayersContext";
import type { BackScopeProps } from "../../shared/back/backScopeProps";

/**
 * L'APPLICATEUR du Retour sur Apple TV — il applique, il ne décide pas.
 *
 * Le navigateur pose une portée autour de chaque écran (`screenLayout`). Tout
 * ce qui a quelque chose à faire au Retour s'y inscrit comme une COUCHE
 * (`useBackLayer`, `useBackLayers`) ; la pile et ses règles sont dans tv-core
 * (`nav/backLayers`, `nav/backResolve`, `nav/railPages`).
 *
 * Deux temps (`docs/TV-NAVIGATION.md`) :
 * - D'AVANCE : sur tvOS, un appui Menu est pris ou laissé à UIKit dès qu'il
 *   commence. La portée est donc un `MenuPressInterceptor` dont `enabled`
 *   vaut `takesBack` — une couche est active, ou la page est poussée ;
 * - AU GESTE, au relâchement : Menu passe d'abord par l'entrée unique
 *   (`receiveMenu` : ses observateurs voient `retour` ; aucun contexte global
 *   ne le décide), puis `backOutcome` — la couche visée répond, la page
 *   poussée recule (`goBack`), ou rien (l'appui était pris, plus rien ne le
 *   veut : relevé B3 de `docs/tv-navigation/retour-rail.md`). Sans prise,
 *   UIKit QUITTE l'application — la règle d'Apple, que lui seul sait faire.
 *
 * Menu ne dépile JAMAIS un écran de lui-même (`gestureEnabled: false` sur
 * Apple TV, patch de react-native-screens). Une `Modal` vit dans son propre
 * contrôleur : son Menu va à son `onRequestClose`, sans passer par ici ; elle
 * inscrit quand même sa couche « menu ».
 */

export type { BackScopeProps };

export function TvosBackScope({ route, navigation, children }: BackScopeProps) {
  const [layers] = useState(createBackLayers);
  const layered = useSyncExternalStore(layers.subscribe, () => layers.target() !== null);
  const pushed = isPushedPage(route.name, navigation.canGoBack());
  const latest = useRef({ navigation, pushed });
  latest.current = { navigation, pushed };
  const onMenuPress = useCallback(() => {
    receiveMenu();
    switch (backOutcome({ layered: layers.target() !== null, pushed: latest.current.pushed })) {
      case "layer":
        layers.back();
        return;
      case "pop":
        latest.current.navigation.goBack();
        return;
      case "exit":
        return;
    }
  }, [layers]);
  return (
    <BackLayersContext.Provider value={layers}>
      <MenuPressInterceptor enabled={takesBack({ layered, pushed })} onMenuPress={onMenuPress} style={styles.fill}>
        {children}
      </MenuPressInterceptor>
    </BackLayersContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
