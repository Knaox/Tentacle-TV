import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import { NEUTRAL_PALETTE } from "../../color/artworkPalette";
import { colors } from "../../theme/tokens";
import { Glow } from "../pairing/Glow";

/**
 * Le démarrage : le temps de relire le stockage, les réglages et la langue.
 * La mascotte dans la lumière de la marque (le rose, discret, comme à
 * l'accueil du jumelage qui peut suivre), sur le fond neutre des écrans sans
 * œuvre, et l'indicateur système dessous — AUCUN texte :
 * la langue n'est pas encore connue (i18n s'initialise après). Aucune prop,
 * aucun thème d'administrateur : rien n'est encore chargé.
 */
export const BootView = memo(function BootView() {
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={NEUTRAL_PALETTE} intensity={0.8} />
      <View style={styles.center}>
        <View style={styles.mascot}>
          <Glow size={640} color={colors.accent} opacity={0.3} style={styles.glow} />
          <BrandMark size={200} />
        </View>
        <ActivityIndicator size="large" color={colors.text} style={styles.spinner} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mascot: { alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute" },
  spinner: { marginTop: 64, transform: [{ scale: 1.4 }] },
});
