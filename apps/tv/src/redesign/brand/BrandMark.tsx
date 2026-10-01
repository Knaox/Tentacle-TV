import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
// Les SEULS imports de la refonte qui sortent de `redesign/` : le dessin de la
// marque ne se recopie pas (CLAUDE.md, « le logo ne se dessine qu'à un seul
// endroit ») — `TentacleLogo` et `TentacleMonoLogo` ne font que tracer la
// géométrie générée par `brand/`.
// eslint-disable-next-line no-restricted-imports
import { TentacleLogo } from "../../components/icons/TentacleLogo";
// eslint-disable-next-line no-restricted-imports
import { TentacleMonoLogo } from "../../components/icons/TentacleMonoLogo";
import { colors, fonts, white } from "../theme/tokens";

/**
 * La marque : la mascotte, et le nom quand il y a la place. `crying` : la
 * mascotte triste des écrans d'erreur. `tone="mono"` : la mascotte en une
 * seule masse, à l'encre blanche de l'interface (`brand/logo-mono.svg`) —
 * celle du coin de l'écran (`BrandCorner`) ; la couleur reste aux
 * illustrations (accueil du jumelage, démarrage, erreurs).
 */
export const BrandMark = memo(function BrandMark({
  size = 56,
  withName = false,
  crying = false,
  tone = "color",
}: {
  size?: number;
  withName?: boolean;
  crying?: boolean;
  tone?: "color" | "mono";
}) {
  return (
    <View style={styles.row}>
      {tone === "mono" ? <TentacleMonoLogo size={size} color={white(0.94)} /> : <TentacleLogo size={size} raw crying={crying} />}
      {withName ? <Text style={styles.name}>Tentacle</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { ...fonts.extrabold, fontSize: 30, letterSpacing: -0.5, color: colors.text },
});
