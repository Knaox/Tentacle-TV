import { useState, useCallback, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import {
  useGenerateTvToken,
  useRelayConfirm,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import {
  FONT_FAMILY,
  RADIUS,
  useContentPadding,
  useTheme,
  withAlpha,
} from "../theme";
import { SubtleBackground, GlassCard, FadeIn, IconButton } from "../components/ui";
import { PairCodeInputs, type PairCodeInputsHandle } from "../components/pair/PairCodeInputs";
import { PairUnavailableCard } from "../components/pair/PairUnavailableCard";
import { PairTvMedallion } from "../components/pair/PairTvMedallion";
import { ProblemState } from "../components/problems/ProblemState";
import { usePageProblem } from "../components/problems/usePageProblem";
import { pairingErrorKey, usePairingAvailability } from "../hooks/usePairingAvailability";

export function PairTVScreen() {
  const { t } = useTranslation("pairing");
  const { t: te } = useTranslation("errors");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const { storage } = useTentacleConfig();
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();

  const [chars, setChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "pairing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const codeInputsRef = useRef<PairCodeInputsHandle>(null);

  // Le jumelage exige l'URL publique du serveur ; une panne se dit à part.
  const pairing = usePairingAvailability(storage);
  const { available } = pairing;
  const pairingFailure = usePageProblem(pairing.error, {
    target: "tentacle", context: "pairing", availability: { canGoBack: false }, onRetry: pairing.retry,
  });

  const code = chars.join("");
  const canSubmit = code.length === 4 && status === "idle";

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("pairing");
    setErrorMsg("");

    try {
      const { token } = await tvTokenMut.mutateAsync();

      const base = storage.getItem("tentacle_server_url") ?? "";
      if (!base) throw new Error(te("noServerUrl"));

      // Préférer l'URL publique du serveur (domaine Cloudflare) pour que la TV
      // reçoive une adresse joignable depuis l'externe, pas l'URL LAN/interne
      // que le mobile utilise. Fallback sur `base` si /api/config ne la fournit pas.
      let serverUrl = base;
      try {
        const cfgRes = await fetch(`${base}/api/config`);
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (cfg?.publicUrl) serverUrl = cfg.publicUrl as string;
        }
      } catch {
        /* réseau indisponible — on garde `base` */
      }

      const userRaw = storage.getItem("tentacle_user");
      const user = userRaw ? JSON.parse(userRaw) as { Id: string; Name: string } : null;
      if (!user?.Id || !user?.Name) throw new Error(te("userInfoNotFound"));

      await relayConfirmMut.mutateAsync({
        code,
        serverUrl,
        token,
        user: { id: user.Id, name: user.Name },
      });

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(t(pairingErrorKey(err)));
    }
  }, [canSubmit, code, tvTokenMut, relayConfirmMut, storage, t, te]);

  const handleReset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
    codeInputsRef.current?.focusFirst();
  }, []);

  const contentPad = useContentPadding();

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 24) + 8,
          marginBottom: 8,
        }}>
          <IconButton
            icon="chevron-left"
            onPress={() => backOrHome(router)}
            size={40}
            bgColor="transparent"
            color={theme.colors.brand.light}
            accessibilityLabel={t("common:back")}
          />
        </View>

        <PairTvMedallion />

        <FadeIn delay={80} translateY={10}>
          <Text style={{
            fontSize: 28,
            fontFamily: FONT_FAMILY.extrabold,
            fontWeight: "800",
            color: theme.colors.text.primary,
            letterSpacing: -0.6,
            textAlign: "center",
            marginBottom: 6,
          }} accessibilityRole="header">
            {t("pairYourTV")}
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: FONT_FAMILY.medium,
            color: theme.colors.brand.light,
            letterSpacing: 0.3,
            textAlign: "center",
            marginBottom: 24,
            paddingHorizontal: 32,
          }}>
            {t("enterTVCode")}
          </Text>
        </FadeIn>

        <FadeIn delay={140} translateY={12} style={{ paddingHorizontal: contentPad }}>
          <GlassCard style={{ padding: 24 }}>
            {pairingFailure.model ? (
              <ProblemState embedded model={pairingFailure.model} onAction={pairingFailure.onAction} />
            ) : available !== true ? (
              <PairUnavailableCard loading={available === null} />
            ) : status === "success" ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: theme.colors.statusPairs.success.bg,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 14,
                }}>
                  <Feather name="check-circle" size={40} color={theme.colors.status.success} />
                </View>
                <Text style={{
                  color: theme.colors.status.success,
                  fontSize: 16,
                  fontFamily: FONT_FAMILY.semibold,
                  textAlign: "center",
                }}>
                  {t("tvPairedSuccess")}
                </Text>
              </View>
            ) : (
              <>
                <PairCodeInputs
                  ref={codeInputsRef}
                  chars={chars}
                  onChange={setChars}
                  status={status}
                />

                {status === "error" && errorMsg ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
                    <Feather name="alert-circle" size={16} color={theme.colors.status.error} />
                    <Text style={{
                      color: theme.colors.status.error,
                      fontSize: 13,
                      fontFamily: FONT_FAMILY.medium,
                      textAlign: "center",
                    }}>{errorMsg}</Text>
                  </View>
                ) : null}

                {status === "error" ? (
                  <Pressable
                    onPress={handleReset}
                    accessibilityRole="button"
                    accessibilityLabel={t("retry")}
                    style={({ pressed }) => [
                      {
                        backgroundColor: theme.colors.brand.ghost,
                        borderWidth: 1,
                        borderColor: withAlpha(theme.colors.brand.violet, 0.4, theme.colors.brand.glow),
                        borderRadius: RADIUS.md,
                        paddingVertical: 13,
                        minHeight: 46,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={{
                      color: theme.colors.text.primary,
                      fontSize: 15,
                      fontFamily: FONT_FAMILY.semibold,
                    }}>{t("retry")}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    accessibilityRole="button"
                    accessibilityLabel={t("pairTV")}
                    style={({ pressed }) => [
                      {
                        backgroundColor: theme.colors.cta.primaryBg,
                        borderRadius: RADIUS.md,
                        paddingVertical: 13,
                        minHeight: 46,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: theme.colors.brand.violet,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.55,
                        shadowRadius: 22,
                        elevation: 12,
                      },
                      !canSubmit && { opacity: 0.45, shadowOpacity: 0 },
                      canSubmit && pressed && { opacity: 0.88 },
                    ]}
                  >
                    {status === "pairing" ? (
                      <ActivityIndicator color={theme.colors.cta.primaryFg} size="small" />
                    ) : (
                      <Text style={{
                        color: theme.colors.cta.primaryFg,
                        fontSize: 15,
                        fontFamily: FONT_FAMILY.bold,
                        letterSpacing: 0.2,
                      }}>{t("pairTV")}</Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={200} translateY={8}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 16,
            paddingHorizontal: 16,
          }}>
            <Feather name="clock" size={12} color={theme.colors.text.quaternary} />
            <Text style={{
              color: theme.colors.text.quaternary,
              fontSize: 12,
              fontFamily: FONT_FAMILY.regular,
              textAlign: "center",
            }}>
              {t("codeExpireNote")}
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </SubtleBackground>
  );
}
