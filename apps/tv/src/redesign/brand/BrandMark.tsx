import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
// Le SEUL import de la refonte qui sort de `redesign/` : le dessin de la
// marque ne se recopie pas (CLAUDE.md, « le logo ne se dessine qu'à un seul
// endroit ») — `TentacleLogo` ne fait que tracer les SVG générés par `brand/`.
// eslint-disable-next-line no-restricted-imports
import { TentacleLogo } from "../../components/icons/TentacleLogo";
import { colors, fonts } from "../theme/tokens";

/**
 * La marque, en haut à droite de l'écran : la mascotte, et le nom quand il y
 * a la place. `crying` : la mascotte triste des écrans d'erreur.
 */
export const BrandMark = memo(function BrandMark({
  size = 56,
  withName = false,
  crying = false,
}: {
  size?: number;
  withName?: boolean;
  crying?: boolean;
}) {
  return (
    <View style={styles.row}>
      <TentacleLogo size={size} raw crying={crying} />
      {withName ? <Text style={styles.name}>Tentacle</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { ...fonts.extrabold, fontSize: 30, letterSpacing: -0.5, color: colors.text },
});
