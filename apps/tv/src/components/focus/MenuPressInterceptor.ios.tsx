import { requireNativeComponent } from "react-native";
import type { MenuPressInterceptorProps } from "./menuPressInterceptorTypes";

/** La vue native : `ios/TentacleTV/TVMenuPressInterceptor.m`. */
const NativeMenuPressInterceptor =
  requireNativeComponent<MenuPressInterceptorProps>("TVMenuPressInterceptor");

/**
 * Apple TV : une `View` qui prend le bouton Menu parti de son sous-arbre.
 *
 * Sur tvOS, Menu n'atteint jamais le JS par `useTVRemote` : UIKit le livre à
 * l'élément focalisé, et la chaîne de répondeurs décide — un écran qui
 * empêche sa fermeture l'avale (`usePreventRemove`, patch react-native-screens),
 * sinon la pile dépile, et à la racine l'application quitte. Une surface
 * montée HORS des écrans (le rail) n'est sur le chemin d'aucun des deux : son
 * Menu filait droit à la sortie. Posée comme conteneur de cette surface, cette
 * vue arrête l'appui en chemin et le rend ici.
 *
 * Aucune géométrie propre : c'est une `View` comme les autres, qui remplace le
 * conteneur existant au lieu de s'y ajouter.
 */
export function MenuPressInterceptor(props: MenuPressInterceptorProps) {
  return <NativeMenuPressInterceptor {...props} />;
}
