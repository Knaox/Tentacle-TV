import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors, Spacing, Typography } from "../../theme/colors";
import { Bouton } from "../../theme/boutons";

interface TVHomeErrorStateProps {
  errorMessage?: string;
  onRetry: () => void;
  onLogout: () => void;
}

/**
 * Full-screen error state shown when the home queries all fail.
 * Extracted from HomeScreen.tsx for the 300-line budget.
 */
export function TVHomeErrorState({ errorMessage, onRetry, onLogout }: TVHomeErrorStateProps) {
  const { t } = useTranslation("common");

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.screenPadding }}>
      <Text style={{ color: Colors.error, ...Typography.sectionTitle, marginBottom: 12 }}>
        {t("connectionError")}
      </Text>
      <Text style={{ color: Colors.textMuted, ...Typography.body, textAlign: "center", marginBottom: 24 }}>
        {errorMessage ?? "Network request failed"}
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.buttonGap }}>
        <Focusable variant="button" focusRadius={Bouton.grand.borderRadius} onPress={onRetry} hasTVPreferredFocus>
          {/* CTA primaire : blanc à texte foncé, comme le bouton Lecture/Reprendre. */}
          <View
            style={{
              backgroundColor: Colors.textPrimary,
              paddingHorizontal: 32,
              paddingVertical: 14,
              ...Bouton.grand,
            }}
          >
            <Text style={{ color: Colors.bgDeep, ...Typography.buttonMedium }}>
              {t("retry")}
            </Text>
          </View>
        </Focusable>
        <Focusable variant="button" focusRadius={Bouton.grand.borderRadius} onPress={onLogout}>
          <View
            style={{
              backgroundColor: Colors.glassBg,
              paddingHorizontal: 32,
              paddingVertical: 14,
              ...Bouton.grand,
              borderWidth: 1,
              borderColor: Colors.glassBorder,
            }}
          >
            <Text style={{ color: Colors.textSecondary, ...Typography.buttonMedium }}>
              {t("reconnect")}
            </Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}
