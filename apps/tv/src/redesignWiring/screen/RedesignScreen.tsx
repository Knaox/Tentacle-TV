import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { NavMenuModal } from "../nav/NavMenuModal";
import { RailBridges } from "./RailBridges";
import { RailShortcuts } from "./RailShortcuts";
import { useRailBackLayers } from "./useRailBackLayers";
import type { RedesignScreenModel } from "./useRedesignScreen";

/**
 * Le cadre d'un écran refondu avec navigation. Il pose :
 *
 * - le PORT du focus (`FocusBindingProvider`) sur le magasin de l'écran : les
 *   cibles de la vue y inscrivent leur nœud et leur focus ;
 * - les couches du RETOUR de l'écran (`useRailBackLayers`) dans la pile de la
 *   portée (`BackScope`) : sur une page du rail, le rail s'ouvre, puis
 *   Réglages, puis la sortie ; l'organisation du rail s'annule et se ferme ;
 * - les PONTS entre navigation et contenu (`RailBridges`), et les RACCOURCIS
 *   de la navigation vers le profil (`RailShortcuts`) ;
 * - le menu d'appui long d'une entrée (`NavMenuModal`, une Modal : son Menu
 *   part dans `onRequestClose`).
 */
export function RedesignScreen({ screen, children }: { screen: RedesignScreenModel; children: ReactNode }) {
  useRailBackLayers(screen);
  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={screen.focus.binder}>
        {children}
        <NavMenuModal arrange={screen.arrange} focus={screen.focus} railWidth={screen.railGeometry?.expandedWidth} />
      </FocusBindingProvider>
      <RailBridges screen={screen} />
      <RailShortcuts screen={screen} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
