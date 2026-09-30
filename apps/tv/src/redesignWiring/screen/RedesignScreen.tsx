import { useCallback, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { MenuPressInterceptor } from "../../components/focus/MenuPressInterceptor";
import { NavMenuModal } from "../nav/NavMenuModal";
import { RailBridges } from "./RailBridges";
import { RailShortcuts } from "./RailShortcuts";
import type { RedesignScreenModel } from "./useRedesignScreen";

/**
 * Le cadre d'un écran refondu avec navigation. Il pose :
 *
 * - le PORT du focus (`FocusBindingProvider`) sur le magasin de l'écran : les
 *   cibles de la vue y inscrivent leur nœud et leur focus ;
 * - le bouton MENU de la Siri Remote. Sur tvOS, UIKit le garde pour lui
 *   (`MenuPressInterceptor`) : depuis le contenu, il ouvre la navigation —
 *   sauf si l'écran le prend (`onBack` : un panneau à fermer) ; depuis la
 *   navigation, il recule d'un écran, et à la racine il est laissé à UIKit,
 *   qui quitte l'application — la règle tvOS ;
 * - les PONTS entre navigation et contenu (`RailBridges`), et les RACCOURCIS
 *   de la navigation vers le profil (`RailShortcuts`) ;
 * - l'ORGANISATION de la navigation : le menu d'appui long d'une entrée
 *   (`NavMenuModal`) et, pendant un déplacement, Menu qui l'annule — sur la
 *   racine comme sur une page poussée, où il ne doit ni quitter l'app ni
 *   dépiler l'écran.
 *
 * Une page POUSSÉE — toutes celles du rail s'empilent sur l'accueil : Menu
 * n'y atteint jamais l'intercepteur. UIKit dépile l'écran d'abord (le patch
 * de react-native-screens ne voit pas l'appui, tvOS 26.2), et seul
 * `usePreventRemove` le rattrape, l'écran réempilé après coup. Tant que le
 * focus est dans le contenu, le retrait y est donc empêché, et Menu fait ce
 * qu'il fait à la racine ; depuis la navigation, la page se dépile. Tout
 * autre retrait (une entrée du rail, la déconnexion) passe tel quel.
 *
 * Une Modal (liste de choix, feuille) vit dans son propre contrôleur : son
 * Menu part dans `onRequestClose` sans passer par ici.
 */
export function RedesignScreen({ screen, children }: { screen: RedesignScreenModel; children: ReactNode }) {
  const navigation = useNavigation();
  const { railFocused, onBack, focusRail, arrange } = screen;
  const canGoBack = navigation.canGoBack();
  const moving = arrange.movingKey !== null;
  const { cancelIfMoving } = arrange;

  const onMenuPress = useCallback(() => {
    if (cancelIfMoving()) return;
    if (railFocused) {
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }
    if (onBack?.()) return;
    focusRail();
  }, [navigation, railFocused, onBack, focusRail, cancelIfMoving]);

  // Le dépilage natif empêché revient en `POP` (native-stack) : c'est Menu.
  // L'action relancée porte la marque de ce retrait : elle n'est plus retenue.
  usePreventRemove(canGoBack && (!railFocused || moving), ({ data }) => {
    if (data.action.type === "POP" && navigation.isFocused()) onMenuPress();
    else navigation.dispatch(data.action);
  });

  return (
    <MenuPressInterceptor enabled={railFocused && !moving ? canGoBack : true} onMenuPress={onMenuPress} style={styles.fill}>
      <FocusBindingProvider bind={screen.focus.binder}>
        {children}
        <NavMenuModal arrange={arrange} focus={screen.focus} />
      </FocusBindingProvider>
      <RailBridges screen={screen} />
      <RailShortcuts screen={screen} />
    </MenuPressInterceptor>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
