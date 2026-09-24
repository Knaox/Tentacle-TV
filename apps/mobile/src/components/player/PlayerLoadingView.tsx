import { View, Text } from "react-native";
import { BrandSpinner } from "../ui";
import { PLAYER } from "@/theme";

interface Props {
  title?: string;
}

/**
 * Le voile de mise en mémoire tampon d'une surface vidéo (lecture locale). Il
 * ne sert pas à l'ouverture d'un titre en ligne : c'est l'écran de chargement
 * plein écran (`loading/PlayerLoadingScreen`), avec son Retour, qui la couvre.
 */
export function PlayerLoadingView({ title }: Props) {
  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "center", alignItems: "center", backgroundColor: PLAYER.scrimSoft,
    }}>
      <BrandSpinner size="large" colors={[PLAYER.accent, PLAYER.accentRose]} />
      {title && (
        <Text style={{ color: PLAYER.textTertiary, fontSize: 13, marginTop: 12 }}>
          {title}
        </Text>
      )}
    </View>
  );
}
