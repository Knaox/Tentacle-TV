import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BRAND, FONT_FAMILY } from "../../theme";

/**
 * Contenu de la carte de jumelage quand le jumelage TV est indisponible côté
 * backend (URL publique du serveur non configurée) ou en cours de vérification.
 */
export function PairUnavailableCard({ loading }: { loading: boolean }) {
  const { t } = useTranslation("pairing");

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <ActivityIndicator color={BRAND.light} size="small" />
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255,255,255,0.05)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
      }}>
        <Feather name="lock" size={30} color="rgba(255,255,255,0.5)" />
      </View>
      <Text style={{
        color: "rgba(255,255,255,0.7)",
        fontSize: 14,
        fontFamily: FONT_FAMILY.medium,
        textAlign: "center",
        lineHeight: 20,
      }}>
        {t("pairingUnavailable")}
      </Text>
    </View>
  );
}
