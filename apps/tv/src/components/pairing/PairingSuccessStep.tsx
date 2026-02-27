import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius } from "../../theme/colors";

interface PairingSuccessStepProps {
  username: string;
}

export function PairingSuccessStep({ username }: PairingSuccessStepProps) {
  const { t } = useTranslation("pairing");

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TentacleLogo size={64} />
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>{t("pairing:pairingSuccess")}</Text>
        <Text style={styles.subtitle}>
          {t("pairing:welcomeUser", { username })}
        </Text>
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.bgDeep,
  },
  card: {
    width: 540,
    padding: 48,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.buttonLarge,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center" as const,
  },
  checkmark: {
    color: Colors.success,
    fontSize: 64,
    fontWeight: "800" as const,
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    color: Colors.success,
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 18,
  },
};
