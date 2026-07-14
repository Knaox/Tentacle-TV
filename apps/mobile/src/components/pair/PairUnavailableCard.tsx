import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, useTheme } from "../../theme";

/**
 * Contenu de la carte de jumelage quand le jumelage TV est indisponible côté
 * backend (URL publique du serveur non configurée) ou en cours de vérification.
 */
export function PairUnavailableCard({ loading }: { loading: boolean }) {
  const { t } = useTranslation("pairing");
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <ActivityIndicator color={colors.brand.light} size="small" />
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.fill.subtle,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
      }}>
        <Feather name="lock" size={30} color={colors.text.tertiary} />
      </View>
      <Text style={{
        color: colors.text.secondary,
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
