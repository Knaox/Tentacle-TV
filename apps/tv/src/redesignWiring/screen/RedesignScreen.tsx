import { useCallback, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { MenuPressInterceptor } from "../../components/focus/MenuPressInterceptor";
import { RailBridges } from "./RailBridges";
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
 * - les PONTS entre navigation et contenu (`RailBridges`).
 *
 * Une Modal (liste de choix, feuille) vit dans son propre contrôleur : son
 * Menu part dans `onRequestClose` sans passer par ici.
 */
export function RedesignScreen({ screen, children }: { screen: RedesignScreenModel; children: ReactNode }) {
  const navigation = useNavigation();
  const { railFocused, onBack, focusRail } = screen;
  const canGoBack = navigation.canGoBack();

  const onMenuPress = useCallback(() => {
    if (railFocused) {
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }
    if (onBack?.()) return;
    focusRail();
  }, [navigation, railFocused, onBack, focusRail]);

  return (
    <MenuPressInterceptor enabled={railFocused ? canGoBack : true} onMenuPress={onMenuPress} style={styles.fill}>
      <FocusBindingProvider bind={screen.focus.binder}>{children}</FocusBindingProvider>
      <RailBridges screen={screen} />
    </MenuPressInterceptor>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
