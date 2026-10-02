import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
// Les SEULS imports de la refonte qui sortent de `redesign/` : le dessin de la
// marque ne se recopie pas (CLAUDE.md, « le logo ne se dessine qu'à un seul
// endroit ») — `TentacleLogo` ne fait que tracer la géométrie générée par
// `brand/`.
// eslint-disable-next-line no-restricted-imports
import { TentacleLogo } from "../../components/icons/TentacleLogo";
import { colors, fonts } from "../theme/tokens";

/**
 * La marque : la mascotte, et le nom quand il y a la place. `crying` : la
 * mascotte triste des écrans d'erreur. Toujours la mascotte normale, en
 * couleurs : la version mono blanche lisait « tête de mort » sur la TV.
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
