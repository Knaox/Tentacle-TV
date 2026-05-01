import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { Colors, Spacing, Typography } from "../../theme/colors";

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
        {t("connectionError", { defaultValue: "Connection error" })}
      </Text>
      <Text style={{ color: Colors.textMuted, ...Typography.body, textAlign: "center", marginBottom: 24 }}>
        {errorMessage ?? "Network request failed"}
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.buttonGap }}>
        <Focusable variant="button" onPress={onRetry} hasTVPreferredFocus>
          <View
            style={{
              backgroundColor: Colors.accentPurple,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: Colors.textPrimary, ...Typography.buttonMedium }}>
              {t("retry", { defaultValue: "Retry" })}
            </Text>
          </View>
        </Focusable>
        <Focusable variant="button" onPress={onLogout}>
          <View
            style={{
              backgroundColor: Colors.glassBg,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: Colors.glassBorder,
            }}
          >
            <Text style={{ color: Colors.textSecondary, ...Typography.buttonMedium }}>
              {t("reconnect", { defaultValue: "Re-pair" })}
            </Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}
