import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius, Typography, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";
import { PAIRING_CODE_TTL, useServerPairingCode, type PairedAccount } from "../../hooks/usePairingCode";

interface ServerCodeDisplayStepProps {
  onConfirmed: (data: PairedAccount) => void;
  onChangeServer: () => void;
}

/**
 * Flux manuel : la TV AFFICHE un code généré par le serveur configuré, et
 * l'utilisateur le confirme depuis son téléphone/web (Paramètres → Jumeler
 * la TV). Miroir du flux relay, mais via le serveur de l'utilisateur ; la
 * logique du code est commune aux deux téléviseurs (`usePairingCode`).
 */
export function ServerCodeDisplayStep({ onConfirmed, onChangeServer }: ServerCodeDisplayStepProps) {
  const { t } = useTranslation(["pairing", "common"]);
  const { code, remaining, expired, loading, failed, regenerate: generate } = useServerPairingCode(true, onConfirmed);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = remaining / PAIRING_CODE_TTL;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accentPurple} />
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.errorText}>{t("pairing:relayError")}</Text>
          <Focusable variant="button" focusRadius={Button.large.borderRadius} onPress={generate} hasTVPreferredFocus>
            <View style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>{t("common:retry")}</Text>
            </View>
          </Focusable>
          <Focusable variant="button" focusRadius={Button.large.borderRadius} onPress={onChangeServer}>
            <View style={[styles.buttonGhost, { marginTop: 12 }]}>
              <Text style={styles.buttonGhostText}>{t("pairing:changeServer")}</Text>
            </View>
          </Focusable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TentacleLogo size={48} />

        {expired ? (
          <>
            <Text style={styles.expiredText}>{t("pairing:codeExpired")}</Text>
            <Focusable variant="button" focusRadius={Button.large.borderRadius} onPress={generate} hasTVPreferredFocus>
              <View style={styles.buttonPrimary}>
                <Text style={styles.buttonPrimaryText}>{t("pairing:generateNewCode")}</Text>
              </View>
            </Focusable>
          </>
        ) : (
          <>
            {/* Code à reporter sur le téléphone/web */}
            <View style={styles.codeRow}>
              {(code ?? "").split("").map((char, i) => (
                <View key={i} style={styles.codeBox}>
                  <Text style={styles.codeChar}>{char}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.instruction}>{t("pairing:tvPairInstructions")}</Text>

            <Text style={styles.timer}>
              {t("pairing:expiresIn", {
                time: `${minutes}:${seconds.toString().padStart(2, "0")}`,
              })}
            </Text>

            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </>
        )}

        <Focusable variant="button" focusRadius={Button.large.borderRadius} onPress={onChangeServer}>
          <View style={styles.buttonGhost}>
            <Text style={styles.buttonGhostText}>{t("pairing:changeServer")}</Text>
          </View>
        </Focusable>
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
    width: 600,
    padding: 48,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.modal,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center" as const,
  },
  codeRow: {
    flexDirection: "row" as const,
    gap: 16,
    marginTop: 32,
    marginBottom: 28,
  },
  codeBox: {
    width: 100,
    height: 120,
    backgroundColor: brandAlpha(0.1),
    borderWidth: 2,
    borderColor: Colors.accentPurple,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  codeChar: {
    color: Colors.textPrimary,
    fontSize: 64,
    fontWeight: "800" as const,
    fontFamily: "monospace",
  },
  instruction: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: "center" as const,
    lineHeight: 26,
    maxWidth: 480,
    marginBottom: 20,
  },
  timer: {
    color: Colors.textTertiary,
    fontSize: 14,
    marginBottom: 12,
  },
  progressBg: {
    width: "100%" as const,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden" as const,
    marginBottom: 24,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accentPurple,
    borderRadius: 2,
  },
  expiredText: {
    color: Colors.error,
    fontSize: 22,
    fontWeight: "600" as const,
    marginTop: 24,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 18,
    fontWeight: "500" as const,
    textAlign: "center" as const,
    marginBottom: 24,
  },
  // CTA core (fiche média) : primaire blanc + ghost translucide
  buttonPrimary: {
    ...Button.large,
    backgroundColor: Colors.ctaPrimaryBg,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
  },
  buttonPrimaryText: {
    color: Colors.ctaPrimaryFg,
    ...Typography.buttonLarge,
  },
  buttonGhost: {
    ...Button.large,
    backgroundColor: Colors.ctaGhostBg,
    borderWidth: 1,
    borderColor: Colors.ctaGhostBorder,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
  },
  buttonGhostText: {
    color: Colors.textPrimary,
    ...Typography.buttonLarge,
  },
};
