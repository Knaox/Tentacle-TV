import { ActivityIndicator, View } from "react-native";
import { DEFAULT_THEME } from "@tentacle-tv/theme";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { BootView } from "../redesign/screens/overlays/BootView";

/**
 * Le démarrage — le temps de relire le stockage, les réglages et la langue :
 * la mascotte de la refonte sur Apple TV (aucun texte, la langue n'est pas
 * encore connue), le disque d'attente sur Android TV.
 */
export function BootScreen() {
  if (REDESIGN_ACTIVE) return <BootView />;
  // Avant tout fournisseur : la couleur de marque statique de DEFAULT_THEME
  // (le thème de l'administrateur n'est pas encore lu). `#0a0a0f` n'a pas de
  // jeton équivalent — gardé en littéral.
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0f" }}>
      <ActivityIndicator size="large" color={DEFAULT_THEME.tokens.color.brand.base} />
    </View>
  );
}
