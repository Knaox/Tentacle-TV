import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { usePairingExpired } from "../hooks/usePairingExpired";
import { REDESIGN_ACTIVE } from "../redesignWiring/redesignGate";
import { ExpiredPairingRedesign } from "../redesignWiring/overlays/noticesRedesign";

/**
 * Bandeau discret « jumelage expiré » : la sauvegarde de progression est en
 * pause (playstate impossible via le proxy — clé admin sans contexte user,
 * Jellyfin 10.11) ; sans ce bandeau, la position se perdait en silence.
 * Informatif, non focusable ; disparaît seul dès qu'un token frais revient.
 * Le signal est commun aux deux téléviseurs : `usePairingExpired`.
 */
export function PairingExpiredBanner() {
  return REDESIGN_ACTIVE ? <ExpiredPairingRedesign /> : <LegacyPairingExpiredBanner />;
}

function LegacyPairingExpiredBanner() {
  const { t } = useTranslation("pairing");
  const expired = usePairingExpired();

  if (!expired) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.text}>{t("pairingExpiredBanner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", top: 24, alignSelf: "center",
    backgroundColor: "rgba(24, 18, 6, 0.92)",
    borderColor: "rgba(251, 191, 36, 0.55)", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
    maxWidth: 900,
  },
  text: { color: "#fbbf24", fontSize: 18, fontWeight: "600", textAlign: "center" },
});
