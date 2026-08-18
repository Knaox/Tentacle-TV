import { Text, View } from "react-native";
import { Colors, Typography } from "../../theme/colors";

/**
 * État vide d'une page de collection (Ma liste, Favoris) : une icône SVG, un
 * titre, un indice — jamais d'emoji (contrainte du dépôt). Rien n'est
 * focusable : le rail reste la seule sortie, comme sur la LG.
 */
export function TVCollectionEmpty({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 }}>
      {icon}
      <Text style={{ color: Colors.textSecondary, ...Typography.sectionTitle }}>{title}</Text>
      <Text style={{ color: Colors.textMuted, fontSize: 16, textAlign: "center", maxWidth: 520 }}>
        {hint}
      </Text>
    </View>
  );
}
