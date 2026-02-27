import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRelayGenerate, useRelayStatus } from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { Focusable } from "../focus/Focusable";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius } from "../../theme/colors";

interface RelayCodeDisplayProps {
  onConfirmed: (data: RelayStatusResponse) => void;
  onCancel: () => void;
  onManualSetup: () => void;
}

const CODE_TTL = 300;

export function RelayCodeDisplay({
  onConfirmed,
  onCancel,
  onManualSetup,
}: RelayCodeDisplayProps) {
  const { t } = useTranslation("pairing");
  const generateMut = useRelayGenerate();
  const [code, setCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(CODE_TTL);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const expired = remaining <= 0;
  const canPoll = !!code && !expired;

  const { data: statusData } = useRelayStatus(canPoll ? code : null);

  // Generate code on mount
  const generate = useCallback(() => {
    setCode(null);
    setRemaining(CODE_TTL);
    setGeneratedAt(null);
    generateMut.mutate(undefined, {
      onSuccess: (data) => {
        setCode(data.code);
        setGeneratedAt(Date.now());
      },
    });
  }, [generateMut]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown
  useEffect(() => {
    if (!generatedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - generatedAt) / 1000);
      const left = Math.max(0, CODE_TTL - elapsed);
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedAt]);

  // Handle confirmed status
  useEffect(() => {
    if (statusData?.status === "confirmed") {
      onConfirmed(statusData);
    }
  }, [statusData, onConfirmed]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = remaining / CODE_TTL;

  // Loading state
  if (!code && generateMut.isPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accentPurple} />
      </View>
    );
  }

  // Network error state
  if (!code && generateMut.isError) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.errorText}>{t("pairing:relayError")}</Text>
          <Focusable onPress={generate} hasTVPreferredFocus>
            <View style={styles.retryButton}>
              <Text style={styles.retryButtonText}>{t("common:retry")}</Text>
            </View>
          </Focusable>
          <Focusable onPress={onManualSetup}>
            <View style={styles.linkButton}>
              <Text style={styles.linkText}>
                {t("pairing:configureManually")}
              </Text>
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
            <Focusable onPress={generate} hasTVPreferredFocus>
              <View style={styles.retryButton}>
                <Text style={styles.retryButtonText}>
                  {t("pairing:generateNewCode")}
                </Text>
              </View>
            </Focusable>
          </>
        ) : (
          <>
            {/* Code display */}
            <View style={styles.codeRow}>
              {(code ?? "").split("").map((char, i) => (
                <View key={i} style={styles.codeBox}>
                  <Text style={styles.codeChar}>{char}</Text>
                </View>
              ))}
            </View>

            {/* Instructions */}
            <Text style={styles.instruction}>
              {t("pairing:tvPairInstructions")}
            </Text>

            {/* Timer */}
            <Text style={styles.timer}>
              {t("pairing:expiresIn", {
                time: `${minutes}:${seconds.toString().padStart(2, "0")}`,
              })}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
          </>
        )}

        {/* Cancel button */}
        <Focusable onPress={onCancel}>
          <View style={styles.linkButton}>
            <Text style={styles.linkText}>{t("pairing:cancel")}</Text>
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
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: Radius.buttonLarge,
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
    fontWeight: "400" as const,
    textAlign: "center" as const,
    lineHeight: 26,
    maxWidth: 480,
    marginBottom: 20,
  },
  timer: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: "400" as const,
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
  retryButton: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    backgroundColor: Colors.accentPurple,
    borderRadius: Radius.button,
    marginBottom: 16,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700" as const,
  },
  linkButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  linkText: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: "400" as const,
  },
} as const;
