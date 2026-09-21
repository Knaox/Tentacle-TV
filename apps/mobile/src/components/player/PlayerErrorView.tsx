import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { PLAYER } from "@/theme";

interface Props {
  message: string;
  /** Le motif technique (moteur, décision, erreur brute), replié derrière « Détails ». */
  details?: string | null;
  onRetry: () => void;
  onBack: () => void;
}

export function PlayerErrorView({ message, details, onRetry, onBack }: Props) {
  const { t } = useTranslation("player");
  const [showDetails, setShowDetails] = useState(false);

  return (
    <View style={{
      flex: 1, justifyContent: "center", alignItems: "center",
      padding: 32, backgroundColor: PLAYER.bg,
    }}>
      {/* Error icon */}
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: PLAYER.errorSoft,
        justifyContent: "center", alignItems: "center", marginBottom: 16,
      }}>
        <Text style={{ color: PLAYER.error, fontSize: 24 }}>!</Text>
      </View>

      <Text style={{
        color: PLAYER.text, fontSize: 16, textAlign: "center",
        marginBottom: 24, lineHeight: 22,
      }}>
        {message}
      </Text>

      {/* La pilule blanche du lecteur — plus d'aplat violet. */}
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [{
          backgroundColor: PLAYER.text, minHeight: 44, paddingHorizontal: 28,
          paddingVertical: 12, borderRadius: 9999, justifyContent: "center",
        }, pressed && { opacity: 0.85 }]}
      >
        <Text style={{ color: PLAYER.textInverse, fontSize: 15, fontWeight: "700" }}>
          {t("retry")}
        </Text>
      </Pressable>

      {/* Secondaire fantôme, parité avec l'affiche de fin. */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        style={({ pressed }) => [{
          marginTop: 12, minHeight: 44, paddingHorizontal: 22, justifyContent: "center",
          borderRadius: 9999, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.25)",
        }, pressed && { opacity: 0.7 }]}
      >
        <Text style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: 14, fontWeight: "600" }}>
          {t("back")}
        </Text>
      </Pressable>

      {/* Le motif, discret : un mot pour l'ouvrir, du texte brut sélectionnable. */}
      {details ? (
        <Pressable onPress={() => setShowDetails((v) => !v)} accessibilityRole="button" hitSlop={8} style={{ marginTop: 20 }}>
          <Text style={{ color: PLAYER.textSecondary, fontSize: 12, textDecorationLine: "underline" }}>
            {t("details")}
          </Text>
        </Pressable>
      ) : null}
      {details && showDetails ? (
        <Text selectable style={{ color: PLAYER.textSecondary, fontSize: 11, marginTop: 8, textAlign: "center", maxWidth: 360 }}>
          {details}
        </Text>
      ) : null}
    </View>
  );
}
